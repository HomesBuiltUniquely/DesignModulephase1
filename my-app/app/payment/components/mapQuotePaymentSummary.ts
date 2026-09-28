import type { QuotePaymentSummary } from './MilestonePaymentSummary';

export function mapQuotePaymentSummaryFromApi(body: Record<string, unknown>): QuotePaymentSummary {
  return {
    quoteId: (body.quoteId as number | null) ?? null,
    quoteNum: (body.quoteNum as string | null) ?? null,
    totalPayableAmount: Number(body.totalPayableAmount) || 0,
    tenPercentAmount: Number(body.tenPercentAmount) || 0,
    twentyPercentTarget: Number(body.twentyPercentTarget) || Math.round((Number(body.totalPayableAmount) || 0) * 0.2),
    sixtyPercentTarget:
      Number(body.sixtyPercentTarget) || Math.round((Number(body.totalPayableAmount) || 0) * 0.6),
    fortyPercentAmount: Number(body.fortyPercentAmount) || 0,
    totalPaidCumulative: Number(body.totalPaidCumulative ?? body.totalPaidToward10Percent) || 0,
    totalPaidToward10Percent: Number(body.totalPaidToward10Percent) || 0,
    totalPaidToward40Percent: Number(body.totalPaidToward40Percent) || 0,
    previousTenPercentTarget:
      body.previousTenPercentTarget != null ? Number(body.previousTenPercentTarget) : null,
    previousTwentyPercentTarget:
      body.previousTwentyPercentTarget != null ? Number(body.previousTwentyPercentTarget) : null,
    previousSixtyPercentTarget:
      body.previousSixtyPercentTarget != null ? Number(body.previousSixtyPercentTarget) : null,
    previousFortyPercentTarget:
      body.previousFortyPercentTarget != null ? Number(body.previousFortyPercentTarget) : null,
    quotationTotalAtLastPayment:
      body.quotationTotalAtLastPayment != null ? Number(body.quotationTotalAtLastPayment) : null,
    amountToCollect10: Number(body.amountToCollect10) || 0,
    amountToCollect40: Number(body.amountToCollect40) || 0,
    design10Collected: Number(body.design10Collected) || 0,
    design10Target: Number(body.design10Target) || 0,
    design10PercentPaid: Number(body.design10PercentPaid) || 0,
    design40Collected: Number(body.design40Collected) || 0,
    design40Target: Number(body.design40Target) || 0,
    design40PercentPaid: Number(body.design40PercentPaid) || 0,
    quoteRevisionTopUp10: Number(body.quoteRevisionTopUp10) || 0,
    quoteRevisionTopUp40: Number(body.quoteRevisionTopUp40) || 0,
    remainingAfterTwentyPercent:
      Number(body.remainingAfterTwentyPercent ?? body.remainingAfterTenPercent) || 0,
    remainingAfterSixtyPercent:
      Number(body.remainingAfterSixtyPercent ?? body.remainingAfterFortyPercent) ||
      Math.max(0, (Number(body.totalPayableAmount) || 0) - (Number(body.sixtyPercentTarget) || 0)),
  };
}

/**
 * Parse API JSON for quote-payment-summary.
 * Returns null when soft-empty (`ok: false`) or totals are missing — never fake ₹0 rows.
 */
export function parseQuotePaymentSummaryResponse(
  body: Record<string, unknown>,
): { summary: QuotePaymentSummary | null; message: string | null } {
  if (body.ok === false) {
    return {
      summary: null,
      message:
        typeof body.message === 'string' && body.message.trim()
          ? body.message
          : 'No quotation found yet. Generate a quote in Prolance first.',
    };
  }

  const payload =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : body;

  const summary = mapQuotePaymentSummaryFromApi({
    ...payload,
    quoteId: payload.quoteId ?? payload.quote_id ?? body.quoteId,
    quoteNum: payload.quoteNum ?? payload.quote_num ?? body.quoteNum,
    totalPayableAmount:
      payload.totalPayableAmount ?? payload.total_payable_amount ?? body.totalPayableAmount,
    tenPercentAmount:
      payload.tenPercentAmount ?? payload.ten_percent_amount ?? body.tenPercentAmount,
    twentyPercentTarget:
      payload.twentyPercentTarget ?? payload.twenty_percent_target ?? body.twentyPercentTarget,
    sixtyPercentTarget:
      payload.sixtyPercentTarget ?? payload.sixty_percent_target ?? body.sixtyPercentTarget,
    fortyPercentAmount:
      payload.fortyPercentAmount ?? payload.forty_percent_amount ?? body.fortyPercentAmount,
    totalPaidCumulative:
      payload.totalPaidCumulative ??
      payload.total_paid_cumulative ??
      body.totalPaidCumulative ??
      payload.totalPaidToward10Percent ??
      body.totalPaidToward10Percent,
    totalPaidToward10Percent:
      payload.totalPaidToward10Percent ??
      payload.total_paid_toward_10_percent ??
      body.totalPaidToward10Percent,
    totalPaidToward40Percent:
      payload.totalPaidToward40Percent ??
      payload.total_paid_toward_40_percent ??
      body.totalPaidToward40Percent,
    amountToCollect10:
      payload.amountToCollect10 ?? payload.amount_to_collect_10 ?? body.amountToCollect10,
    amountToCollect40:
      payload.amountToCollect40 ?? payload.amount_to_collect_40 ?? body.amountToCollect40,
    design10Collected:
      payload.design10Collected ?? payload.design_10_collected ?? body.design10Collected,
    design10Target: payload.design10Target ?? payload.design_10_target ?? body.design10Target,
    design10PercentPaid:
      payload.design10PercentPaid ?? payload.design_10_percent_paid ?? body.design10PercentPaid,
    design40Collected:
      payload.design40Collected ?? payload.design_40_collected ?? body.design40Collected,
    design40Target: payload.design40Target ?? payload.design_40_target ?? body.design40Target,
    design40PercentPaid:
      payload.design40PercentPaid ?? payload.design_40_percent_paid ?? body.design40PercentPaid,
    remainingAfterTwentyPercent:
      payload.remainingAfterTwentyPercent ??
      payload.remaining_after_twenty_percent ??
      body.remainingAfterTwentyPercent,
    remainingAfterSixtyPercent:
      payload.remainingAfterSixtyPercent ??
      payload.remaining_after_sixty_percent ??
      body.remainingAfterSixtyPercent,
  });
  if (!(summary.totalPayableAmount > 0)) {
    return {
      summary: null,
      message:
        typeof body.message === 'string' && body.message.trim()
          ? body.message
          : 'No quotation found yet. Generate a quote in Prolance first.',
    };
  }

  return { summary, message: null };
}

/** Amount to prefill on Design 10% / 40% send-link. User may still edit. */
export function suggestedDesignCollectAmount(
  summary: QuotePaymentSummary | null,
  variant: '10' | '40',
): number | null {
  if (!summary || !(summary.totalPayableAmount > 0)) return null;
  if (variant === '10') {
    if (summary.amountToCollect10 > 0) return Math.round(summary.amountToCollect10);
    if (summary.totalPaidCumulative <= 0 && summary.tenPercentAmount > 0) {
      return Math.round(summary.tenPercentAmount);
    }
    return Math.round(summary.amountToCollect10);
  }
  if (summary.amountToCollect40 > 0) return Math.round(summary.amountToCollect40);
  if (summary.totalPaidCumulative <= 0 && summary.fortyPercentAmount > 0) {
    return Math.round(summary.fortyPercentAmount);
  }
  return Math.round(summary.amountToCollect40);
}
