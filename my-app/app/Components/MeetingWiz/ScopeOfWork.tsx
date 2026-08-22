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
import { MeetingWizDurationBadge } from "./MeetingWizTimer";

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
  { icon: "🌿", iconBg: "#f0fdf4" },
  { icon: "🟡", iconBg: "#fefce8" },
  { icon: "🛋️", iconBg: "#eff6ff" },
  { icon: "🍳", iconBg: "#fff7ed" },
  { icon: "🛏️", iconBg: "#faf5ff" },
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
    <main
      className="min-h-screen w-full bg-[#f0f4f8]"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", display: "flex", flexDirection: "column" }}
    >
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <MeetingWizDurationBadge />
        <div className="flex items-center gap-4">
          <button
            onClick={onPrev}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={saveBusy}
            className="rounded-md bg-slate-950 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
          >
            {saveBusy ? "Saving…" : "Save Draft"}
          </button>
          <button className="text-xl font-light text-gray-500 transition hover:text-gray-800">×</button>
        </div>
      </div>

      <div className="flex flex-col items-center py-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full w-8 ${i < 4 ? "bg-[var(--brand-primary)]" : "bg-gray-300"}`}
            />
          ))}
        </div>
        <span className="mt-1 text-xs font-medium uppercase tracking-widest text-gray-400">
          Step 4 of 5
        </span>
      </div>

      <div className="flex-1 mx-auto max-w-4xl px-6 pb-28 w-full box-border">
        <h1
          style={{
            fontSize: "30px",
            fontWeight: 800,
            color: "#111827",
            margin: "0 0 6px",
            lineHeight: 1.1,
          }}
        >
          4. Scope of Work Summary
        </h1>
        <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 12px", lineHeight: 1.5 }}>
          Add rooms from the client discussion, then capture any designs they have in mind. Use Save Draft
          to store this on the lead.
        </p>
        {saveMessage ? (
          <p
            style={{
              fontSize: "12px",
              margin: "0 0 16px",
              color: saveMessage.type === "error" ? "#b91c1c" : "#166534",
            }}
          >
            {saveMessage.text}
          </p>
        ) : null}

        {/* Design Scope */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "20px 22px 16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>Design Scope</span>
          </div>

          {!rooms.length ? (
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 14px", lineHeight: 1.55 }}>
              No rooms yet. Add kitchen, bedroom, living room, and other areas discussed with the client.
            </p>
          ) : null}

          {rooms.map((room, index) => {
            const palette = ROOM_PALETTE[index % ROOM_PALETTE.length];
            return (
              <div
                key={room.id}
                style={{
                  border: "1px solid #e5e7eb",
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
                    <select
                      value={room.roomName}
                      onChange={(e) => updateRoom(room.id, { roomName: e.target.value })}
                      style={{
                        flex: 1,
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#111827",
                        background: "#fff",
                      }}
                    >
                      {ROOM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRoom(room.id)}
                    style={{
                      fontSize: "12px",
                      color: "#dc2626",
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
                      border: "1px solid #e5e7eb",
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
                    color: "#374151",
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
            <select
              value={addRoomChoice}
              onChange={(e) => setAddRoomChoice(e.target.value)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "8px 10px",
                fontSize: "12px",
                background: "#fff",
              }}
            >
              {ROOM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addRoom}
              style={{
                border: "1px dashed #d1d5db",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#374151",
                background: "#fafafa",
                cursor: "pointer",
              }}
            >
              + Add room
            </button>
          </div>
        </div>

        {/* Reference & Inspiration */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "20px 22px 20px",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "7px",
                backgroundColor: "#fefce8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "15px",
              }}
            >
              ✨
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
              Reference &amp; Inspiration
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 14px", lineHeight: 1.5 }}>
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
                    border: "1px solid #e5e7eb",
                    background: "#fafafa",
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
                        color: "#6b7280",
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
                        border: "1px solid #e5e7eb",
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
                        color: "#dc2626",
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
                border: "1.5px dashed #d1d5db",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: "pointer",
                flexShrink: 0,
                backgroundColor: "#fafafa",
              }}
            >
              <span style={{ fontSize: "22px", color: "#9ca3af", lineHeight: 1 }}>+</span>
              <span
                style={{
                  fontSize: "10px",
                  color: "#9ca3af",
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

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "14px" }}>
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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            marginBottom: "32px",
          }}
        >
          <button
            type="button"
            onClick={() => void handleCreateProject()}
            disabled={createBusy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              backgroundColor: "var(--brand-primary)",
              border: "none",
              borderRadius: "8px",
              padding: "14px 36px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#000000",
              cursor: createBusy ? "not-allowed" : "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              opacity: createBusy ? 0.7 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                color: createMessage.toLowerCase().includes("fail") ? "#b91c1c" : "#166534",
                lineHeight: 1.5,
              }}
            >
              {createMessage}
            </p>
          ) : null}
          {!lead ? (
            <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
              Start this meeting from a lead row to create the Prolance project for that lead.
            </p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#f2f4f7",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 50,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "9999px",
            backgroundColor: "var(--brand-primary)",
          }}
        />
        <button
          onClick={onNext}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "var(--brand-primary)",
            border: "none",
            borderRadius: "6px",
            padding: "10px 20px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#000000",
            cursor: "pointer",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Next: Get Quote
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </main>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "9.5px",
  fontWeight: 700,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 6px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "13px",
  color: "#111827",
  marginBottom: "10px",
  boxSizing: "border-box",
};
