import type { Pool } from "mysql2/promise";
import {
  postDesignInboxEvent,
  type DesignNotifyPath,
} from "./designNotifyClient";
import { resolveNotificationRecipients } from "./designNotifyAudience";

type LeadNotifyContext = {
  leadId: number;
  projectId: string;
  leadName: string;
  designerId: number | null;
  designerName: string | null;
  pmId: number | null;
  payload: Record<string, unknown>;
};

const PATH_META: Record<
  DesignNotifyPath,
  { notification_type: string; notification_action: string }
> = {
  "lead/pre-10": { notification_type: "LEAD", notification_action: "CREATED" },
  "lead/10-20": { notification_type: "PHASE", notification_action: "PHASE_ENTERED" },
  milestone: { notification_type: "MILESTONE", notification_action: "COMPLETED" },
  "payment/request": { notification_type: "PAYMENT", notification_action: "REQUESTED" },
  "payment/status": { notification_type: "PAYMENT", notification_action: "STATUS" },
  "dqc/request": { notification_type: "DQC", notification_action: "REQUESTED" },
  "dqc/status": { notification_type: "DQC", notification_action: "STATUS" },
  "mmt/request": { notification_type: "MMT", notification_action: "REQUESTED" },
  "mmt/assign": { notification_type: "ASSIGNMENT", notification_action: "ASSIGNED" },
  "mmt/doc-ready": { notification_type: "MMT", notification_action: "DOCUMENTS_READY" },
  meeting: { notification_type: "MEETING", notification_action: "SCHEDULED" },
  "assign/designer": { notification_type: "ASSIGNMENT", notification_action: "REASSIGNED" },
  "assign/pm": { notification_type: "ASSIGNMENT", notification_action: "PM_ASSIGNED" },
  quote: { notification_type: "QUOTE", notification_action: "CREATED" },
  p2p: { notification_type: "P2P", notification_action: "COMPLETED" },
};

function parsePayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const p = JSON.parse(raw);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function createDesignNotifyBridge(pool: Pool) {
  async function loadLeadNotifyContext(leadId: number): Promise<LeadNotifyContext | null> {
    const [rows] = await pool.query(
      `SELECT l.id, l.pid, l.project_name, l.assigned_designer_id, l.assigned_project_manager_id, l.payload,
              d.name AS designer_name
       FROM leads l
       LEFT JOIN users d ON d.id = l.assigned_designer_id
       WHERE l.id = ? LIMIT 1`,
      [leadId],
    );
    const row = (rows as Record<string, unknown>[])[0];
    if (!row) return null;
    const payload = parsePayload(row.payload);
    const formData =
      payload.formData && typeof payload.formData === "object"
        ? (payload.formData as Record<string, unknown>)
        : {};
    const fetched =
      payload.fetchedData && typeof payload.fetchedData === "object"
        ? (payload.fetchedData as Record<string, unknown>)
        : {};
    const leadName =
      pickStr(
        payload.customer_name,
        formData.customer_name,
        fetched.customer_name,
        row.project_name,
      ) || "Customer";
    return {
      leadId: Number(row.id),
      projectId: pickStr(row.pid) || `HUB-${leadId}`,
      leadName,
      designerId:
        typeof row.assigned_designer_id === "number" ? row.assigned_designer_id : null,
      designerName: typeof row.designer_name === "string" ? row.designer_name : null,
      pmId:
        typeof row.assigned_project_manager_id === "number"
          ? row.assigned_project_manager_id
          : null,
      payload,
    };
  }

  async function publish(args: {
    leadId: number;
    path: DesignNotifyPath;
    idempotencyKey: string;
    body?: Record<string, unknown>;
    payloadExtra?: Record<string, unknown>;
    notificationActionOverride?: string;
  }): Promise<void> {
    try {
      const ctx = await loadLeadNotifyContext(args.leadId);
      if (!ctx) {
        console.warn("[design-notify] lead not found", { leadId: args.leadId });
        return;
      }

      const meta = PATH_META[args.path];
      const payloadExtra = args.payloadExtra ?? {};
      const body = args.body ?? {};
      const nestedPayload =
        body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
          ? (body.payload as Record<string, unknown>)
          : {};
      const envelopeKeys = new Set([
        "project_id",
        "lead_name",
        "designer_id",
        "lead_id",
        "notification_type",
        "notification_action",
        "payload",
        "created_at",
      ]);
      const bodyFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) {
        if (envelopeKeys.has(key) || value === undefined) continue;
        bodyFields[key] = value;
      }
      const payload: Record<string, unknown> = {
        ...payloadExtra,
        ...bodyFields,
        ...nestedPayload,
        // Always the lead's designer — never overwrite with the actor who approved/assigned.
        designer_name: ctx.designerName,
      };
      const notificationType = String(
        args.body?.notification_type || meta.notification_type,
      ).toUpperCase();
      const notificationAction = String(
        args.notificationActionOverride ||
          args.body?.notification_action ||
          meta.notification_action,
      ).toUpperCase();

      const recipients = await resolveNotificationRecipients(pool, {
        leadId: ctx.leadId,
        designerId: ctx.designerId,
        pmId: ctx.pmId,
        notificationType,
        notificationAction,
        payload,
      });

      const result = await postDesignInboxEvent(
        {
          event_id: args.idempotencyKey,
          lead_id: ctx.leadId,
          project_id: ctx.projectId,
          lead_name: ctx.leadName,
          designer_id: ctx.designerId ?? 0,
          notification_type: notificationType,
          notification_action: notificationAction,
          payload,
          recipients,
        },
        args.idempotencyKey,
      );
      if (!result.ok) {
        console.error("[design-notify-inbox-failed]", {
          leadId: args.leadId,
          path: args.path,
          error: result.error,
          recipientCount: recipients.length,
        });
      }
    } catch (err) {
      console.error("[design-notify-publish-error]", { leadId: args.leadId, path: args.path, err });
    }
  }

  return {
    loadLeadNotifyContext,
    publish,
    notifyLeadPre10: async (leadId: number) => {
      const ctx = await loadLeadNotifyContext(leadId);
      return publish({
        leadId,
        path: "lead/pre-10",
        idempotencyKey: `lead:${leadId}:pre-10:created`,
        payloadExtra: {
          current_phase: "PRE_10",
          sales_executive_name: pickStr(ctx?.payload?.sales_executive_name),
          meeting_type: pickStr(ctx?.payload?.meeting_type, ctx?.payload?.appointmentType),
        },
      });
    },
    notifyLead1020: (leadId: number, trigger: string, message?: string) =>
      publish({
        leadId,
        path: "lead/10-20",
        idempotencyKey: `lead:${leadId}:phase:10-20:${trigger}`,
        payloadExtra: {
          previous_phase: "PRE_10",
          trigger,
          message: message || "Milestones unlocked — start design work",
        },
      }),
    notifyMilestone: (leadId: number, milestoneName: string, milestoneIndex: number) =>
      publish({
        leadId,
        path: "milestone",
        idempotencyKey: `milestone:${leadId}:${milestoneIndex}`,
        payloadExtra: { milestone_name: milestoneName, milestone_index: milestoneIndex },
      }),
    notifyPaymentRequest: (leadId: number, paymentType: string, extra?: Record<string, unknown>) =>
      publish({
        leadId,
        path: "payment/request",
        idempotencyKey: `payment:request:${leadId}:${paymentType}:${extra?.upload_id ?? Date.now()}`,
        payloadExtra: { payment_type: paymentType, ...extra },
      }),
    notifyPaymentStatus: (
      leadId: number,
      status: string,
      extra?: Record<string, unknown>,
      idSuffix?: string,
    ) =>
      publish({
        leadId,
        path: "payment/status",
        idempotencyKey: `payment:status:${leadId}:${status}:${idSuffix ?? ""}`,
        notificationActionOverride: status.toUpperCase().includes("REJECT") ? "REJECTED" : "APPROVED",
        body: {
          status,
          decision_type: extra?.decision_type ?? "PAYMENT",
          payment_type: extra?.payment_type,
          milestone_context: extra?.milestone_context,
          approver_name: extra?.approver_name ?? extra?.actor_name,
          actor_name: extra?.actor_name ?? extra?.approver_name,
          amount: extra?.amount,
          rejection_reason: extra?.rejection_reason,
        },
        payloadExtra: extra ?? {},
      }),
    notifyDqcRequest: (leadId: number, dqcRound: string, reviewId?: number | string) =>
      publish({
        leadId,
        path: "dqc/request",
        idempotencyKey: `dqc:request:${leadId}:${dqcRound}:${reviewId ?? Date.now()}`,
        body: { dqc_round: dqcRound, review_id: reviewId },
        payloadExtra: { dqc_round: dqcRound, review_id: reviewId },
      }),
    notifyDqcStatus: (leadId: number, status: string, extra?: Record<string, unknown>) =>
      publish({
        leadId,
        path: "dqc/status",
        idempotencyKey: `dqc:status:${leadId}:${status}:${extra?.dqc_round ?? ""}`,
        body: {
          status,
          decision_type: "DQC",
          dqc_round: extra?.dqc_round,
          approver_name: extra?.approver_name ?? extra?.actor_name,
          actor_name: extra?.actor_name ?? extra?.approver_name,
          rejection_reason: extra?.rejection_reason,
        },
        payloadExtra: extra ?? {},
        notificationActionOverride: status.toUpperCase().includes("REJECT") ? "REJECTED" : "APPROVED",
      }),
    notifyMmtRequest: (leadId: number, extra: Record<string, unknown>) =>
      publish({
        leadId,
        path: "mmt/request",
        idempotencyKey: `mmt:request:${leadId}:${extra.mmt_scope ?? ""}`,
        body: extra,
      }),
    notifyMmtAssign: (leadId: number, extra: Record<string, unknown>) =>
      publish({
        leadId,
        path: "mmt/assign",
        idempotencyKey: `mmt:assign:${leadId}:${extra.to_id ?? ""}`,
        body: {
          notification_type: "ASSIGNMENT",
          notification_action: "ASSIGNED",
          payload: extra,
        },
      }),
    notifyMmtDocReady: (leadId: number, extra: Record<string, unknown>) =>
      publish({
        leadId,
        path: "mmt/doc-ready",
        idempotencyKey: `mmt:doc:${leadId}:${extra.upload_name ?? Date.now()}`,
        body: {
          notification_type: "MMT",
          notification_action: "DOCUMENTS_READY",
          payload: extra,
        },
      }),
    notifyMeeting: (leadId: number, extra: Record<string, unknown>) => {
      const slot = extra.slot && typeof extra.slot === "object" ? (extra.slot as Record<string, unknown>) : {};
      const meetingType = String(extra.meeting_type ?? "");
      const date = String(slot.date ?? extra.date ?? "");
      const timeSlot = String(slot.time_slot ?? slot.slot_time ?? extra.time_slot ?? "");
      return publish({
        leadId,
        path: "meeting",
        // Unique per create so a second meeting the same day still notifies
        idempotencyKey: `meeting:${leadId}:${meetingType}:${date}:${timeSlot}:${Date.now()}`,
        body: extra,
        payloadExtra: {
          meeting_type: meetingType,
          mod: extra.mod,
          slot: { date, time_slot: timeSlot },
        },
      });
    },
    notifyAssignDesigner: (leadId: number, fromId: number, toId: number, fromName: string, toName: string) =>
      publish({
        leadId,
        path: "assign/designer",
        idempotencyKey: `assign:designer:${leadId}:${toId}`,
        body: {
          notification_type: "ASSIGNMENT",
          notification_action: "REASSIGNED",
          payload: {
            assignment_type: "DESIGNER",
            from_id: fromId,
            to_id: toId,
            from_name: fromName,
            to_name: toName,
          },
        },
      }),
    notifyAssignPm: (leadId: number, toId: number, toName: string) =>
      publish({
        leadId,
        path: "assign/pm",
        idempotencyKey: `assign:pm:${leadId}:${toId}`,
        body: {
          notification_type: "ASSIGNMENT",
          notification_action: "PM_ASSIGNED",
          payload: {
            assignment_type: "PROJECT_MANAGER",
            to_id: toId,
            to_name: toName,
          },
        },
      }),
    notifyQuote: (leadId: number, quoteId: string, quoteLink?: string) =>
      publish({
        leadId,
        path: "quote",
        idempotencyKey: `quote:${leadId}:${quoteId}`,
        body: {
          notification_type: "QUOTE",
          notification_action: "CREATED",
          payload: { quote_id: quoteId, quote_link: quoteLink },
        },
      }),
    notifyP2p: (leadId: number, designerName?: string) =>
      publish({
        leadId,
        path: "p2p",
        idempotencyKey: `p2p:${leadId}:completed`,
        body: {
          notification_type: "P2P",
          notification_action: "COMPLETED",
          designer_name: designerName,
        },
      }),
  };
}

export type DesignNotifyBridge = ReturnType<typeof createDesignNotifyBridge>;
