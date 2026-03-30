"use client";

import { useState } from "react";

type FormState = {
  projectId: string;
  customerEmail: string;
  customerName: string;
  designLeadName: string;
  designerName: string;
  pmName: string;
  spmName: string;
  estimateValue: string;
  designApprovalDate: string;
  projectConfiguration: string;
};

const estimateOptions = [
  "Below 3 lakh- 12L - 45 Days",
  "Above 12 to 18 lakh - 60Days",
  "Project with Membrane shutters-75 days",
  "Above 18to 25 lakh - 75Days",
  "Above 25lakh - 90 Days",
];

const configurationOptions = [
  "1BHK",
  "2BHK",
  "3BHK",
  "4BHK & more",
  "Renovation",
  "Only kitchen",
  "Villa",
];

export default function ProjectFile() {
  const [form, setForm] = useState<FormState>({
    projectId: "",
    customerEmail: "",
    customerName: "",
    designLeadName: "",
    designerName: "",
    pmName: "",
    spmName: "",
    estimateValue: "",
    designApprovalDate: "",
    projectConfiguration: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const res = await fetch("/api/email/send-project-file-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send timeline email");
      }
      setSubmitMessage("Timeline email sent successfully to the customer.");
    } catch (err: unknown) {
      setSubmitMessage(err instanceof Error ? err.message : "Failed to send timeline email");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#eceef7] py-8">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="overflow-hidden rounded-2xl border border-[#d6d9ef] bg-white shadow-lg">
          <div className="bg-gradient-to-r from-[#6f66f7] via-[#7d74ff] to-[#948dff] px-6 py-6 text-white">
            <p className="text-sm/5 text-white/80">New Portfolio</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Project File</h1>
          </div>

          <div className="p-5 sm:p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <section className="overflow-hidden rounded-xl border border-[#d8dcef]">
                <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#5f5adb] text-sm font-semibold text-white">
                      1
                    </span>
                    <p className="text-lg font-semibold text-[#2f3354]">Basic Information</p>
                  </div>
                  <span className="text-lg text-[#7479a3]">^</span>
                </div>
                <div className="border-t border-[#e7e9f5] bg-[#fbfcff] px-4 py-5 sm:px-5">
                  <p className="mb-1 text-sm font-medium text-[#6d7397]">
                    Basic details to define the project
                  </p>
                  <p className="mb-5 text-xs text-[#8a90b3]">
                    Fields marked with <span className="text-red-500">*</span> are mandatory.
                  </p>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Project ID <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.projectId}
                        onChange={(e) => setField("projectId", e.target.value)}
                        placeholder='For example: "P-1024"'
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Customer Email <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="email"
                        value={form.customerEmail}
                        onChange={(e) => setField("customerEmail", e.target.value)}
                        placeholder="Enter customer email"
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Customer Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setField("customerName", e.target.value)}
                        placeholder="Enter customer name"
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Design Lead Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.designLeadName}
                        onChange={(e) => setField("designLeadName", e.target.value)}
                        placeholder="Enter design lead name"
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Designer Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.designerName}
                        onChange={(e) => setField("designerName", e.target.value)}
                        placeholder="Enter designer name"
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        PM Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.pmName}
                        onChange={(e) => setField("pmName", e.target.value)}
                        placeholder="Enter PM name"
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        SPM Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.spmName}
                        onChange={(e) => setField("spmName", e.target.value)}
                        placeholder="Enter SPM name"
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Estimate value <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={form.estimateValue}
                        onChange={(e) => setField("estimateValue", e.target.value)}
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      >
                        <option value="" disabled>
                          Choose
                        </option>
                        {estimateOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Project configuration <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={form.projectConfiguration}
                        onChange={(e) => setField("projectConfiguration", e.target.value)}
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      >
                        <option value="" disabled>
                          Choose
                        </option>
                        {configurationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-[#353a5b]">
                        Design Approval Date <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="date"
                        value={form.designApprovalDate}
                        onChange={(e) => setField("designApprovalDate", e.target.value)}
                        required
                        className="w-full rounded-lg border border-[#d8dcef] bg-white px-3 py-2.5 text-[#1f2544] outline-none transition focus:border-[#6e67f6] focus:ring-2 focus:ring-[#d8d4ff]"
                      />
                    </label>
                  </div>

                  <div className="mt-6">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-md bg-gradient-to-r from-[#645ff3] to-[#4d73ff] px-8 py-2.5 text-sm font-semibold tracking-wide text-white shadow hover:opacity-95"
                    >
                      {submitting ? "SENDING..." : "SAVE & NEXT"}
                    </button>
                    {submitMessage && (
                      <p className="mt-3 text-sm text-[#2f3354]">{submitMessage}</p>
                    )}
                  </div>
                </div>
              </section>

            </form>
          </div>
        </div>
      </div>
    </main>
  );
}