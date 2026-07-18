'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getApiBase, buildAuthHeaders } from '../lib/apiBase';
import {
  buildDayActivitySummary,
  buildDemoIncentivesForDesigner,
  buildTeamIncentivesSummary,
  canManageTeamIncentives,
  filterDealsByDate,
  formatInr,
  formatInrCompact,
  getCurrentCycleIndex,
  listFortnightOptions,
  type DealLedgerRow,
  type DesignerIncentivesData,
  type IncentiveMember,
  type IncentiveWeightStageId,
  type TeamIncentivesSummary,
} from '../lib/designerIncentives';

const JOURNEY_MARKS = [0, 40, 50, 60, 80, 100] as const;

type ViewMode = 'individual' | 'team';

type WeightedPartFilter = IncentiveWeightStageId;

const WEIGHTED_PART_META: Record<
  WeightedPartFilter,
  { short: string; title: string; accent: string; ring: string; selected: string }
> = {
  pre_d1_finance_10: {
    short: 'Part 1',
    title: 'Part 1 · Pre-D1 finance 10%',
    accent: 'text-emerald-800',
    ring: 'border-emerald-100 bg-emerald-50/50 hover:border-emerald-300',
    selected: 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50',
  },
  post_dqc1_design_10: {
    short: 'Part 2',
    title: 'Part 2 · Post-DQC1 design 10%',
    accent: 'text-sky-800',
    ring: 'border-sky-100 bg-sky-50/50 hover:border-sky-300',
    selected: 'border-sky-500 ring-2 ring-sky-200 bg-sky-50',
  },
  part3_forty_percent: {
    short: 'Part 3',
    title: 'Part 3 · 40% payment + upsale',
    accent: 'text-violet-800',
    ring: 'border-violet-100 bg-violet-50/50 hover:border-violet-300',
    selected: 'border-violet-500 ring-2 ring-violet-200 bg-violet-50',
  },
};

function dealsForWeightedPart(
  deals: DealLedgerRow[],
  stageId: WeightedPartFilter,
): Array<DealLedgerRow & { stageWeighted: number; stageUpsale: number }> {
  return deals
    .map((deal) => {
      const stage = deal.stages.find((s) => s.stageId === stageId && s.cleared);
      if (!stage) return null;
      return {
        ...deal,
        stageWeighted: stage.weightedAmount,
        stageUpsale: stage.upsaleAmount,
      };
    })
    .filter((d): d is DealLedgerRow & { stageWeighted: number; stageUpsale: number } => d != null);
}

function MetricCard({
  label,
  value,
  accent,
  badge,
}: {
  label: string;
  value: string;
  accent?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-white px-4 py-4 shadow-sm ${
        accent ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-gray-200'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex items-start gap-2">
        <p className={`text-xl font-bold tracking-tight ${accent ? 'text-emerald-600' : 'text-gray-900'}`}>
          {value}
        </p>
        {badge ? (
          <span className="mt-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function closureBadgeClass(kind: DealLedgerRow['closureTime']): string {
  if (kind === 'SAME DAY') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (kind === '48 HOURS') return 'bg-orange-50 text-orange-700 ring-orange-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function IncentiveJourney({
  achievementPct,
  currentSlabPct,
}: {
  achievementPct: number;
  currentSlabPct: number;
}) {
  const clamped = Math.min(100, Math.max(0, achievementPct));
  const markerLeft = Math.min(96, Math.max(4, clamped));
  const slabLabel =
    currentSlabPct > 0 ? `${currentSlabPct}% unlocked` : 'Below first slab (40%)';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800">Incentive Journey</h2>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Current slab:{' '}
          <span className={currentSlabPct > 0 ? 'text-emerald-600' : 'text-amber-600'}>
            {slabLabel}
          </span>
        </p>
      </div>

      <div className="relative mt-8 mb-2 px-1 pt-8 pb-10">
        <div className="relative h-3 w-full rounded-full bg-gray-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-all"
            style={{ width: `${clamped}%` }}
          />
          {JOURNEY_MARKS.map((m) => (
            <div
              key={m}
              className="absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${m}%` }}
            >
              <div
                className={`h-4 w-4 rounded-full border-2 bg-white ${
                  clamped >= m ? 'border-emerald-500' : 'border-gray-300'
                }`}
              />
            </div>
          ))}
        </div>

        <div
          className="absolute top-0 z-[2] -translate-x-1/2"
          style={{ left: `${markerLeft}%` }}
        >
          <div className="whitespace-nowrap rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase text-white shadow">
            You are here ({achievementPct}%)
          </div>
          <div className="mx-auto mt-1 h-4 w-0.5 bg-emerald-600" />
        </div>

        <div className="pointer-events-none absolute inset-x-1 bottom-0">
          {JOURNEY_MARKS.map((m) => (
            <span
              key={`label-${m}`}
              className={`absolute -translate-x-1/2 text-[11px] font-semibold ${
                clamped >= m ? 'text-emerald-700' : 'text-gray-500'
              }`}
              style={{ left: `${m}%` }}
            >
              {m}%
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function exportDealsCsv(deals: DealLedgerRow[], filename: string) {
  const header = [
    'Date',
    'Customer',
    'Quote (current)',
    'Quote (at finance 10%)',
    'Weighted revenue',
    'Weight %',
    'Part 1',
    'Part 2',
    'Part 3',
    'Upsale (P3)',
    'Closure Time',
    'Incentive',
  ];
  const rows = deals.map((d) => {
    const p1 = d.stages.find((s) => s.stageId === 'pre_d1_finance_10');
    const p2 = d.stages.find((s) => s.stageId === 'post_dqc1_design_10');
    const p3 = d.stages.find((s) => s.stageId === 'part3_forty_percent');
    return [
      d.activityDate,
      d.customerName,
      String(d.dealValue),
      String(d.quotationAtFinanceApproval),
      String(d.weightedRevenue),
      String(d.contributionPct),
      p1?.cleared ? String(p1.weightedAmount) : '0',
      p2?.cleared ? String(p2.weightedAmount) : '0',
      p3?.cleared ? String(p3.weightedAmount) : '0',
      p3 ? String(p3.upsaleAmount) : '0',
      d.closureTime,
      String(d.incentive),
    ].join(',');
  });
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTeamCsv(team: TeamIncentivesSummary) {
  const header = [
    'Designer',
    'Role',
    'Target',
    'Revenue',
    'Achievement %',
    'Meetings',
    'Meeting Gate',
    'Slab',
    'Incentive',
    'On-Spot Bonus',
  ];
  const rows = team.rows.map((r) =>
    [
      r.designerName,
      r.role,
      String(r.totalTarget),
      String(r.revenueAchieved),
      String(r.achievementPct),
      `${r.meetingsCompleted}/${r.meetingsRequired}`,
      r.meetingsEligible ? 'Eligible' : 'Locked',
      String(r.currentSlabPct),
      String(r.incentiveEarned),
      String(r.onSpotBonus),
    ].join(','),
  );
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'team-incentives.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function IndividualIncentivesPanel({
  data,
  subtitle,
  selectedDate,
}: {
  data: DesignerIncentivesData;
  subtitle?: string;
  selectedDate: string | null;
}) {
  const [selectedPart, setSelectedPart] = useState<WeightedPartFilter | null>(null);
  const visibleDeals = filterDealsByDate(data.deals, selectedDate);
  const dayActivity = selectedDate ? buildDayActivitySummary(data.deals, selectedDate) : null;
  const totalClosures = data.sameDayClosures + data.fortyEightHourClosures;
  const sameDayBar = totalClosures ? (data.sameDayClosures / totalClosures) * 100 : 0;
  const fortyEightBar = totalClosures ? (data.fortyEightHourClosures / totalClosures) * 100 : 0;

  useEffect(() => {
    setSelectedPart(null);
  }, [data.designerId, data.cycle.cycleIndex, selectedDate]);

  const partLeads = selectedPart ? dealsForWeightedPart(visibleDeals, selectedPart) : [];
  const partMeta = selectedPart ? WEIGHTED_PART_META[selectedPart] : null;

  const togglePart = (part: WeightedPartFilter) => {
    setSelectedPart((prev) => (prev === part ? null : part));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">{data.designerName}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {subtitle || 'Individual performance incentives'}
            {' · '}
            <span className="font-medium text-gray-700">
              {data.cycle.cycleDays}-day cycle ({data.cycle.cycleLabel})
              {data.cycle.isCurrent ? '' : ' · past fortnight'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.cycle.isCurrent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {data.cycle.daysRemaining} day{data.cycle.daysRemaining === 1 ? '' : 's'} left
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              Completed cycle
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-600 ring-1 ring-rose-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
            </svg>
            {formatInrCompact(data.amountToNextSlab)} to next slab
          </span>
        </div>
      </div>

      {dayActivity ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-900">
              Activity on {dayActivity.dateLabel}
            </h3>
            <span className="text-xs text-emerald-800">{dayActivity.dealCount} deal(s)</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Day Weighted" value={formatInr(dayActivity.revenue)} />
            <MetricCard label="Day Incentive" value={formatInr(dayActivity.incentive)} accent />
            <MetricCard label="Same Day Closures" value={String(dayActivity.sameDayClosures)} />
            <MetricCard label="48h Closures" value={String(dayActivity.fortyEightHourClosures)} />
          </div>
          {dayActivity.dealCount === 0 ? (
            <p className="mt-3 text-sm text-emerald-900/70">No deals recorded on this date.</p>
          ) : null}
        </section>
      ) : null}

      <section
        className={`rounded-xl border p-4 shadow-sm ${
          data.meetingsEligible
            ? 'border-emerald-200 bg-emerald-50/50'
            : 'border-amber-200 bg-amber-50/70'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Fortnight meetings
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {data.meetingsCompleted}
              <span className="text-base font-semibold text-gray-500">
                {' '}
                / {data.meetingsRequired} required
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {data.meetingsEligible
                ? 'Meeting gate cleared — incentives are unlocked for this fortnight.'
                : `Complete at least ${data.meetingsRequired} meetings in this 15-day cycle to unlock incentives.`}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
              data.meetingsEligible
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-500 text-white'
            }`}
          >
            {data.meetingsEligible ? 'Eligible' : 'Locked'}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/80">
          <div
            className={`h-2 rounded-full ${data.meetingsEligible ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{
              width: `${Math.min(
                100,
                (data.meetingsCompleted / Math.max(1, data.meetingsRequired)) * 100,
              )}%`,
            }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard
          label="Total Target (15 days)"
          value={formatInr(data.totalTarget)}
        />
        <MetricCard
          label="Weighted Revenue"
          value={formatInr(data.revenueAchieved)}
          badge={`+${data.revenueDeltaPct}%`}
        />
        <MetricCard label="Achievement %" value={`${data.achievementPct}%`} />
        <MetricCard
          label="Meetings"
          value={`${data.meetingsCompleted}/${data.meetingsRequired}`}
          badge={data.meetingsEligible ? 'OK' : `Need ${data.meetingsRequired}`}
        />
        <MetricCard
          label="Incentive Earned"
          value={formatInr(data.incentiveEarned)}
          accent={data.meetingsEligible}
        />
        <MetricCard label="On-Spot Bonus" value={formatInr(data.onSpotBonus)} />
      </div>
      {!data.meetingsEligible && data.potentialIncentiveEarned > 0 ? (
        <p className="text-sm text-amber-800">
          Potential incentive (after meeting gate):{' '}
          <strong>{formatInr(data.potentialIncentiveEarned)}</strong>
        </p>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
              Weighted collection (Parts 1–3)
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Click a part to see which leads contribute. Weighted credit uses quotation milestones —
              not raw cash collected.
            </p>
          </div>
          <p className="text-sm font-semibold text-emerald-700">
            Total weighted: {formatInr(data.weightedBreakdown.totalWeighted)}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => togglePart('pre_d1_finance_10')}
            className={`rounded-lg border p-4 text-left transition ${
              selectedPart === 'pre_d1_finance_10'
                ? WEIGHTED_PART_META.pre_d1_finance_10.selected
                : WEIGHTED_PART_META.pre_d1_finance_10.ring
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wide ${WEIGHTED_PART_META.pre_d1_finance_10.accent}`}>
              Part 1 · Pre-D1 finance 10%
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {formatInr(data.weightedBreakdown.preD1Weighted)}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Collect 10% of quotation → <strong>finance approval</strong> → credit{' '}
              <strong>50%</strong> of that quotation · {data.weightedBreakdown.dealsWithPart1}{' '}
              deal(s)
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {selectedPart === 'pre_d1_finance_10' ? 'Showing leads · click to hide' : 'Click to view leads'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => togglePart('post_dqc1_design_10')}
            className={`rounded-lg border p-4 text-left transition ${
              selectedPart === 'post_dqc1_design_10'
                ? WEIGHTED_PART_META.post_dqc1_design_10.selected
                : WEIGHTED_PART_META.post_dqc1_design_10.ring
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wide ${WEIGHTED_PART_META.post_dqc1_design_10.accent}`}>
              Part 2 · Post-DQC1 design 10%
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {formatInr(data.weightedBreakdown.postDqc1Weighted)}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Collect 10% of current quote (+ revision top-up), then{' '}
              <strong>finance approval</strong> → credit <strong>25%</strong> of the{' '}
              <strong>Part 1 quotation</strong> (not the revised quote) ·{' '}
              {data.weightedBreakdown.dealsWithPart2} deal(s)
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
              {selectedPart === 'post_dqc1_design_10' ? 'Showing leads · click to hide' : 'Click to view leads'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => togglePart('part3_forty_percent')}
            className={`rounded-lg border p-4 text-left transition ${
              selectedPart === 'part3_forty_percent'
                ? WEIGHTED_PART_META.part3_forty_percent.selected
                : WEIGHTED_PART_META.part3_forty_percent.ring
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wide ${WEIGHTED_PART_META.part3_forty_percent.accent}`}>
              Part 3 · 40% payment + upsale
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {formatInr(data.weightedBreakdown.part3Weighted)}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Finance-approved 40% collection → <strong>25%</strong> of Part 1 quotation + full{' '}
              <strong>upsale</strong> (current − Part 1 quote) ·{' '}
              {data.weightedBreakdown.dealsWithPart3} deal(s)
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              {selectedPart === 'part3_forty_percent' ? 'Showing leads · click to hide' : 'Click to view leads'}
            </p>
          </button>
        </div>

        {selectedPart && partMeta ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-gray-900">
                Leads in {partMeta.short}
                <span className="ml-2 text-xs font-medium text-gray-500">
                  ({partLeads.length} lead{partLeads.length === 1 ? '' : 's'})
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setSelectedPart(null)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            {partLeads.length === 0 ? (
              <p className="text-sm text-gray-500">
                No leads have cleared this part yet
                {selectedDate ? ' for the selected date' : ''}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-3 font-semibold">Date</th>
                      <th className="pb-2 pr-3 font-semibold">Lead / Customer</th>
                      <th className="pb-2 pr-3 font-semibold">Part 1 quote</th>
                      <th className="pb-2 pr-3 font-semibold">Current quote</th>
                      {selectedPart === 'part3_forty_percent' ? (
                        <th className="pb-2 pr-3 font-semibold">Upsale</th>
                      ) : null}
                      <th className="pb-2 font-semibold">Weighted credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partLeads.map((lead) => (
                      <tr key={`${selectedPart}-${lead.id}`} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5 pr-3 text-xs text-gray-600">{lead.activityDate}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-gray-600 ring-1 ring-gray-200">
                              {lead.initials}
                            </span>
                            <span className="font-medium text-gray-900">{lead.customerName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-800">
                          {formatInr(lead.quotationAtFinanceApproval)}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-800">{formatInr(lead.dealValue)}</td>
                        {selectedPart === 'part3_forty_percent' ? (
                          <td className="py-2.5 pr-3 text-violet-700">
                            {lead.stageUpsale > 0 ? `+${formatInr(lead.stageUpsale)}` : '—'}
                          </td>
                        ) : null}
                        <td className="py-2.5 font-semibold text-emerald-700">
                          {formatInr(lead.stageWeighted)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <IncentiveJourney achievementPct={data.achievementPct} currentSlabPct={data.currentSlabPct} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-3">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-800">
            Incentive Slab Structure
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-3 font-semibold">Target %</th>
                  <th className="pb-2 pr-3 font-semibold">Revenue</th>
                  <th className="pb-2 pr-3 font-semibold">Incentive %</th>
                  <th className="pb-2 font-semibold">Potential Earned</th>
                </tr>
              </thead>
              <tbody>
                {data.slabs.map((slab) => {
                  const active = data.currentSlabPct > 0 && slab.targetPct === data.currentSlabPct;
                  const reached = data.achievementPct >= slab.targetPct;
                  return (
                    <tr
                      key={slab.targetPct}
                      className={
                        active ? 'bg-emerald-50/80 text-gray-900' : 'border-b border-gray-50 text-gray-700'
                      }
                    >
                      <td className="py-3 pr-3 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          {slab.targetPct}%
                          {active ? (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Active
                            </span>
                          ) : reached ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                              Cleared
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{formatInr(slab.revenue)}</td>
                      <td className="py-3 pr-3">{slab.incentivePct.toFixed(2)}%</td>
                      <td className="py-3 font-medium">{formatInr(slab.potentialEarned)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="relative flex flex-col rounded-xl bg-slate-900 p-5 text-white shadow-sm lg:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Current Payout Math</h3>
          <div className="mt-4 rounded-lg border border-dashed border-slate-600 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Weighted Revenue
            </p>
            <p className="mt-1 text-lg font-bold">{formatInr(data.revenueAchieved)}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              P1 {formatInr(data.weightedBreakdown.preD1Weighted)} + P2{' '}
              {formatInr(data.weightedBreakdown.postDqc1Weighted)} + P3{' '}
              {formatInr(data.weightedBreakdown.part3Weighted)}
            </p>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Meeting gate</dt>
              <dd className="font-semibold">
                {data.meetingsCompleted}/{data.meetingsRequired}{' '}
                {data.meetingsEligible ? '(passed)' : '(locked)'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Eligible Slab</dt>
              <dd className="font-semibold">
                {data.eligibleSlabPct > 0 ? `${data.eligibleSlabPct}%` : 'None yet'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Incentive Multiplier</dt>
              <dd className="font-semibold text-emerald-400">
                {data.incentiveMultiplierPct > 0 ? `${data.incentiveMultiplierPct}%` : '0%'}
              </dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-slate-700 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Payout</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">{formatInr(data.incentiveEarned)}</p>
            {!data.meetingsEligible ? (
              <p className="mt-2 text-[11px] text-amber-300">
                Locked until {data.meetingsRequired} meetings are completed this fortnight.
                Potential: {formatInr(data.potentialIncentiveEarned)}.
              </p>
            ) : (
              <p className="mt-2 text-[11px] italic text-slate-500">
                Calculated on weighted quotation credit. Taxes extra.
              </p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-800">
          Speed Bonuses: On-Spot Closures
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total Closures</p>
              <p className="text-3xl font-bold text-gray-900">{String(totalClosures).padStart(2, '0')}</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bonus Breakdown</p>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-gray-800">
                    Same Day ({String(data.sameDayClosures).padStart(2, '0')})
                  </span>
                  <span className="font-semibold text-gray-900">{formatInr(data.sameDayBonus)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${sameDayBar}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-gray-800">
                    48 Hour ({String(data.fortyEightHourClosures).padStart(2, '0')})
                  </span>
                  <span className="font-semibold text-gray-900">{formatInr(data.fortyEightHourBonus)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${fortyEightBar}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-emerald-400 p-5 text-slate-900 shadow-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide">Total Speed Bonus</p>
              <p className="mt-1 text-3xl font-bold">{formatInr(data.onSpotBonus)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
            Deal Contribution Ledger
            {selectedDate ? (
              <span className="ml-2 font-medium normal-case tracking-normal text-gray-500">
                · filtered to {selectedDate}
              </span>
            ) : null}
          </h3>
          <button
            type="button"
            onClick={() =>
              exportDealsCsv(
                visibleDeals,
                `incentives-${data.designerId || 'designer'}${selectedDate ? `-${selectedDate}` : ''}.csv`,
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
          >
            Export Data
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="pb-3 pr-4 font-semibold">Date</th>
                <th className="pb-3 pr-4 font-semibold">Customer</th>
                <th className="pb-3 pr-4 font-semibold">Quotation</th>
                <th className="pb-3 pr-4 font-semibold">Stages</th>
                <th className="pb-3 pr-4 font-semibold">Weighted</th>
                <th className="pb-3 pr-4 font-semibold">Closure</th>
                <th className="pb-3 font-semibold">Incentive</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
                    No deals for this filter.
                  </td>
                </tr>
              ) : (
                visibleDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3.5 pr-4 text-xs font-medium text-gray-600">{deal.activityDate}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                          {deal.initials}
                        </span>
                        <span className="font-medium text-gray-900">{deal.customerName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="font-medium text-gray-800">{formatInr(deal.dealValue)}</div>
                      {deal.dealValue !== deal.quotationAtFinanceApproval ? (
                        <div className="text-[10px] text-gray-500">
                          At finance 10%: {formatInr(deal.quotationAtFinanceApproval)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {deal.stages.map((s) => {
                            const pendingFinance = s.requestRaised && !s.financeApproved;
                            return (
                            <span
                              key={s.stageId}
                              title={
                                pendingFinance
                                  ? `${s.label}: amount raised — awaiting finance approval (no weighted credit yet)`
                                  : s.stageId === 'post_dqc1_design_10'
                                    ? `${s.label}: collect on current quote${s.revisionTopUp > 0 ? ` (+ top-up ${formatInr(s.revisionTopUp)})` : ''} → finance approve → ${s.weightPct}% of Part 1 quote (${formatInr(s.quotationValue)})`
                                    : s.stageId === 'part3_forty_percent'
                                      ? `${s.label}: finance-approve 40% → ${s.weightPct}% of Part 1 (${formatInr(s.quotationValue)}) + upsale ${formatInr(s.upsaleAmount)} = ${formatInr(s.weightedAmount)}`
                                      : `${s.label}: collect ${formatInr(s.collectionRequired)} → finance approve → weight ${s.weightPct}%`
                              }
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                s.cleared
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : pendingFinance
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {s.stageId === 'pre_d1_finance_10'
                                ? pendingFinance
                                  ? 'P1 pending'
                                  : 'P1 50%'
                                : s.stageId === 'post_dqc1_design_10'
                                  ? pendingFinance
                                    ? 'P2 pending'
                                    : 'P2 25%'
                                  : pendingFinance
                                    ? 'P3 pending'
                                    : s.upsaleAmount > 0
                                      ? `P3 +upsale`
                                      : 'P3 25%'}
                            </span>
                            );
                          })}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-500">{deal.contributionPct}% weight</div>
                    </td>
                    <td className="py-3.5 pr-4 font-semibold text-emerald-700">
                      {formatInr(deal.weightedRevenue)}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${closureBadgeClass(deal.closureTime)}`}
                      >
                        {deal.closureTime}
                      </span>
                    </td>
                    <td className="py-3.5 font-semibold text-gray-900">{formatInr(deal.incentive)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TeamIncentivesPanel({
  team,
  scopeLabel,
  onOpenDesigner,
  selectedDate,
}: {
  team: TeamIncentivesSummary;
  scopeLabel: string;
  onOpenDesigner: (designerId: number) => void;
  selectedDate: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Team Incentives</h2>
          <p className="mt-1 text-sm text-gray-500">
            {scopeLabel} · {team.memberCount} designer{team.memberCount === 1 ? '' : 's'}
            {' · '}
            <span className="font-medium text-gray-700">
              {team.cycle.cycleDays}-day cycle ({team.cycle.cycleLabel})
              {team.cycle.isCurrent ? '' : ' · past fortnight'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {team.cycle.isCurrent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {team.cycle.daysRemaining} day{team.cycle.daysRemaining === 1 ? '' : 's'} left
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              Completed cycle
            </span>
          )}
          <button
            type="button"
            onClick={() => exportTeamCsv(team)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
          >
            Export Team
          </button>
        </div>
      </div>

      {selectedDate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Date filter <strong>{selectedDate}</strong> is applied on Individual view. Open a designer
          to see what happened that day.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="Team Size" value={String(team.memberCount)} />
        <MetricCard
          label="Combined Target (15 days)"
          value={formatInr(team.totalTarget)}
        />
        <MetricCard label="Weighted Revenue" value={formatInr(team.revenueAchieved)} />
        <MetricCard label="Team Achievement" value={`${team.achievementPct}%`} />
        <MetricCard
          label="Meeting Gate Passed"
          value={`${team.rows.filter((r) => r.meetingsEligible).length}/${team.memberCount}`}
        />
        <MetricCard label="Total Incentives" value={formatInr(team.incentiveEarned)} accent />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-800">
          Designer Leaderboard
        </h3>
        {team.rows.length === 0 ? (
          <p className="text-sm text-gray-500">No designers found in your scope.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="pb-3 pr-4 font-semibold">Designer</th>
                  <th className="pb-3 pr-4 font-semibold">Target</th>
                  <th className="pb-3 pr-4 font-semibold">Revenue</th>
                  <th className="pb-3 pr-4 font-semibold">Achievement</th>
                  <th className="pb-3 pr-4 font-semibold">Meetings</th>
                  <th className="pb-3 pr-4 font-semibold">Slab</th>
                  <th className="pb-3 pr-4 font-semibold">Incentive</th>
                  <th className="pb-3 pr-4 font-semibold">On-Spot</th>
                  <th className="pb-3 font-semibold">View</th>
                </tr>
              </thead>
              <tbody>
                {team.rows.map((row) => (
                  <tr key={row.designerId} className="border-b border-gray-50 last:border-0">
                    <td className="py-3.5 pr-4">
                      <div className="font-medium text-gray-900">{row.designerName}</div>
                      <div className="text-xs capitalize text-gray-500">{row.role.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="py-3.5 pr-4 text-gray-800">{formatInr(row.totalTarget)}</td>
                    <td className="py-3.5 pr-4 text-gray-800">{formatInr(row.revenueAchieved)}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex min-w-[110px] items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-emerald-400"
                            style={{ width: `${Math.min(100, row.achievementPct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{row.achievementPct}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-gray-900">
                          {row.meetingsCompleted}/{row.meetingsRequired}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            row.meetingsEligible ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {row.meetingsEligible ? 'Eligible' : 'Locked'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                        {row.currentSlabPct > 0 ? `${row.currentSlabPct}%` : '—'}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 font-semibold text-emerald-700">
                      {formatInr(row.incentiveEarned)}
                    </td>
                    <td className="py-3.5 pr-4 text-gray-800">{formatInr(row.onSpotBonus)}</td>
                    <td className="py-3.5">
                      <button
                        type="button"
                        onClick={() => onOpenDesigner(row.designerId)}
                        className="rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        Individual
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function DesignerIncentivesView() {
  const { user, sessionId } = useAuth();
  const apiBase = getApiBase();
  const isManager = canManageTeamIncentives(user?.role);
  const isDesignerOnly = (user?.role || '').toLowerCase() === 'designer';

  const [viewMode, setViewMode] = useState<ViewMode>(isManager ? 'team' : 'individual');
  const [members, setMembers] = useState<IncentiveMember[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycleIndex, setCycleIndex] = useState(() => getCurrentCycleIndex());
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fortnightOptions = useMemo(() => listFortnightOptions(8), []);
  const selectedFortnight = useMemo(
    () => fortnightOptions.find((f) => f.cycleIndex === cycleIndex) || fortnightOptions[0],
    [fortnightOptions, cycleIndex],
  );

  const scopeLabel = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    if (role === 'design_manager') return 'Your design team';
    if (role === 'territorial_design_manager') return 'Your territory';
    if (role === 'deputy_general_manager' || role === 'admin') return 'All designers';
    return 'Your incentives';
  }, [user?.role]);

  const loadMembers = useCallback(async () => {
    if (!user) return;
    if (isDesignerOnly) {
      const self: IncentiveMember = { id: user.id, name: user.name, role: user.role };
      setMembers([self]);
      setSelectedId(user.id);
      return;
    }
    if (!sessionId) return;
    setLoadingMembers(true);
    setLoadError(null);
    try {
      const headers = buildAuthHeaders(sessionId);
      let list: IncentiveMember[] = [];
      const assignableRes = await fetch(`${apiBase}/api/designers/assignable`, {
        headers,
        credentials: 'include',
      });
      if (assignableRes.ok) {
        const data = await assignableRes.json();
        const raw = (data?.designers || data || []) as { id: number; name: string; role?: string }[];
        list = raw
          .filter((d) => Number.isFinite(Number(d.id)))
          .map((d) => ({
            id: Number(d.id),
            name: String(d.name || 'Designer'),
            role: String(d.role || 'designer'),
          }));
      }
      if (list.length === 0) {
        const designersRes = await fetch(`${apiBase}/api/designers`, {
          headers,
          credentials: 'include',
        });
        if (designersRes.ok) {
          const data = await designersRes.json();
          const raw = (data?.designers || []) as { id: number; name: string; role?: string }[];
          list = raw
            .filter((d) => Number.isFinite(Number(d.id)))
            .map((d) => ({
              id: Number(d.id),
              name: String(d.name || 'Designer'),
              role: String(d.role || 'designer'),
            }));
        }
      }
      // Prefer designers for team rollups; keep DMs if returned
      const designersFirst = [
        ...list.filter((m) => m.role === 'designer'),
        ...list.filter((m) => m.role !== 'designer'),
      ];
      setMembers(designersFirst);
      if (designersFirst.length) {
        setSelectedId((prev) => prev ?? designersFirst[0].id);
      }
    } catch {
      setLoadError('Could not load designer list.');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [apiBase, isDesignerOnly, sessionId, user]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (isDesignerOnly) setViewMode('individual');
  }, [isDesignerOnly]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedId) || members[0] || null,
    [members, selectedId],
  );

  const individualData = useMemo(() => {
    if (!selectedMember) {
      if (!user) return null;
      return buildDemoIncentivesForDesigner(
        {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        cycleIndex,
      );
    }
    return buildDemoIncentivesForDesigner(selectedMember, cycleIndex);
  }, [selectedMember, user, cycleIndex]);

  const teamSummary = useMemo(
    () => buildTeamIncentivesSummary(members, cycleIndex),
    [members, cycleIndex],
  );

  const openDesigner = (designerId: number) => {
    setSelectedId(designerId);
    setViewMode('individual');
  };

  const onFortnightChange = (nextIndex: number) => {
    setCycleIndex(nextIndex);
    setSelectedDate('');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Performance Incentives</h1>
            <p className="mt-1 text-sm text-gray-500">
              ₹30L target every 15 days · resets automatically at cycle end
              {isManager ? ` · ${scopeLabel}` : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isManager ? (
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('team')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    viewMode === 'team'
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Team
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('individual')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    viewMode === 'individual'
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Individual
                </button>
              </div>
            ) : null}

            {isManager && viewMode === 'individual' ? (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Designer
                </span>
                <select
                  className="min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  disabled={loadingMembers || members.length === 0}
                >
                  {members.length === 0 ? (
                    <option value="">No designers</option>
                  ) : (
                    members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.role !== 'designer' ? ` (${m.role.replace(/_/g, ' ')})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-gray-600">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Fortnight (15 days)
            </span>
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={cycleIndex}
              onChange={(e) => onFortnightChange(Number(e.target.value))}
            >
              {fortnightOptions.map((opt) => (
                <option key={opt.cycleIndex} value={opt.cycleIndex}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[180px] flex-col gap-1 text-sm text-gray-600">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Date filter
            </span>
            <input
              type="date"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={selectedDate}
              min={selectedFortnight?.startIso}
              max={selectedFortnight?.endIso}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={() => setSelectedDate('')}
            disabled={!selectedDate}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear date
          </button>

          <p className="w-full text-xs text-gray-500 sm:w-auto sm:flex-1 sm:text-right">
            {selectedDate
              ? `Showing activity for ${selectedDate}`
              : `Showing full fortnight ${selectedFortnight?.startIso || ''} → ${selectedFortnight?.endIso || ''}`}
          </p>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {loadError}
          </div>
        ) : null}

        {loadingMembers && isManager ? (
          <p className="text-sm text-gray-500">Loading designers…</p>
        ) : null}

        {viewMode === 'team' && isManager ? (
          <TeamIncentivesPanel
            team={teamSummary}
            scopeLabel={scopeLabel}
            onOpenDesigner={openDesigner}
            selectedDate={selectedDate || null}
          />
        ) : individualData ? (
          <IndividualIncentivesPanel
            data={individualData}
            selectedDate={selectedDate || null}
            subtitle={
              isDesignerOnly
                ? 'Your personal incentive dashboard'
                : 'Individual designer incentive detail'
            }
          />
        ) : (
          <p className="text-sm text-gray-500">No incentive data available.</p>
        )}
      </div>
    </div>
  );
}
