'use client';

import { useEffect, useState } from 'react';

import { getApiBase } from '@/app/lib/apiBase';
const API = getApiBase();

type DqcRemark = { priority: string; text: string; resolved?: boolean };
type DqcReview = {
  id: number;
  verdict: string;
  remarks: DqcRemark[];
  createdAt: string;
};

type Props = {
  leadId: number | null;
  sessionId: string | null;
  cardClass?: string;
  /** When true, render only the content (for embedding inside History section). */
  embedded?: boolean;
};

/**
 * For designers: show latest DQC review remarks when verdict is rejected or approved_with_changes.
 * Designers can only mark each remark as "Solved" / "Done" – no commenting.
 */
export default function DqcDesignerFeedbackCard({ leadId, sessionId, cardClass = '', embedded = false }: Props) {
  const [review, setReview] = useState<DqcReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null);

  const fetchReview = async () => {
    if (!leadId || !sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}/dqc-review`, {
        headers: { Authorization: `Bearer ${sessionId}` },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setReview(data);
      else setReview(null);
    } catch {
      setReview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReview();
  }, [leadId, sessionId]);

  const markSolved = async (index: number) => {
    if (!leadId || !sessionId) return;
    setResolvingIndex(index);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}/dqc-review/remarks/${index}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionId}` },
      });
      if (res.ok) await fetchReview();
    } finally {
      setResolvingIndex(null);
    }
  };

  const showCard =
    review &&
    (review.verdict === 'rejected' || review.verdict === 'approved_with_changes') &&
    review.remarks?.length > 0;

  if (!showCard) return null;

  const content = (
    <>
      <div className={embedded ? 'pb-2' : 'px-4 py-3 border-b border-gray-200'}>
        <h2 className={embedded ? 'text-base font-bold text-gray-900' : 'text-lg font-bold text-gray-900'}>DQC Review Feedback</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {review.verdict === 'rejected'
            ? 'DQC was rejected. Address each comment and mark as solved when done. Then upload a new file and resubmit for review.'
            : 'Approved with changes. Address each comment and mark as solved. Then upload a new file and resubmit for review.'}
        </p>
      </div>
      <div className={embedded ? 'space-y-3' : 'p-4 space-y-3 max-h-[50vh] overflow-y-auto'}>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          review.remarks.map((r, index) => (
            <div
              key={index}
              className={`rounded-lg border p-3 text-sm border-l-4 ${
                r.resolved
                  ? 'border-l-green-500 bg-green-50/50'
                  : r.priority === 'high'
                    ? 'border-l-red-500 bg-red-50/30'
                    : r.priority === 'medium'
                      ? 'border-l-amber-500 bg-amber-50/30'
                      : 'border-l-gray-400 bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <span
                  className={`text-xs font-semibold ${
                    r.priority === 'high' ? 'text-red-700' : r.priority === 'medium' ? 'text-amber-700' : 'text-gray-600'
                  }`}
                >
                  {r.priority === 'high' ? 'High Priority' : r.priority === 'medium' ? 'Medium Priority' : 'Low Priority'}
                </span>
                {r.resolved ? (
                  <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                    ✓ Solved
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={resolvingIndex === index}
                    onClick={() => markSolved(index)}
                    className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline disabled:opacity-60"
                  >
                    {resolvingIndex === index ? 'Saving…' : 'Mark as solved'}
                  </button>
                )}
              </div>
              <p className="text-gray-700 mt-1">{r.text}</p>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (embedded) return content;
  return <div className={cardClass}>{content}</div>;
}
