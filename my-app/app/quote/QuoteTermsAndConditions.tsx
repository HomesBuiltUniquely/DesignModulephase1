'use client';

import { HUB_QUOTE_TERMS_SECTIONS } from './hubQuoteTermsContent';

type Props = {
  isDark?: boolean;
};

export function QuoteTermsAndConditions({ isDark = false }: Props) {
  const sectionHeader = isDark
    ? 'bg-slate-600 text-slate-50 border-slate-500'
    : 'bg-[#bdbdbd] text-gray-900 border-gray-500';
  const cellBorder = isDark ? 'border-slate-600' : 'border-gray-400';
  const labelText = isDark ? 'text-rose-300' : 'text-red-600';
  const valueText = isDark ? 'text-slate-100' : 'text-gray-900';
  const footnoteText = isDark ? 'text-slate-300' : 'text-gray-700';
  const introText = isDark ? 'text-slate-200 bg-slate-800/60' : 'text-gray-800 bg-gray-50';

  return (
    <div className="mt-5 space-y-0 overflow-x-auto">
      {HUB_QUOTE_TERMS_SECTIONS.map((section) => (
        <div key={section.title} className="mb-0">
          <div
            className={`border border-b-0 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide sm:text-sm ${sectionHeader}`}
          >
            {section.title}
          </div>

          {section.intro ? (
            <div
              className={`border border-b-0 px-3 py-2.5 text-center text-xs font-semibold sm:text-sm ${cellBorder} ${introText}`}
            >
              {section.intro}
            </div>
          ) : null}

          <div className={`border-2 ${cellBorder}`}>
            {section.rows.map((row, idx) => {
              if (row.fullWidth) {
                return (
                  <div
                    key={`${section.title}-fw-${idx}`}
                    className={`border-b px-3 py-2.5 text-xs leading-relaxed last:border-b-0 sm:text-sm ${cellBorder} ${valueText} ${row.bold ? 'font-bold' : ''}`}
                  >
                    {row.fullWidth}
                  </div>
                );
              }
              return (
                <div
                  key={`${section.title}-row-${idx}`}
                  className={`grid grid-cols-1 border-b last:border-b-0 sm:grid-cols-[minmax(11rem,34%)_1fr] ${cellBorder}`}
                >
                  <div
                    className={`border-b px-3 py-2.5 text-xs font-medium leading-snug sm:border-b-0 sm:border-r sm:text-sm ${cellBorder} ${labelText}`}
                  >
                    {row.label}
                  </div>
                  <div
                    className={`px-3 py-2.5 text-xs leading-relaxed sm:text-sm ${valueText} ${row.valueCenter ? 'text-center' : ''}`}
                  >
                    {row.value}
                  </div>
                </div>
              );
            })}
          </div>

          {section.bullets?.length ? (
            <ul
              className={`list-disc space-y-1.5 border border-t-0 px-5 py-3 text-xs leading-relaxed sm:text-sm ${cellBorder} ${footnoteText}`}
            >
              {section.bullets.map((item) => (
                <li key={item.slice(0, 48)}>{item}</li>
              ))}
            </ul>
          ) : null}

          {section.footnotes?.map((note) => (
            <p
              key={note.slice(0, 48)}
              className={`border border-t-0 px-3 py-2.5 text-xs font-semibold leading-relaxed sm:text-sm ${cellBorder} ${footnoteText}`}
            >
              {note}
            </p>
          ))}

          <div className="h-4" aria-hidden />
        </div>
      ))}
    </div>
  );
}
