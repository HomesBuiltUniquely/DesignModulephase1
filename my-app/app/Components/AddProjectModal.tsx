"use client";

import { useState } from "react";
import {
    createProlanceProjectFromForm,
    type ProlanceProjectFormFields,
} from "@/app/lib/prolanceApiCreateProject";
import { openProlanceBrowserForProjectId } from "@/app/lib/prolanceLinks";

export type AddProjectFormValues = ProlanceProjectFormFields & {
    contactNo: string;
    clientEmail: string;
};

type Props = {
    open: boolean;
    appApiBase: string;
    sessionId: string;
    onClose: () => void;
    onSuccess: (message: string) => void;
};

const INITIAL: AddProjectFormValues = {
    pName: "",
    customer: "",
    city: "Bengaluru",
    state: "Karnataka",
    contactNo: "",
    clientEmail: "",
};

export function AddProjectModal({ open, appApiBase, sessionId, onClose, onSuccess }: Props) {
    const [form, setForm] = useState<AddProjectFormValues>(INITIAL);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const update = (key: keyof AddProjectFormValues, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.pName.trim()) {
            setError("Project name is required.");
            return;
        }
        if (!form.customer.trim()) {
            setError("Customer name is required.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const prolance = await createProlanceProjectFromForm({
                appApiBase,
                sessionId,
                fields: {
                    pName: form.pName,
                    customer: form.customer,
                    city: form.city,
                    state: form.state,
                },
            });
            if (!prolance.ok) {
                setError(prolance.message);
                return;
            }

            const leadRes = await fetch(`${appApiBase.replace(/\/$/, "")}/api/leads/manual-create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionId}`,
                },
                body: JSON.stringify({
                    projectName: form.pName.trim(),
                    customerName: form.customer.trim(),
                    city: form.city.trim(),
                    state: form.state.trim(),
                    contactNo: form.contactNo.trim() || undefined,
                    clientEmail: form.clientEmail.trim() || undefined,
                    prolanceProjectId: prolance.createdProjectId ?? undefined,
                }),
            });
            const leadBody = await leadRes.json().catch(() => null);
            if (!leadRes.ok) {
                const prolanceId = prolance.createdProjectId;
                setError(
                    prolanceId
                        ? `Prolance project ${prolanceId} was created but saving in CRM failed: ${
                              (leadBody && leadBody.message) || "Unknown error"
                          }`
                        : String((leadBody && leadBody.message) || "Failed to save lead in CRM."),
                );
                if (prolanceId) openProlanceBrowserForProjectId(prolanceId);
                return;
            }

            const pid = leadBody?.pid ? String(leadBody.pid) : "lead";
            const prolanceId = prolance.createdProjectId;
            let msg = `Created ${pid}`;
            if (prolanceId) msg += ` with Prolance project ID ${prolanceId}`;
            if (prolance.warning) msg += `. ${prolance.warning}`;
            onSuccess(msg);
            setForm(INITIAL);
            onClose();
            if (prolanceId) openProlanceBrowserForProjectId(prolanceId);
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-labelledby="add-project-title"
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 id="add-project-title" className="text-xl font-bold text-gray-900">
                                Add project
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Creates a Prolance project and adds it to your Pre 10% queue.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Project name *</span>
                        <input
                            required
                            value={form.pName}
                            onChange={(e) => update("pName", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="e.g. Kumar Residence"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Customer name *</span>
                        <input
                            required
                            value={form.customer}
                            onChange={(e) => update("customer", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="e.g. Rajesh Kumar"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">City</span>
                            <input
                                value={form.city}
                                onChange={(e) => update("city", e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">State</span>
                            <input
                                value={form.state}
                                onChange={(e) => update("state", e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Contact number</span>
                        <input
                            value={form.contactNo}
                            onChange={(e) => update("contactNo", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Optional"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Customer email</span>
                        <input
                            type="email"
                            value={form.clientEmail}
                            onChange={(e) => update("clientEmail", e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Optional"
                        />
                    </label>

                    {error && (
                        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? "Creating…" : "Create project"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
