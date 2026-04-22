import { NextResponse } from "next/server";
import { sendMail } from "@/lib/email/mailer";
import {
  renderProjectFileTimelineEmail,
  type ProjectFileTimelineEmailParams,
} from "@/lib/email/render-project-file-timeline";

const estimateDaysMap: Record<string, number> = {
  "Below 3 lakh- 12L - 45 Days": 45,
  "Above 12 to 18 lakh - 60Days": 60,
  "Project with Membrane shutters-75 days": 75,
  "Above 18to 25 lakh - 75Days": 75,
  "Above 25lakh - 90 Days": 90,
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProjectFileTimelineEmailParams>;

    const required = [
      "projectId",
      "customerEmail",
      "customerName",
      "designLeadName",
      "designerName",
      "pmName",
      "spmName",
      "estimateValue",
      "projectConfiguration",
      "designApprovalDate",
    ] as const;

    for (const field of required) {
      if (!body[field] || String(body[field]).trim() === "") {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const estimateValue = String(body.estimateValue);
    const estimateDays = estimateDaysMap[estimateValue];
    if (!estimateDays) {
      return NextResponse.json({ error: "Invalid estimate value selected" }, { status: 400 });
    }

    const html = renderProjectFileTimelineEmail({
      projectId: String(body.projectId),
      customerEmail: String(body.customerEmail),
      customerName: String(body.customerName),
      designLeadName: String(body.designLeadName),
      designerName: String(body.designerName),
      pmName: String(body.pmName),
      spmName: String(body.spmName),
      estimateValue,
      projectConfiguration: String(body.projectConfiguration),
      designApprovalDate: String(body.designApprovalDate),
      estimateDays,
    });

    const info = await sendMail({
      to: String(body.customerEmail),
      subject: `Timeline Update - HUB ${String(body.projectId)}`,
      html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Project file timeline email error", error);
    return NextResponse.json({ error: "Failed to send project timeline email" }, { status: 500 });
  }
}
