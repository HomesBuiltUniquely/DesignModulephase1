import * as React from 'react';
import { Text, Section, Hr } from '@react-email/components';
import { SectionLabel } from './SectionLabel';
import { Button } from './Button';

export interface SalesTermRow {
  term: string;
  detail: string;
}

export interface SalesCallTermsSectionProps {
  salesTerms?: SalesTermRow[];
  rmName?: string;
  rmPhone?: string;
  rmEmail?: string;
  acknowledgeHref?: string;
}

const DEFAULT_SALES_TERMS: SalesTermRow[] = [
  { term: 'Payment schedule', detail: '30% booking · 40% at execution start · 30% on handover' },
  { term: 'Warranty', detail: '10 years on woodwork · 1 year on civil & electrical' },
  { term: 'Materials & brands', detail: 'Greenply / Century (ply) · Hettich (hardware) · Standard laminates' },
  { term: 'Project timeline', detail: 'Estimated from design sign-off' },
  { term: 'Delay penalty', detail: 'Standard deduction per week beyond agreed handover date' },
  { term: 'Scope changes', detail: 'Post-execution changes subject to revised pricing & timeline' },
];

export const SalesCallTermsSection = ({
  salesTerms = DEFAULT_SALES_TERMS,
  rmName = '',
  rmPhone = '',
  rmEmail = '',
  acknowledgeHref = '#',
}: SalesCallTermsSectionProps) => {
  return (
    <>
      <Hr className="border-0 border-t border-neutral-lightGrey my-7" />

      <SectionLabel>Sales call — terms on record</SectionLabel>
      <Section className="border border-neutral-lightGrey border-l-4 border-l-brand-primary rounded-r-lg bg-neutral-white px-4 py-3.5 mb-5">
        <Text className="m-0 font-serif text-[13px] text-neutral-nearBlack font-medium mb-1">
          Transparent sales call summary
        </Text>
        <Text className="m-0 font-sans text-[12.5px] text-neutral-mediumGrey leading-relaxed">
          The following points were verbally agreed upon and are now formally documented for mutual
          reference.
        </Text>
      </Section>

      <Section className="w-full mb-7">
        <table cellPadding={0} cellSpacing={0} border={0} className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="text-left pb-2.5 border-b border-brand-primary font-sans text-[10px] tracking-widest uppercase text-neutral-mediumGrey w-[38%] pr-3">
                Term
              </th>
              <th className="text-left pb-2.5 border-b border-brand-primary font-sans text-[10px] tracking-widest uppercase text-neutral-mediumGrey">
                Detail agreed upon
              </th>
            </tr>
          </thead>
          <tbody>
            {salesTerms.map((row, index) => {
              const isLast = index === salesTerms.length - 1;
              return (
                <tr key={row.term}>
                  <td
                    className={`py-2.5 pr-3 align-top text-neutral-mediumGrey font-sans ${
                      isLast ? '' : 'border-b border-neutral-lightGrey'
                    }`}
                  >
                    {row.term}
                  </td>
                  <td
                    className={`py-2.5 align-top text-neutral-nearBlack font-sans ${
                      isLast ? '' : 'border-b border-neutral-lightGrey'
                    }`}
                  >
                    {row.detail}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack mb-4">
        We trust this letter provides complete clarity on every commitment made. Should you wish to
        revisit any point, your dedicated relationship manager is always available.
      </Text>

      <Section className="border-l-4 border-l-brand-primary pl-3.5 mb-7 bg-brand-lightBg rounded-r-lg py-3 pr-3">
        <Text className="m-0 font-serif text-[13px] italic text-neutral-mediumGrey leading-relaxed">
          &ldquo;Your experience defines our service — and every design we create is uniquely
          yours.&rdquo;
          <br />
          &ldquo;Loved your experience? Share it. Didn&apos;t? Tell us — we will make it right.&rdquo;
        </Text>
      </Section>
    </>
  );
};
