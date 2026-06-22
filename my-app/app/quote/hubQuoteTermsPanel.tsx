'use client';

import { HUB_QUOTE_TERMS_SECTIONS } from './hubQuoteTermsContent';
import { QUOTE } from './quoteStyles';

function SectionIcon() {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
      style={{ backgroundColor: '#fde8ea', color: QUOTE.red }}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    </span>
  );
}

export function QuoteTermsAndConditions() {
  return (
    <div className="mt-5 space-y-6">
      {HUB_QUOTE_TERMS_SECTIONS.map((section) => (
        <div key={section.title} className="overflow-hidden rounded-xl border border-[#ece6df] bg-white">
          <div className="flex items-center gap-3 border-b border-[#ece6df] px-4 py-3">
            <SectionIcon />
            <h4 className="text-base font-bold" style={{ color: QUOTE.red }}>
              {section.title}
            </h4>
          </div>

          {section.intro ? (
            <div
              className="border-b border-[#ece6df] px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: QUOTE.brown }}
            >
              {section.intro}
            </div>
          ) : null}

          <div className="divide-y divide-[#ece6df]">
            {section.rows.map((row, idx) => {
              if (row.fullWidth) {
                if (row.bold) {
                  return (
                    <div
                      key={`${section.title}-fw-${idx}`}
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: QUOTE.brown }}
                    >
                      {row.fullWidth}
                    </div>
                  );
                }
                return (
                  <div
                    key={`${section.title}-fw-${idx}`}
                    className="flex gap-2 border-t border-[#ece6df] bg-[#faf8f5] px-4 py-3 text-xs leading-relaxed text-[#5c5650]"
                  >
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#9a928c]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{row.fullWidth}</span>
                  </div>
                );
              }
              return (
                <div
                  key={`${section.title}-row-${idx}`}
                  className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2"
                >
                  <span className="text-sm font-medium text-[#2a1d14]">{row.label}</span>
                  <span className="text-sm text-[#9a928c] sm:text-right">{row.value}</span>
                </div>
              );
            })}
          </div>

          {section.bullets?.length ? (
            <ul className="list-disc space-y-1.5 border-t border-[#ece6df] px-6 py-3 text-xs leading-relaxed text-[#5c5650]">
              {section.bullets.map((item) => (
                <li key={item.slice(0, 48)}>{item}</li>
              ))}
            </ul>
          ) : null}

          {section.footnotes?.map((note) => (
            <p
              key={note.slice(0, 48)}
              className="border-t border-[#ece6df] px-4 py-3 text-xs font-semibold leading-relaxed text-[#5c5650]"
            >
              {note}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
