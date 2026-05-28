"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getApiBase } from "@/app/lib/apiBase";
import { z } from "zod";
import { SalesClosureFormType } from "./Type";
import { salesClosureSchema } from "./Type";
import { BRANCH_OPTIONS, PROJECT_STATUS } from "../../constants/branches";
import {
  BookingType,
  PropertyConfig,
  PaymentReceived,
  PaymentMode,
  LeadSource,
} from "./Enums";

function getTodayDateValue() {
  return new Date().toISOString().split("T")[0];
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function paymentReceivedFromAmount(
  totalPaidCumulative: number,
  summary: QuotePaymentSummary | null,
): PaymentReceived | "" {
  if (!summary || totalPaidCumulative <= 0) return "";
  return totalPaidCumulative >= summary.tenPercentAmount
    ? PaymentReceived.FULL_10
    : PaymentReceived.TOKEN;
}

type QuotePaymentSummary = {
  quoteId: number | null;
  quoteNum: string | null;
  totalPayableAmount: number;
  tenPercentAmount: number;
  /** Sum of all payments recorded on this lead toward 10%. */
  totalPaidToward10PercentPreviously: number;
};

function buildInitialFormState(): SalesClosureFormType {
  return {
    externalReferenceId: "",
    sales_lead_name: "",
    sales_spoc: "",
    sales_email: "",
    customer_name: "",
    co_no: "",
    email: "",
    property_name: "",
    possession: "",
    lead_source: "",
    property_configuration: "",
    experience_center: "",
    site_address: "",
    booking_date: getTodayDateValue(),
    booking_type: "",
    spot_booking: false,
    designer_name: "",
    designer_lead: "",
    order_value: 0,
    dis_on_woodwork: 0,
    dis_on_service: 0,
    dis_on_accessories: 0,
    hub_coins: 0,
    complimentary_offer: 0,
    payment_received: "",
    amount_paid: 0,
    mode_of_payment: "",
    payment_screenshot: "",
    status_of_project: PROJECT_STATUS,
    special_offer: "",
    custom_commitments: "",
    timeline_promise_by_sales: "",
    scope_frozen: "",
    approval_proof: "",
  };
}

export default function SalesClosureForm() {
  const router = useRouter();
  type PercentField =
    | "dis_on_woodwork"
    | "dis_on_service"
    | "dis_on_accessories";
  type Designer = { id: number; name: string; role: string; leadName: string };
  type SalesPerson = { id: number; fullName: string | null; username: string; email?: string };
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [salesManagers, setSalesManagers] = useState<SalesPerson[]>([]);
  const [salesAdmins, setSalesAdmins] = useState<SalesPerson[]>([]);

  // Edit mode: activated when salesperson fetches an existing lead by ID
  const [isEditMode, setIsEditMode] = useState(false);
  const [fetchedLeadId, setFetchedLeadId] = useState<number | null>(null);
  const [leadIdInput, setLeadIdInput] = useState("");
  const [fetchingLead, setFetchingLead] = useState(false);
  const [fetchLeadError, setFetchLeadError] = useState<string | null>(null);
  const [quotePaymentSummary, setQuotePaymentSummary] = useState<QuotePaymentSummary | null>(null);
  const [quotePaymentLoading, setQuotePaymentLoading] = useState(false);
  const [quotePaymentError, setQuotePaymentError] = useState<string | null>(null);
  const [amountPaidInput, setAmountPaidInput] = useState("0");
  // Track sales lead & SPOC emails for rejection email CC (stored separately in payload)
  const [salesLeadEmail, setSalesLeadEmail] = useState("");
  const [salesSpocEmail, setSalesSpocEmail] = useState("");

  useEffect(() => {
    fetch(`${getApiBase()}/api/designers`)
      .then((res) => res.json())
      .then((data: Designer[]) => {
        if (Array.isArray(data)) setDesigners(data);
      })
      .catch(() => {});

    fetch(`${getApiBase()}/api/sales-managers`)
      .then((res) => res.json())
      .then((data: SalesPerson[]) => {
        if (Array.isArray(data)) setSalesManagers(data);
      })
      .catch(() => {});

    fetch(`${getApiBase()}/api/sales-admins`)
      .then((res) => res.json())
      .then((data: SalesPerson[]) => {
        if (Array.isArray(data)) setSalesAdmins(data);
      })
      .catch(() => {});
  }, []);

  const designerName = designers
    .filter((d) => d.role === "designer")
    .map((d) => d.name);
  const designerLeadName = designers
    .filter((d) => d.role === "design_manager")
    .map((d) => d.name);

  const [currentDateTime, setCurrentDateTime] = useState("");

  useEffect(() => {
    const now = new Date();

    const formatted = now.toLocaleString();
    // Example: 19/02/2026, 11:32:45 am

    setCurrentDateTime(formatted);
  }, []);

  const [errors, setErrors] = useState<
    Partial<Record<keyof SalesClosureFormType, string>>
  >({});

  const searchParams = useSearchParams();
  const [form, setForm] = useState<SalesClosureFormType>(buildInitialFormState);

  // Pre-fill form from CRM URL query parameters on first load
  useEffect(() => {
    const get = (key: string) => searchParams.get(key)?.trim() ?? "";

    // Try the JSON prefill blob first, then fall back to individual params
    const prefillRaw = get("prefill") || get("salesClosurePrefill");
    let blob: Record<string, string> = {};
    if (prefillRaw) {
      try { blob = JSON.parse(prefillRaw) as Record<string, string>; } catch { /* ignore */ }
    }
    const p = (key: string) => blob[key]?.trim() || get(key);

    const customer_name         = p("customer_name");
    const co_no                 = p("co_no");
    const email                 = p("email");
    const property_name         = p("property_name");
    const possession            = p("possession");
    const lead_source           = p("lead_source");
    const property_configuration = p("property_configuration");
    const sales_email           = p("sales_email");
    const experience_center     = p("experience_center");
    const sales_lead_name       = p("sales_lead_name");
    const designer_name         = p("designer_name");
    const lead_id               = p("lead_id") || p("leadId");

    if (lead_id) setLeadIdInput(lead_id);
    const externalReferenceId   = p("externalReferenceId");

    // Only update state if the CRM actually sent data
    if (customer_name || co_no || email || sales_email || property_name || externalReferenceId) {
      setForm((prev) => ({
        ...prev,
        ...(externalReferenceId   && { externalReferenceId }),
        ...(customer_name         && { customer_name }),
        ...(co_no                 && { co_no }),
        ...(email                 && { email }),
        ...(property_name         && { property_name }),
        ...(possession            && { possession }),
        ...(lead_source           && { lead_source }),
        ...(property_configuration && { property_configuration: property_configuration as PropertyConfig }),
        ...(sales_email           && { sales_email }),
        ...(experience_center     && { experience_center }),
        ...(sales_lead_name       && { sales_lead_name }),
        ...(designer_name         && { designer_name }),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leadIdForQuote =
    fetchedLeadId ??
    (() => {
      const raw =
        searchParams.get("lead_id")?.trim() ||
        searchParams.get("leadId")?.trim() ||
        "";
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n >= 1 ? n : null;
    })();

  useEffect(() => {
    if (!leadIdForQuote) {
      setQuotePaymentSummary(null);
      setQuotePaymentError(null);
      setQuotePaymentLoading(false);
      return;
    }

    let cancelled = false;
    setQuotePaymentLoading(true);
    setQuotePaymentError(null);

    fetch(
      `${getApiBase()}/api/sales-closure/lead/${encodeURIComponent(String(leadIdForQuote))}/quote-payment-summary`,
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (data && typeof data === "object" && "message" in data && typeof data.message === "string"
              ? data.message
              : null) || "Could not load quotation amount",
          );
        }
        return data as {
          totalPayableAmount?: number;
          tenPercentAmount?: number;
          totalPaidToward10Percent?: number;
          quoteId?: number | null;
          quoteNum?: string | null;
        };
      })
      .then((data) => {
        if (cancelled) return;
        const total = Number(data.totalPayableAmount);
        const ten = Number(data.tenPercentAmount);
        if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(ten)) {
          throw new Error("Invalid quotation total from server");
        }
        const prevPaid = Number(data.totalPaidToward10Percent);
        setQuotePaymentSummary({
          totalPayableAmount: total,
          tenPercentAmount: ten,
          quoteId:
            data.quoteId != null && Number.isFinite(Number(data.quoteId))
              ? Number(data.quoteId)
              : null,
          quoteNum: data.quoteNum?.trim() || null,
          totalPaidToward10PercentPreviously:
            Number.isFinite(prevPaid) && prevPaid >= 0 ? prevPaid : 0,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setQuotePaymentSummary(null);
        setQuotePaymentError(
          err instanceof Error ? err.message : "Could not load quotation amount",
        );
      })
      .finally(() => {
        if (!cancelled) setQuotePaymentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadIdForQuote]);

  const thisPayment = form.amount_paid;
  const previouslyPaid = quotePaymentSummary?.totalPaidToward10PercentPreviously ?? 0;
  const totalPaidCumulative = previouslyPaid + thisPayment;
  const paymentStats = quotePaymentSummary
    ? {
        percentOfTotal:
          totalPaidCumulative > 0
            ? (totalPaidCumulative / quotePaymentSummary.totalPayableAmount) * 100
            : 0,
        percentOfTenPercentTarget:
          totalPaidCumulative > 0
            ? (totalPaidCumulative / quotePaymentSummary.tenPercentAmount) * 100
            : 0,
        remainingForTenPercent: Math.max(
          0,
          quotePaymentSummary.tenPercentAmount - totalPaidCumulative,
        ),
        tenPercentMet: totalPaidCumulative >= quotePaymentSummary.tenPercentAmount,
      }
    : null;

  useEffect(() => {
    if (!quotePaymentSummary) return;
    const auto = paymentReceivedFromAmount(totalPaidCumulative, quotePaymentSummary);
    if (auto === form.payment_received) return;
    setForm((prev) => ({ ...prev, payment_received: auto }));
    setErrors((prev) => {
      if (!prev.payment_received) return prev;
      const next = { ...prev };
      delete next.payment_received;
      return next;
    });
  }, [quotePaymentSummary, totalPaidCumulative, form.payment_received]);

  const [percentInputs, setPercentInputs] = useState<
    Record<PercentField, string>
  >({
    dis_on_woodwork: "0",
    dis_on_service: "0",
    dis_on_accessories: "0",
  });

  function updateFields<K extends keyof SalesClosureFormType>(
    name: K,
    value: SalesClosureFormType[K],
  ) {
    setForm((prev) => ({ ...prev, [name]: value }));

    //  validate only that field (live)
    const fieldSchema = salesClosureSchema.shape[name] as z.ZodTypeAny;
    const result = fieldSchema.safeParse(value);

    // set or clear error
    setErrors((prev) => {
      const next = { ...prev };

      if (!result.success) {
        next[name] = result.error.issues[0]?.message || "Invalid value";
      } else {
        delete next[name];
      }

      return next;
    });
  }

  function handlePercentChange(field: PercentField, value: string) {
    if (!/^\d*\.?\d*$/.test(value)) return;

    setPercentInputs((prev) => ({ ...prev, [field]: value }));
    if (value === "" || value === ".") return;

    updateFields(field, Number(value));
  }

  function handlePercentBlur(field: PercentField) {
    const raw = percentInputs[field];
    if (raw === "" || raw === ".") {
      setPercentInputs((prev) => ({ ...prev, [field]: "0" }));
      updateFields(field, 0);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      setPercentInputs((prev) => ({ ...prev, [field]: String(parsed) }));
      updateFields(field, parsed);
    }
  }

  // Fetch an existing lead by internal Lead ID (for re-submission after finance rejection)
  async function handleFetchLead() {
    const leadId = leadIdInput.trim();
    if (!leadId) {
      setFetchLeadError("Please enter a Lead ID.");
      return;
    }
    setFetchingLead(true);
    setFetchLeadError(null);
    try {
      const res = await fetch(`${getApiBase()}/api/leads/${encodeURIComponent(leadId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Lead not found.");

      // data.payload is the parsed JSON from the DB
      const payload = data.payload && typeof data.payload === "object" ? data.payload : {};

      // Populate the form from the stored payload
      setForm((prev) => ({
        ...prev,
        sales_lead_name: payload.sales_lead_name || "",
        sales_spoc: payload.sales_spoc || "",
        sales_email: payload.sales_email || "",
        customer_name: payload.customer_name || data.projectName || "",
        co_no: payload.co_no || data.contactNo || "",
        email: payload.email || data.clientEmail || "",
        property_name: payload.property_name || "",
        possession: payload.possession || "",
        lead_source: payload.lead_source || "",
        property_configuration: payload.property_configuration || "",
        experience_center: payload.experience_center || "",
        site_address: payload.site_address || "",
        booking_date: payload.booking_date || getTodayDateValue(),
        booking_type: payload.booking_type || "",
        spot_booking: payload.spot_booking || false,
        designer_name: payload.designer_name || "",
        designer_lead: payload.designer_lead || "",
        order_value: payload.order_value || 0,
        dis_on_woodwork: payload.dis_on_woodwork || 0,
        dis_on_service: payload.dis_on_service || 0,
        dis_on_accessories: payload.dis_on_accessories || 0,
        hub_coins: payload.hub_coins || 0,
        complimentary_offer: payload.complimentary_offer || 0,
        // Payment fields left blank so salesperson re-enters them
        payment_received: payload.payment_received || "",
        amount_paid: 0,
        mode_of_payment: payload.mode_of_payment || "",
        payment_screenshot: "",
        status_of_project: payload.status_of_project || PROJECT_STATUS,
        special_offer: payload.special_offer || "",
        custom_commitments: payload.custom_commitments || "",
        timeline_promise_by_sales: payload.timeline_promise_by_sales || "",
        scope_frozen: payload.scope_frozen || "",
        approval_proof: "",
        externalReferenceId: payload.externalReferenceId || payload.external_reference_id || "",
      }));
      setPercentInputs({
        dis_on_woodwork: String(payload.dis_on_woodwork || 0),
        dis_on_service: String(payload.dis_on_service || 0),
        dis_on_accessories: String(payload.dis_on_accessories || 0),
      });
      setAmountPaidInput("0");
      setSalesLeadEmail(String(payload.sales_lead_email || ""));
      setSalesSpocEmail(String(payload.sales_spoc_email || ""));

      setFetchedLeadId(data.id);  // store the DB lead id for the PUT request
      setIsEditMode(true);
    } catch (err) {
      setFetchLeadError(err instanceof Error ? err.message : "Failed to fetch lead.");
    } finally {
      setFetchingLead(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.special_offer.trim() !== "" && !form.approval_proof && !isEditMode) {
      alert("Approval proof is mandatory when special commitment is provided.");
      return;
    }

    if (
      form.payment_received &&
      (!Number.isFinite(thisPayment) || thisPayment <= 0)
    ) {
      alert("Please enter the amount for this payment.");
      return;
    }

    const targetLeadId = fetchedLeadId ?? leadIdForQuote;
    const usePut = Boolean(targetLeadId);

    const cumulativePaid = previouslyPaid + thisPayment;

    // Build payload; always include sales lead & SPOC emails for rejection CC
    const finalPayload = {
      ...form,
      sales_lead_email: salesLeadEmail || undefined,
      sales_spoc_email: salesSpocEmail || undefined,
      ...(quotePaymentSummary && thisPayment > 0
        ? {
            quotation_total: quotePaymentSummary.totalPayableAmount,
            ten_percent_target: quotePaymentSummary.tenPercentAmount,
            amount_paid_this_time: thisPayment,
            total_paid_toward_10_percent: cumulativePaid,
            amount_paid: cumulativePaid,
            payment_percent_of_quotation:
              (cumulativePaid / quotePaymentSummary.totalPayableAmount) * 100,
            remaining_for_10_percent: Math.max(
              0,
              quotePaymentSummary.tenPercentAmount - cumulativePaid,
            ),
            ten_percent_payment_met:
              cumulativePaid >= quotePaymentSummary.tenPercentAmount,
          }
        : {}),
      ...(!usePut ? { sales_closure_submitted_at: new Date().toISOString() } : {}),
      ...(usePut && previouslyPaid > 0
        ? { sales_closure_payment_added_at: new Date().toISOString() }
        : {}),
    };

    if (!isEditMode) {
      const result = salesClosureSchema.safeParse(form);
      if (!result.success) {
        alert("Form validation failed: " + result.error.message);
        return;
      }
    }

    console.log(isEditMode ? "Updating payload:" : "Sending payload:", finalPayload);

    try {
      const url = usePut
        ? `${getApiBase()}/api/sales-closure/${targetLeadId}`
        : `${getApiBase()}/api/sales-closure`;
      const method = usePut ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });

      const text = await res.text();
      let data2: unknown = {};
      try {
        data2 = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Invalid response from server");
      }
      console.log("Response:", data2);

      const responseData =
        data2 && typeof data2 === "object"
          ? (data2 as { success?: boolean; message?: string })
          : {};
      if (!res.ok || responseData.success === false) {
        throw new Error(
          responseData.message || "Failed to submit sales closure.",
        );
      }

      localStorage.setItem(
        "sales_closure_response",
        JSON.stringify(responseData),
      );

      // navigate only after success
      router.push("/SalesClosure/Review");
    } catch (err) {
      console.error("Network error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Network error: Backend server is not reachable.";
      alert(message);
    }
  }

  function handleCancel() {
    const resetForm = buildInitialFormState();
    setForm(resetForm);
    setPercentInputs({
      dis_on_woodwork: String(resetForm.dis_on_woodwork),
      dis_on_service: String(resetForm.dis_on_service),
      dis_on_accessories: String(resetForm.dis_on_accessories),
    });
    setAmountPaidInput(String(resetForm.amount_paid));
    setErrors({});
  }

  return (
    <main className="min-h-screen bg-purple-50 p-6">
      {/* CRM Lead ID search bar — above the form, for re-submission after rejection */}
      <div className="mx-auto max-w-6xl mb-4">
        <div className="bg-white rounded-2xl border border-dashed border-green-950 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-950 mb-0.5">
              Re-submitting after payment rejection?
            </p>
            <p className="text-xs text-gray-500">Enter your Lead ID to auto-fill the form. Only payment fields will be editable.</p>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <input
              className="border rounded-lg px-3 py-2 text-green-950 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-950"
              type="text"
              placeholder="Lead ID"
              value={leadIdInput}
              onChange={(e) => {
                setLeadIdInput(e.target.value);
                setFetchLeadError(null);
                if (!e.target.value) {
                  setIsEditMode(false);
                  setFetchedLeadId(null);
                }
              }}
              disabled={fetchingLead}
            />
            <button
              type="button"
              onClick={handleFetchLead}
              disabled={fetchingLead || !leadIdInput}
              className="px-4 py-2 rounded-lg bg-green-950 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60"
            >
              {fetchingLead ? 'Fetching…' : 'Fetch Lead'}
            </button>
          </div>
          {fetchLeadError && <p className="text-red-500 text-xs sm:text-sm sm:ml-2">{fetchLeadError}</p>}
          {isEditMode && (
            <p className="text-green-700 text-xs font-medium sm:ml-2">
              ✓ Lead loaded — only payment fields are editable.
            </p>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-6xl bg-slate-900 rounded-2xl shadow-md overflow-hidden border border-3 border-gray-400">
        {/* 2 Column Layout */}
        <div className="grid grid-cols-12">
          {/* LEFT (Static / Sticky) */}
          <aside className="col-span-12 lg:col-span-5 border-r p-6 lg:sticky lg:top-0 lg:h-screen overflow-y-auto">
            {/* Sales Detail */}
            <div className="p-4 rounded-2xl border border-2 border-gray-300 mb-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
              <h2 className="text-lg font-semibold mb-3 text-green-950">
                Sales Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-green-950 font-medium mb-1 ">
                    Sales Mail Id
                  </label>
                  <input
                    className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                    type="email"
                    value={form.sales_email}
                    onChange={(e) =>
                      updateFields("sales_email", e.target.value)
                    }
                  />
                  {errors.sales_email && (
                    <p className="text-red-500 text-sm">{errors.sales_email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-green-950 font-medium mb-1">
                    Date & Time
                  </label>
                  <input
                    className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                    type="text"
                    readOnly
                    value={currentDateTime}
                  />
                </div>
              </div>
            </div>
            {/* Customer Detail */}
            <div className="p-4 rounded-2xl border border-2 border-gray-300 bg-purple-50">
              <h2 className="text-lg font-semibold mb-3 text-green-950">
                Customer Details
              </h2>

              <div style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                <div className=" mb-2">
                  <label className="block text-sm font-medium mb-1 text-green-950">
                    CustomerName
                  </label>
                  <input
                    className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    type="text"
                    value={form.customer_name}
                    disabled={isEditMode}
                    onChange={(e) =>
                      updateFields("customer_name", e.target.value)
                    }
                  />
                  {errors.customer_name && (
                    <p className="text-red-500 text-sm">{errors.customer_name}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      ContactNo.
                    </label>
                    <input
                      className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      type="tel"
                      inputMode="numeric"
                      value={form.co_no}
                      maxLength={10}
                      disabled={isEditMode}
                      onChange={(e) =>
                        updateFields(
                          "co_no",
                          e.target.value.replace(/\D/g, "").slice(0, 10),
                        )
                      }
                    />
                    {errors.co_no && (
                      <p className="text-red-500 text-sm">{errors.co_no}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Email
                    </label>
                    <input
                      className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      type="email"
                      value={form.email}
                      disabled={isEditMode}
                      onChange={(e) => updateFields("email", e.target.value)}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-sm">{errors.email}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Property Name
                    </label>
                    <input
                      className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      type="text"
                      value={form.property_name}
                      disabled={isEditMode}
                      onChange={(e) =>
                        updateFields("property_name", e.target.value)
                      }
                    />
                    {errors.property_name && (
                      <p className="text-red-500 text-sm">
                        {errors.property_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Possession
                    </label>
                    <input
                      className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      type="text"
                      value={form.possession}
                      disabled={isEditMode}
                      onChange={(e) => updateFields("possession", e.target.value)}
                    />
                    {errors.possession && (
                      <p className="text-red-500 text-sm">{errors.possession}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-green-950 font-medium mb-1">
                    Lead Source
                  </label>
                  <input
                    className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    type="text"
                    value={form.lead_source}
                    disabled={isEditMode}
                    onChange={(e) => updateFields("lead_source", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </aside>
          <section className="col-span-12 lg:col-span-7 p-6 lg:h-screen lg:overflow-y-auto">
            <form className="space-y-5">
              {/* Customer Info */}
              <div className="p-4 rounded-2xl border border-2 border-gray-300 space-y-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                <h2 className="text-lg text-green-950 font-semibold mb-3">
                  Customer Info
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Property Configuration
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.property_configuration}
                      onChange={(e) =>
                        updateFields(
                          "property_configuration",
                          e.target.value as PropertyConfig,
                        )
                      }
                    >
                      <option value="">Select Option</option>
                      {Object.values(PropertyConfig).map((config) => (
                        <option key={config} value={config}>
                          {config}
                        </option>
                      ))}
                    </select>
                    {errors.property_configuration && (
                      <p className="text-red-500 text-sm">
                        {errors.property_configuration}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Experience Center
                    </label>
                    <select
                      value={form.experience_center}
                      onChange={(e) =>
                        updateFields("experience_center", e.target.value)
                      }
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      required
                    >
                      <option value="">Select Experience Center</option>
                      {BRANCH_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {errors.experience_center && (
                      <p className="text-red-500 text-sm">
                        {errors.experience_center}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-green-950 font-medium mb-1">
                    Site Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter Addres..."
                    className="w-full border border-gray-300 rounded p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                    value={form.site_address}
                    onChange={(e) =>
                      updateFields("site_address", e.target.value)
                    }
                  ></textarea>
                  {errors.site_address && (
                    <p className="text-red-500 text-sm">
                      {errors.site_address}
                    </p>
                  )}
                </div>
              </div>
              {/* Booking Details */}
              <div className="p-4 rounded-2xl border border-2 border-gray-300 space-y-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                <h2 className="text-lg text-green-950 font-semibold mb-3">
                  Booking Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Booking Date
                    </label>
                    <input
                      className="w-full border rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      type="date"
                      value={form.booking_date}
                      onChange={(e) => {
                        const selectDate = e.target.value;
                        updateFields("booking_date", selectDate);
                      }}
                    />
                    {errors.booking_date && (
                      <p className="text-red-500 text-sm">
                        {errors.booking_date}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Booking Type
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.booking_type}
                      onChange={(e) =>
                        updateFields(
                          "booking_type",
                          e.target.value as BookingType,
                        )
                      }
                    >
                      <option value="">Select Type</option>
                      {Object.values(BookingType).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.booking_type && (
                      <p className="text-red-500 text-sm">
                        {errors.booking_type}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-green-950 font-medium mb-1">
                    Is this Spot Booking Order?
                  </label>
                  <input
                    className="w-4 h-4 border rounded-lg p-10"
                    type="checkbox"
                    checked={form.spot_booking}
                    onChange={(e) =>
                      updateFields("spot_booking", e.target.checked)
                    }
                  />
                </div>
              </div>
              {/* TEAM ASSIGNMENT */}
              <div className="p-4 rounded-2xl border border-2 border-gray-300 space-y-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                <h2 className="text-lg text-green-950 font-semibold mb-3">
                  Team Assignment
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Designer Name
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.designer_name}
                      onChange={(e) => {
                        const name = e.target.value;
                        updateFields("designer_name", name);
                        const match = designers.find(
                          (d) => d.role === "designer" && d.name === name,
                        );
                        if (match && match.leadName) {
                          updateFields("designer_lead", match.leadName);
                        } else {
                          updateFields("designer_lead", "");
                        }
                      }}
                    >
                      <option value="">Select Designer</option>
                      {designerName.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {errors.designer_name && (
                      <p className="text-red-500 text-sm">
                        {errors.designer_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Design Manager
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.designer_lead}
                      onChange={(e) =>
                        updateFields("designer_lead", e.target.value)
                      }
                    >
                      <option value="">Select Design Manager</option>
                      {designerLeadName.map((lead) => (
                        <option key={lead} value={lead}>
                          {lead}
                        </option>
                      ))}
                    </select>
                    {errors.designer_lead && (
                      <p className="text-red-500 text-sm">
                        {errors.designer_lead}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Sales Lead Name
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={form.sales_lead_name}
                      disabled={isEditMode}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        updateFields("sales_lead_name", selectedName);
                        // Capture email for rejection CC
                        const match = salesManagers.find(
                          (m) => (m.fullName || m.username) === selectedName
                        );
                        setSalesLeadEmail(match?.email || "");
                      }}
                    >
                      <option value="">Select Sales Lead</option>
                      {salesManagers.map((m) => (
                        <option key={m.id} value={m.fullName || m.username}>
                          {m.fullName || m.username}
                        </option>
                      ))}
                    </select>
                    {errors.sales_lead_name && (
                      <p className="text-red-500 text-sm">
                        {errors.sales_lead_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Sales SPOC
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={form.sales_spoc}
                      disabled={isEditMode}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        updateFields("sales_spoc", selectedName);
                        // Capture email for rejection CC
                        const match = salesAdmins.find(
                          (a) => (a.fullName || a.username) === selectedName
                        );
                        setSalesSpocEmail(match?.email || "");
                      }}
                    >
                      <option value="">Select Sales SPOC</option>
                      {salesAdmins.map((a) => (
                        <option key={a.id} value={a.fullName || a.username}>
                          {a.fullName || a.username}
                        </option>
                      ))}
                    </select>
                    {errors.sales_spoc && (
                      <p className="text-red-500 text-sm">
                        {errors.sales_spoc}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* COMMERCIAL DETAILS */}
              <div className="p-4 rounded-2xl border border-2 border-gray-300 mb-4 space-y-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                <h2 className="text-lg text-green-950 font-semibold mb-3">
                  Commercial Details
                </h2>
                <div className="mb-2">
                  <label className="block text-sm text-green-950 font-medium mb-1">
                    Order Value (Original)
                  </label>
                  <input
                    type="text"
                    min="0"
                    placeholder="Enter amount"
                    className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-950"
                    value={form.order_value}
                    onChange={(e) =>
                      updateFields("order_value", Number(e.target.value))
                    }
                  />
                  {errors.order_value && (
                    <p className="text-red-500 text-sm">{errors.order_value}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1 text-green-950">
                      Discount on Woodwork%
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter Discount"
                      className="w-full border border-gray-300 rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={percentInputs.dis_on_woodwork}
                      onChange={(e) =>
                        handlePercentChange("dis_on_woodwork", e.target.value)
                      }
                      onBlur={() => handlePercentBlur("dis_on_woodwork")}
                    />
                    {errors.dis_on_woodwork && (
                      <p className="text-red-500 text-sm">
                        {errors.dis_on_woodwork}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Discount on Services%
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter Discount"
                      className="w-full border border-gray-300 rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={percentInputs.dis_on_service}
                      onChange={(e) =>
                        handlePercentChange("dis_on_service", e.target.value)
                      }
                      onBlur={() => handlePercentBlur("dis_on_service")}
                    />
                    {errors.dis_on_service && (
                      <p className="text-red-500 text-sm">
                        {errors.dis_on_service}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Discount on Accessories%
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter Discount"
                      className="w-full border border-gray-300 rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={percentInputs.dis_on_accessories}
                      onChange={(e) =>
                        handlePercentChange(
                          "dis_on_accessories",
                          e.target.value,
                        )
                      }
                      onBlur={() => handlePercentBlur("dis_on_accessories")}
                    />
                    {errors.dis_on_accessories && (
                      <p className="text-red-500 text-sm">
                        {errors.dis_on_accessories}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      HUB Coins If Applied (₹)
                    </label>
                    <input
                      type="text"
                      min="0"
                      placeholder="Enter Amount"
                      className="w-full border border-gray-300 rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.hub_coins}
                      onChange={(e) =>
                        updateFields("hub_coins", Number(e.target.value))
                      }
                    />
                    {errors.hub_coins && (
                      <p className="text-red-500 text-sm">{errors.hub_coins}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Complimentary Offered
                    </label>
                    <input
                      type="text"
                      min="0"
                      placeholder="Enter Offer"
                      className="w-full border border-gray-300 rounded-lg p-2 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.complimentary_offer}
                      onChange={(e) =>
                        updateFields(
                          "complimentary_offer",
                          Number(e.target.value),
                        )
                      }
                    />
                    {errors.complimentary_offer && (
                      <p className="text-red-500 text-sm">
                        {errors.complimentary_offer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {/* PAYMENT DETAILS */}
              <div className="p-4 rounded-2xl border border-2 border-gray-300 space-y-4 bg-purple-50">
                <h2 className="text-lg text-green-950 font-semibold mb-3">
                  Payment Details
                </h2>
                <div className="rounded-xl border border-green-900/20 bg-white px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-green-950">
                    10% payment amount (from latest quotation)
                  </p>
                  {quotePaymentLoading && (
                    <p className="text-sm text-gray-500">Loading quotation total…</p>
                  )}
                  {!quotePaymentLoading && quotePaymentSummary && paymentStats && (
                    <>
                      <p className="text-2xl font-semibold text-green-950">
                        {formatInr(quotePaymentSummary.tenPercentAmount)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Latest quotation total:{" "}
                        {formatInr(quotePaymentSummary.totalPayableAmount)}
                        {quotePaymentSummary.quoteNum
                          ? ` · Quote ${quotePaymentSummary.quoteNum}`
                          : quotePaymentSummary.quoteId
                            ? ` · Quote #${quotePaymentSummary.quoteId}`
                            : ""}
                      </p>
                      <div className="mt-3 pt-3 border-t border-green-900/15 space-y-1.5">
                        {previouslyPaid > 0 && (
                          <p className="text-sm text-green-950">
                            <span className="font-medium">Already paid (recorded):</span>{" "}
                            {formatInr(previouslyPaid)}
                          </p>
                        )}
                        {thisPayment > 0 && (
                          <p className="text-sm text-green-950">
                            <span className="font-medium">This payment:</span>{" "}
                            {formatInr(thisPayment)}
                          </p>
                        )}
                        {(previouslyPaid > 0 || thisPayment > 0) && (
                          <p className="text-sm text-green-950">
                            <span className="font-medium">Total toward 10%:</span>{" "}
                            {formatInr(totalPaidCumulative)}
                          </p>
                        )}
                        {paymentStats.tenPercentMet ? (
                          <p className="text-sm font-semibold text-teal-800">
                            10% complete — no balance remaining
                          </p>
                        ) : (
                          <p className="text-base font-semibold text-amber-800">
                            Remaining of 10%:{" "}
                            {formatInr(paymentStats.remainingForTenPercent)}
                          </p>
                        )}
                        {totalPaidCumulative > 0 && (
                          <p className="text-xs text-gray-600">
                            {formatPercent(paymentStats.percentOfTenPercentTarget)} of 10%
                            collected · {formatPercent(paymentStats.percentOfTotal)} of full
                            quotation
                          </p>
                        )}
                        {previouslyPaid === 0 && thisPayment === 0 && (
                          <p className="text-xs text-gray-500">
                            Enter this payment below. Remaining starts at the full 10% amount.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  {!quotePaymentLoading && !quotePaymentSummary && (
                    <p className="text-sm text-gray-500">
                      {leadIdForQuote
                        ? quotePaymentError ||
                          "No quotation found for this lead yet. Create a project and get a quote first."
                        : "Enter a Lead ID above (or open this form with ?lead_id=) after a quote exists to see the 10% amount."}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-green-950">
                    This payment (₹)
                  </label>
                  {previouslyPaid > 0 && (
                    <p className="text-xs text-gray-600 mb-1.5">
                      Customer already paid {formatInr(previouslyPaid)} toward 10%. Enter only the
                      new amount received now.
                    </p>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Enter amount for this payment"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                    value={amountPaidInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw !== "" && !/^\d*\.?\d*$/.test(raw.replace(/,/g, ""))) {
                        return;
                      }
                      setAmountPaidInput(raw);
                      const parsed = parseAmountInput(raw);
                      if (parsed != null) updateFields("amount_paid", parsed);
                      else if (raw === "") updateFields("amount_paid", 0);
                    }}
                    onBlur={() => {
                      const parsed = parseAmountInput(amountPaidInput);
                      if (parsed == null || amountPaidInput.trim() === "") {
                        setAmountPaidInput("0");
                        updateFields("amount_paid", 0);
                        return;
                      }
                      setAmountPaidInput(String(parsed));
                      updateFields("amount_paid", parsed);
                    }}
                  />
                  {errors.amount_paid && (
                    <p className="text-red-500 text-sm mt-1">{errors.amount_paid}</p>
                  )}
                  {paymentStats && thisPayment > 0 && (
                    <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-sm text-green-950 space-y-1">
                      <p>
                        After this payment, total toward 10%:{" "}
                        <span className="font-semibold">{formatInr(totalPaidCumulative)}</span>
                      </p>
                      <p>
                        <span className="font-medium">Still remaining of 10%:</span>{" "}
                        {formatInr(paymentStats.remainingForTenPercent)}
                      </p>
                    </div>
                  )}
                  {!quotePaymentSummary && thisPayment > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Load a lead with a quotation to see percentage and remaining 10% amount.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-green-950">
                      Payment Received
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={form.payment_received}
                      disabled={!!quotePaymentSummary}
                      onChange={(e) =>
                        updateFields(
                          "payment_received",
                          e.target.value as PaymentReceived,
                        )
                      }
                    >
                      <option value="">Select</option>
                      {Object.values(PaymentReceived).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {quotePaymentSummary && (
                      <p className="text-xs text-gray-500 mt-1">
                        Auto-set: TOKEN if below 10% of quotation, FULL_10% when 10% or more is paid.
                      </p>
                    )}
                    {errors.payment_received && (
                      <p className="text-red-500 text-sm">
                        {errors.payment_received}
                      </p>
                    )}
                  </div>
                  {/* <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="manager"
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-800">Yes</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="manager"
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-800">No</span>
                      </label>
                    </div>
                  </div> */}
                  <div>
                    <label className="block text-sm text-green-950 font-medium mb-1">
                      Mode of Payment
                    </label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-green-950 focus:outline-none focus:ring-2 focus:ring-green-950"
                      value={form.mode_of_payment}
                      onChange={(e) =>
                        updateFields(
                          "mode_of_payment",
                          e.target.value as PaymentMode,
                        )
                      }
                    >
                      <option value="">Select</option>
                      {Object.values(PaymentMode).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    {errors.mode_of_payment && (
                      <p className="text-red-500 text-sm">
                        {errors.mode_of_payment}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-green-950 font-medium mb-1">
                    Payment Screenshot Upload
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const reader = new FileReader();

                      reader.onloadend = () => {
                        updateFields(
                          "payment_screenshot",
                          reader.result as string,
                        );
                      };

                      reader.readAsDataURL(file);
                    }}
                    className="block w-full text-sm text-gray-600
      file:mr-4 file:py-2 file:px-4
      file:rounded-lg file:border-0
      file:text-sm file:font-medium
      file:bg-gray-100 file:text-green-950
      hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-950"
                  />
                  {errors.payment_screenshot && (
                    <p className="text-red-500 text-sm">
                      {errors.payment_screenshot}
                    </p>
                  )}
                </div>
              </div>
              {/* PROJECT STATUS CONTROL */}
              <div className="p-4 rounded-2xl border border-2 border-gray-300 space-y-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                <h2 className="text-lg text-green-950 font-semibold mb-3">
                  Project status control
                </h2>
                <div>
                  <label className="block text-sm text-green-950 font-medium text-gray-700 mb-2">
                    Status of Project (System Controlled)
                  </label>
                  <input
                    type="text"
                    value={form.status_of_project}
                    readOnly
                    className="w-full border border-green-950 rounded-lg p-2 bg-purple-50 cursor-not-allowed"
                  />
                  {errors.status_of_project && (
                    <p className="text-red-500 text-sm">
                      {errors.status_of_project}
                    </p>
                  )}
                </div>
              </div>
              {/* Special Declaration(VERY IMPORTANT) */}
              <div className="border border-2 border-gray-300 rounded-2xl p-4 space-y-4 bg-purple-50" style={isEditMode ? {opacity:0.6, pointerEvents:'none'} : {}}>
                {/* Section Title */}
                <h2 className="text-lg font-semibold text-green-950">
                  Special Declaration
                </h2>

                {/* Special Offer */}
                <div>
                  <label className="block text-sm font-medium text-green-950 mb-2">
                    Any special offer given with approval? Mention clearly.
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter details if any..."
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-950 "
                    value={form.special_offer}
                    onChange={(e) =>
                      updateFields("special_offer", e.target.value)
                    }
                  />
                  {errors.special_offer && (
                    <p className="text-red-500 text-sm">
                      {errors.special_offer}
                    </p>
                  )}
                </div>

                {/* Custom Commitments */}
                <div>
                  <label className="block text-sm font-medium text-green-950 mb-2">
                    Any custom commitments made to customer?
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Mention any commitments..."
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-950 text-green-950"
                    value={form.custom_commitments}
                    onChange={(e) =>
                      updateFields("custom_commitments", e.target.value)
                    }
                  />
                  {errors.custom_commitments && (
                    <p className="text-red-500 text-sm">
                      {errors.custom_commitments}
                    </p>
                  )}
                </div>

                {/* Timeline Promised */}
                <div>
                  <label className="block text-sm font-medium text-green-950 mb-2">
                    Timeline promised by sales?
                  </label>
                  <input
                    type="text"
                    placeholder="Enter timeline (e.g., 30 Days)"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-950 text-green-950"
                    value={form.timeline_promise_by_sales}
                    onChange={(e) =>
                      updateFields("timeline_promise_by_sales", e.target.value)
                    }
                  />
                  {errors.timeline_promise_by_sales && (
                    <p className="text-red-500 text-sm">
                      {errors.timeline_promise_by_sales}
                    </p>
                  )}
                </div>

                {/* Scope Frozen */}
                <div>
                  <label className="block text-sm font-medium text-green-950 mb-2">
                    Is scope frozen and signed off?
                  </label>

                  <div className="flex items-center gap-6">
                    {/* YES */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scopeFrozen"
                        value={form.scope_frozen}
                        checked={form.scope_frozen === "YES"}
                        onChange={() => updateFields("scope_frozen", "YES")}
                        className="w-4 h-4 accent-green-700"
                      />
                      <span className="text-sm text-green-950">Yes</span>
                    </label>

                    {/* NO */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scopeFrozen"
                        value={form.scope_frozen}
                        checked={form.scope_frozen === "NO"}
                        onChange={() => updateFields("scope_frozen", "NO")}
                        className="w-4 h-4 accent-green-700"
                      />
                      <span className="text-sm text-green-950">No</span>
                    </label>
                  </div>
                </div>

                {/* Approval Proof Upload */}
                {form.special_offer.trim() !== "" && (
                  <div>
                    <label className="block text-sm font-medium text-green-950 mb-2">
                      Upload Approval Proof (Mandatory)
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onloadend = () => {
                          updateFields(
                            "approval_proof",
                            reader.result as string,
                          );
                        };

                        reader.readAsDataURL(file);
                      }}
                      className="block w-full text-sm text-gray-600
      file:mr-4 file:py-2 file:px-4
      file:rounded-lg file:border-0
      file:text-sm file:font-medium
      file:bg-gray-100 file:text-green-950
      hover:file:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-green-950"
                    />

                    <p className="mt-2 text-xs text-green-950">
                      Upload official approval document.
                    </p>
                    {errors.approval_proof && (
                      <p className="text-red-500 text-sm">
                        {errors.approval_proof}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </form>
          </section>
        </div>
        <div className="flex justify-end gap-4 pt-6 mb-5 mr-10">
          {/* Cancel Button */}
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2 rounded-lg border border-purple-50 text-purple-50 font-bold hover:bg-purple-50 hover:text-green-950 transition"
          >
            Cancel
          </button>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            type="submit"
            className="px-5 py-2 rounded-lg bg-purple-50 text-green-950 hover:bg-slate-900 hover:border hover:border-purple-50 hover:text-purple-50 transition font-bold"
          >
            {isEditMode ? 'Update' : 'Submit'}
          </button>
        </div>
      </div>
    </main>
  );
}
