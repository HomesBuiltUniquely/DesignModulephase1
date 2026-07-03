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
    quoteRevisionTopUp10: Number(body.quoteRevisionTopUp10) || 0,
    quoteRevisionTopUp40: Number(body.quoteRevisionTopUp40) || 0,
    remainingAfterTwentyPercent:
      Number(body.remainingAfterTwentyPercent ?? body.remainingAfterTenPercent) || 0,
    remainingAfterSixtyPercent:
      Number(body.remainingAfterSixtyPercent ?? body.remainingAfterFortyPercent) ||
      Math.max(0, (Number(body.totalPayableAmount) || 0) - (Number(body.sixtyPercentTarget) || 0)),
  };
}
