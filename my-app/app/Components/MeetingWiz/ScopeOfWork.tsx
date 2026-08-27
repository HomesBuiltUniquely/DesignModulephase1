"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { getApiBase } from "@/app/lib/apiBase";
import { formatHubPid } from "@/app/lib/formatHubPid";
import { createProlanceProjectViaApi } from "@/app/lib/prolanceApiCreateProject";
import { openProlanceBrowserForProjectId } from "@/app/lib/prolanceLinks";
import type {
  ConfigScopeReferenceFile,
  ConfigScopeRoom,
  ConfigScopeSummary,
  LeadshipTypes,
} from "@/app/Components/Types/Types";
import CustomSelect from "@/app/Components/ui/CustomSelect";
import {
  MeetingWizShell,
  MeetingWizStepDots,
  MeetingWizTopBar,
  mwCard,
  mwCta,
  mwDarkBtn,
  mwH1,
  mwMuted,
} from "./MeetingWizChrome";

const ROOM_OPTIONS = [
  "Living Room",
  "Modular Kitchen",
  "Kitchen",
  "Master Bedroom",
  "Bedroom",
  "Dining Room",
  "Bathroom",
  "Balcony / Utility",
  "Pooja Room",
  "Study / WFH",
  "Custom",
] as const;

const ROOM_PALETTE = [
  { icon: "🌿", iconBg: "color-mix(in srgb, var(--brand-secondary) 70%, var(--card-bg))" },
  { icon: "🟡", iconBg: "color-mix(in srgb, var(--brand-yellow) 28%, var(--card-bg))" },
  { icon: "🛋️", iconBg: "color-mix(in srgb, var(--brand-blue) 18%, var(--card-bg))" },
  { icon: "🍳", iconBg: "color-mix(in srgb, var(--brand-primary) 12%, var(--card-bg))" },
  { icon: "🛏️", iconBg: "color-mix(in srgb, var(--brand-secondary) 85%, var(--card-bg))" },
];

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type EditableRoom = {
  id: string;
  roomName: string;
  customName: string;
  theme: string;
  unitsText: string;
  falseCeilingRequired: boolean;
  notes: string;
};

type EditableRef = {
  id: string;
  fileName: string;
  viewUrl: string;
  mimeType: string | null;
};

interface Props {
  onNext: () => void;
  onPrev: () => void;
  lead?: LeadshipTypes | null;
  onLeadUpdated?: (lead: LeadshipTypes) => void;
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyRoom(name = "Living Room"): EditableRoom {
  return {
    id: newId("room"),
    roomName: name,
    customName: "",
    theme: "",
    unitsText: "",
    falseCeilingRequired: false,
    notes: "",
  };
}

function roomUnitsToText(room: ConfigScopeRoom): string {
  if (room.unitsRequired?.length) return room.unitsRequired.join(", ");
  const selected = (room.units ?? [])
    .filter((u) => u.selected !== false && u.label?.trim())
    .map((u) => u.label!.trim());
  if (selected.length) return selected.join(", ");
  return (room.units ?? [])
    .map((u) => u.label?.trim())
    .filter(Boolean)
    .join(", ");
}

function resolveRoomName(room: EditableRoom): string {
  if (room.roomName === "Custom") return room.customName.trim() || "Custom room";
  return room.roomName;
}

function initRoomsFromLead(lead: LeadshipTypes | null | undefined): EditableRoom[] {
  const scope = lead?.configScopeSummary ?? null;
  const rooms = scope?.selectedRooms ?? [];
  if (rooms.length) {
    return rooms.map((room) => {
      const name = (room.roomName || "").trim() || "Living Room";
      const isPreset = (ROOM_OPTIONS as readonly string[]).includes(name) && name !== "Custom";
      return {
        id: newId("room"),
        roomName: isPreset ? name : "Custom",
        customName: isPreset ? "" : name,
        theme: (room.theme || "").trim(),
        unitsText: roomUnitsToText(room),
        falseCeilingRequired: Boolean(room.falseCeilingRequired),
        notes: (room.notes || "").trim(),
      };
    });
  }
  const names = scope?.selectedRoomNames ?? [];
  if (names.length) {
    return names.map((n) => {
      const name = String(n).trim() || "Living Room";
      const isPreset = (ROOM_OPTIONS as readonly string[]).includes(name) && name !== "Custom";
      return {
        ...emptyRoom(isPreset ? name : "Custom"),
        customName: isPreset ? "" : name,
      };
    });
  }
  return [];
}

function initRefsFromLead(lead: LeadshipTypes | null | undefined): EditableRef[] {
  const refs = lead?.configScopeSummary?.referenceInspiration?.references ?? [];
  return refs.map((ref, i) => ({
    id: String(ref.id || `ref-${i}`),
    fileName: (ref.fileName || "Reference").trim(),
    viewUrl: (ref.viewUrl || "").trim(),
    mimeType: ref.mimeType ?? null,
  }));
}

function initAesthetic(lead: LeadshipTypes | null | undefined): string {
  const scope = lead?.configScopeSummary ?? null;
  return (
    scope?.referenceInspiration?.aestheticNotes?.trim() ||
    scope?.designHandoffNotes?.trim() ||
    ""
  );
}

function isImageUrl(url: string, mime: string | null): boolean {
  if ((mime || "").toLowerCase().startsWith("image/")) return true;
  if (url.startsWith("data:image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);
}

export default function ScopeOfWork({ onNext, onPrev, lead, onLeadUpdated }: Props) {
  const { sessionId } = useAuth();
  const API = getApiBase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rooms, setRooms] = useState<EditableRoom[]>(() => initRoomsFromLead(lead));
  const [references, setReferences] = useState<EditableRef[]>(() => initRefsFromLead(lead));
  const [aestheticNotes, setAestheticNotes] = useState(() => initAesthetic(lead));
  const [addRoomChoice, setAddRoomChoice] = useState<string>("Living Room");

  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    setRooms(initRoomsFromLead(lead));
    setReferences(initRefsFromLead(lead));
    setAestheticNotes(initAesthetic(lead));
  }, [lead?.id]);

  const existingPid =
    lead?.prolanceProjectId != null ? Number(lead.prolanceProjectId) : NaN;
  const hasProject = Number.isFinite(existingPid) && existingPid >= 1;

  function updateRoom(id: string, patch: Partial<EditableRoom>) {
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRoom(id: string) {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }

  function addRoom() {
    const choice = addRoomChoice || "Living Room";
    setRooms((prev) => [
      ...prev,
      {
        ...emptyRoom(choice === "Custom" ? "Custom" : choice),
        customName: "",
      },
    ]);
  }

  function removeReference(id: string) {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleReferenceFile(file: File | undefined) {
    setSaveMessage(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveMessage({ type: "error", text: "Please choose an image (JPG, PNG, or WebP)." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSaveMessage({ type: "error", text: "Image must be 2MB or smaller." });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
    setReferences((prev) => [
      ...prev,
      {
        id: newId("ref"),
        fileName: file.name.replace(/\.[^.]+$/, "") || "Client design",
        viewUrl: dataUrl,
        mimeType: file.type || "image/jpeg",
      },
    ]);
  }

  function buildPayloadRooms(): ConfigScopeRoom[] {
    return rooms
      .map((r) => {
        const roomName = resolveRoomName(r);
        const unitsRequired = r.unitsText
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean);
        return {
          roomName,
          theme: r.theme.trim() || null,
          unitsRequired,
          falseCeilingRequired: r.falseCeilingRequired,
          notes: r.notes.trim() || null,
        };
      })
      .filter((r) => r.roomName);
  }

  function buildPayloadRefs(): ConfigScopeReferenceFile[] {
    return references
      .filter((r) => r.viewUrl.trim())
      .map((r) => ({
        id: r.id,
        fileName: r.fileName.trim() || "Reference",
        mimeType: r.mimeType,
        viewUrl: r.viewUrl.trim(),
      }));
  }

  async function handleSaveDraft() {
    setSaveMessage(null);
    if (!lead) {
      setSaveMessage({
        type: "error",
        text: "Open Start meeting from a lead to save scope on that lead.",
      });
      return;
    }
    if (!sessionId) {
      setSaveMessage({ type: "error", text: "Please sign in to save." });
      return;
    }

    const selectedRooms = buildPayloadRooms();
    const refs = buildPayloadRefs();

    setSaveBusy(true);
    try {
      const res = await fetch(`${API}/api/leads/${lead.id}/meeting-scope`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          selectedRooms,
          references: refs,
          aestheticNotes: aestheticNotes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMessage({
          type: "error",
          text: (data as { message?: string }).message || "Failed to save scope",
        });
        return;
      }

      const configScopeSummary = (data as { configScopeSummary?: ConfigScopeSummary | null })
        .configScopeSummary;
      const updatedLead: LeadshipTypes = {
        ...lead,
        configScopeSummary: configScopeSummary ?? {
          ...(lead.configScopeSummary || {}),
          selectedRooms,
          selectedRoomNames: selectedRooms.map((r) => r.roomName!).filter(Boolean),
          referenceInspiration: {
            aestheticNotes: aestheticNotes.trim() || null,
            references: refs,
          },
        },
      };
      onLeadUpdated?.(updatedLead);

      // Refresh local refs with persisted URLs (data URLs → hosted)
      const persisted = updatedLead.configScopeSummary?.referenceInspiration?.references ?? [];
      if (persisted.length) {
        setReferences(
          persisted.map((ref, i) => ({
            id: String(ref.id || `ref-${i}`),
            fileName: (ref.fileName || "Reference").trim(),
            viewUrl: (ref.viewUrl || "").trim(),
            mimeType: ref.mimeType ?? null,
          })),
        );
      }

      setSaveMessage({ type: "success", text: "Scope draft saved on the lead." });
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save scope",
      });
    } finally {
      setSaveBusy(false);
    }
  }

  const handleCreateProject = async () => {
    setCreateMessage(null);
    if (!lead) {
      setCreateMessage("Open Start meeting from a lead so the project can be linked.");
      return;
    }
    if (hasProject) {
      openProlanceBrowserForProjectId(existingPid);
      setCreateMessage(`Prolance project already linked (ID ${existingPid}). Opened in a new tab.`);
      return;
    }
    if (!sessionId) {
      setCreateMessage("Please sign in to create a Prolance project.");
      return;
    }

    setCreateBusy(true);
    try {
      const result = await createProlanceProjectViaApi({
        appApiBase: API,
        sessionId,
        project: lead,
      });
      if (!result.ok) {
        setCreateMessage(result.message);
        return;
      }

      const warnSuffix = result.warning ? ` ${result.warning}` : "";
      const createdProjectId = result.createdProjectId;
      if (createdProjectId == null) {
        setCreateMessage(
          `Prolance create returned OK; if no ID was parsed, link the project ID on the lead.${warnSuffix}`,
        );
        return;
      }

      const res = await fetch(`${API}/api/leads/${lead.id}/prolance-ids`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ prolanceProjectId: createdProjectId }),
      });

      const updatedLead: LeadshipTypes = {
        ...lead,
        prolanceProjectId: createdProjectId,
      };
      onLeadUpdated?.(updatedLead);

      if (!res.ok) {
        setCreateMessage(
          `Prolance project created (ID ${createdProjectId}) but saving on the lead failed. Save the ID in lead settings if needed.${warnSuffix}`,
        );
      } else {
        setCreateMessage(
          `Prolance project created (ID ${createdProjectId}) and saved on ${formatHubPid(lead.pid, lead.id)}.${warnSuffix}`,
        );
      }
      openProlanceBrowserForProjectId(createdProjectId);
    } catch (err) {
      setCreateMessage(err instanceof Error ? err.message : "Prolance create failed");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <MeetingWizShell className="flex flex-col">
      <MeetingWizTopBar
        onPrev={onPrev}
        hideNext
        extra={
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={saveBusy}
            className={mwDarkBtn}
          >
            {saveBusy ? "Saving…" : "Save Draft"}
          </button>
        }
      />
      <MeetingWizStepDots current={4} />

      <div className="flex-1 px-8 md:px-12 py-10 max-w-7xl mx-auto w-full box-border pb-28">
        <h1 className={mwH1}>
          4. Scope of Work Summary
        </h1>
        <p className={`${mwMuted} mb-10 max-w-2xl`}>
          Add rooms from the client discussion, then capture any designs they have in mind. Use Save Draft
          to store this on the lead.
        </p>
        {saveMessage ? (
          <p
            className="mb-4 text-xs"
            style={{
              color: saveMessage.type === "error" ? "var(--brand-primary)" : "var(--brand-blue)",
            }}
          >
            {saveMessage.text}
          </p>
        ) : null}

        {/* Design Scope */}
        <div className={`${mwCard} mb-6 p-8`}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "var(--brand-dark)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--card-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand-dark)" }}>Design Scope</span>
          </div>

          {!rooms.length ? (
            <p style={{ fontSize: "13px", color: "color-mix(in srgb, var(--foreground) 65%, transparent)", margin: "0 0 14px", lineHeight: 1.55 }}>
              No rooms yet. Add kitchen, bedroom, living room, and other areas discussed with the client.
            </p>
          ) : null}

          {rooms.map((room, index) => {
            const palette = ROOM_PALETTE[index % ROOM_PALETTE.length];
            return (
              <div
                key={room.id}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "10px",
                  padding: "16px 18px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        backgroundColor: palette.iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >
                      {palette.icon}
                    </div>
                    <CustomSelect
                      value={room.roomName}
                      onChange={(val) => updateRoom(room.id, { roomName: val })}
                      options={ROOM_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                      className="flex-1"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRoom(room.id)}
                    style={{
                      fontSize: "12px",
                      color: "var(--brand-primary)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>

                {room.roomName === "Custom" ? (
                  <input
                    value={room.customName}
                    onChange={(e) => updateRoom(room.id, { customName: e.target.value })}
                    placeholder="Custom room name"
                    style={{
                      width: "100%",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      fontSize: "13px",
                      marginBottom: "10px",
                      boxSizing: "border-box",
                    }}
                  />
                ) : null}

                <label style={labelStyle}>Theme / summary</label>
                <input
                  value={room.theme}
                  onChange={(e) => updateRoom(room.id, { theme: e.target.value })}
                  placeholder="e.g. Minimalist, neutral tones"
                  style={inputStyle}
                />

                <label style={labelStyle}>Included units (comma-separated)</label>
                <input
                  value={room.unitsText}
                  onChange={(e) => updateRoom(room.id, { unitsText: e.target.value })}
                  placeholder="e.g. TV Unit, Sofa, Center Table"
                  style={inputStyle}
                />

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "var(--foreground)",
                    marginBottom: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={room.falseCeilingRequired}
                    onChange={(e) => updateRoom(room.id, { falseCeilingRequired: e.target.checked })}
                  />
                  False ceiling required
                </label>

                <label style={labelStyle}>Specific room notes</label>
                <textarea
                  value={room.notes}
                  onChange={(e) => updateRoom(room.id, { notes: e.target.value })}
                  rows={2}
                  placeholder="Client preferences for this room…"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            );
          })}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <div className="w-32">
              <CustomSelect
                value={addRoomChoice}
                onChange={(val) => setAddRoomChoice(val)}
                options={ROOM_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
              />
            </div>
            <button
              type="button"
              onClick={addRoom}
              className="transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
              style={{
                border: "1px dashed var(--border-color)",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brand-dark)",
                background: "var(--hover-bg)",
                cursor: "pointer",
              }}
            >
              + Add room
            </button>
          </div>
        </div>

        {/* Reference & Inspiration */}
        <div className={`${mwCard} mb-10 p-8`}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "color-mix(in srgb, var(--brand-yellow) 28%, var(--card-bg))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "15px",
              }}
            >
              ✨
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--brand-dark)" }}>
              Reference &amp; Inspiration
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "color-mix(in srgb, var(--foreground) 62%, transparent)", margin: "0 0 14px", lineHeight: 1.5 }}>
            If the client has designs in mind, upload photos or mood boards from this meeting.
          </p>

          <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
            {references.map((ref) => {
              const showImage = isImageUrl(ref.viewUrl, ref.mimeType);
              return (
                <div
                  key={ref.id}
                  style={{
                    width: "170px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "1px solid var(--border-color)",
                    background: "var(--hover-bg)",
                  }}
                >
                  {showImage ? (
                    <div style={{ position: "relative", width: "100%", height: "120px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ref.viewUrl}
                        alt={ref.fileName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        height: "120px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "8px",
                        fontSize: "11px",
                        color: "color-mix(in srgb, var(--foreground) 62%, transparent)",
                        textAlign: "center",
                      }}
                    >
                      {ref.fileName}
                    </div>
                  )}
                  <div style={{ padding: "8px" }}>
                    <input
                      value={ref.fileName}
                      onChange={(e) =>
                        setReferences((prev) =>
                          prev.map((r) =>
                            r.id === ref.id ? { ...r, fileName: e.target.value } : r,
                          ),
                        )
                      }
                      style={{
                        width: "100%",
                        border: "1px solid var(--border-color)",
                        borderRadius: "4px",
                        padding: "4px 6px",
                        fontSize: "11px",
                        boxSizing: "border-box",
                        marginBottom: "6px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeReference(ref.id)}
                      style={{
                        fontSize: "11px",
                        color: "var(--brand-primary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100px",
                height: "120px",
                borderRadius: "8px",
                border: "1.5px dashed var(--border-color)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                flexShrink: 0,
                backgroundColor: "var(--hover-bg)",
              }}
            >
              <span style={{ fontSize: "22px", color: "color-mix(in srgb, var(--foreground) 50%, transparent)", lineHeight: 1 }}>+</span>
              <span
                style={{
                  fontSize: "10px",
                  color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Add design
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleReferenceFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
            <p style={labelStyle}>Aesthetic notes</p>
            <textarea
              value={aestheticNotes}
              onChange={(e) => setAestheticNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Prefers light finishes; dislikes heavy dark wood…"
              style={{ ...inputStyle, resize: "vertical", marginBottom: 0 }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mb-10">
          <button
            type="button"
            onClick={() => void handleCreateProject()}
            disabled={createBusy}
            className={`${mwCta} ${createBusy ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
            {createBusy ? "Creating…" : hasProject ? "Open Prolance Project" : "Create Project"}
          </button>
          {createMessage ? (
            <p
              style={{
                margin: 0,
                maxWidth: "520px",
                textAlign: "center",
                fontSize: "12px",
                color: createMessage.toLowerCase().includes("fail") ? "var(--brand-primary)" : "var(--brand-blue)",
                lineHeight: 1.5,
              }}
            >
              {createMessage}
            </p>
          ) : null}
          {!lead ? (
            <p style={{ margin: 0, fontSize: "11px", color: "color-mix(in srgb, var(--foreground) 50%, transparent)", textAlign: "center" }}>
              Start this meeting from a lead row to create the Prolance project for that lead.
            </p>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
        <button
          onClick={onNext}
          className={mwCta}
        >
          Next: Get Quote
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">→</span>
        </button>
      </div>
    </MeetingWizShell>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "9.5px",
  fontWeight: 700,
  color: "color-mix(in srgb, var(--foreground) 50%, transparent)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 6px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--border-color)",
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "13px",
  color: "var(--brand-dark)",
  backgroundColor: "var(--input-bg)",
  marginBottom: "10px",
  boxSizing: "border-box",
};
