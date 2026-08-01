import * as React from 'react';
import { Text, Section, Hr } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { SectionLabel } from '../../component/blocks/SectionLabel';
import { InfoGrid } from '../../component/blocks/InfoGrid';
import { OfferCards, StatusBadge } from '../../component/blocks/OfferCards';

export interface MailLoopChainInitiateEmailProps {
  customerName?: string;
  projectId?: string;
  clientFullName?: string;
  dateOfCall?: string;
  addressCity?: string;
  projectType?: string;
  propertyName?: string;
  propertyConfiguration?: string;
  possession?: string;
  leadSource?: string;
  salesLeadName?: string;
  scopeOfWork?: string;
  totalAmount?: string;
  salesConsultantInfo?: string;
  discountLabel?: string;
  discountValue?: string;
  discountSubtitle?: string;
  bookingReceived?: string;
  amountPaid?: string;
  timelinePromise?: string;
  specialOffer?: string;
  customCommitments?: string;
}

export default function MailLoopChainInitiateEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  clientFullName = 'Customer',
  dateOfCall = '[Date]',
  addressCity = '[Address, City]',
  projectType = '[New Home / Renovation]',
  propertyName = '',
  propertyConfiguration = '',
  possession = '',
  leadSource = '',
  salesLeadName = '',
  scopeOfWork = 'Woodwork · Kitchen · Flooring · Civil',
  totalAmount = '[Total Amount]',
  salesConsultantInfo = '[Name] · [Branch]',
  bookingReceived = 'Pending',
  amountPaid = '',
  timelinePromise = '',
  specialOffer = '',
  customCommitments = '',
}: MailLoopChainInitiateEmailProps) {
  const overviewItems = [
    { label: 'Client name', value: clientFullName },
    ...(propertyName ? [{ label: 'Property name', value: propertyName }] : []),
    { label: 'Property address', value: addressCity },
    ...(propertyConfiguration
      ? [{ label: 'Property configuration', value: propertyConfiguration }]
      : []),
    { label: 'Project type', value: projectType },
    ...(possession ? [{ label: 'Possession', value: possession }] : []),
    ...(leadSource ? [{ label: 'Lead source', value: leadSource }] : []),
    { label: 'Scope of work', value: scopeOfWork },
    { label: 'Project value', value: totalAmount.startsWith('₹') || totalAmount === '[Total Amount]' ? totalAmount : `₹${totalAmount}` },
    ...(salesLeadName ? [{ label: 'Sales lead', value: salesLeadName }] : []),
    { label: 'Sales consultant', value: salesConsultantInfo },
  ];

  const offerItems = [
    ...(timelinePromise
      ? [
          {
            label: 'Early handover',
            value: timelinePromise,
            subtitle: 'Timeline promised by sales',
            accent: true,
            badge: <StatusBadge variant="conditional">Conditional</StatusBadge>,
          },
        ]
      : []),
    {
      label: 'Booking received',
      value: bookingReceived,
      subtitle: amountPaid
        ? `On ${dateOfCall} · ₹${amountPaid} paid`
        : `On ${dateOfCall}`,
      badge: <StatusBadge variant="confirmed">Confirmed</StatusBadge>,
    },
  ];

  const showSpecialDeclaration = Boolean(specialOffer || customCommitments);

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="WELCOME" status="ONBOARDING" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8 w-full">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack mb-7">
          We are honoured to welcome you to the HUB Interior family. This letter is a complete written
          record of all that was discussed during your sales consultation on{' '}
          <strong>{dateOfCall}</strong> — a commitment to full transparency between us, from the very
          first day.
        </Text>

        <SectionLabel>Project overview</SectionLabel>
        <InfoGrid items={overviewItems} />

        <Hr className="border-0 border-t border-neutral-lightGrey my-7" />

        <SectionLabel>Offer confirmed</SectionLabel>
        <OfferCards items={offerItems} />

        {showSpecialDeclaration && (
          <>
            <Hr className="border-0 border-t border-neutral-lightGrey my-7" />
            <SectionLabel>Special declaration</SectionLabel>
            <Section className="border border-neutral-lightGrey border-l-4 border-l-brand-primary rounded-r-lg bg-neutral-white px-4 py-3.5">
              {specialOffer ? (
                <>
                  <Text className="m-0 font-sans text-[10px] tracking-wider uppercase text-neutral-mediumGrey mb-1">
                    Special offer (with approval)
                  </Text>
                  <Text className="m-0 font-sans text-[13px] text-neutral-nearBlack leading-relaxed mb-3 whitespace-pre-wrap">
                    {specialOffer}
                  </Text>
                </>
              ) : null}
              {customCommitments ? (
                <>
                  <Text className="m-0 font-sans text-[10px] tracking-wider uppercase text-neutral-mediumGrey mb-1">
                    Custom commitments
                  </Text>
                  <Text className="m-0 font-sans text-[13px] text-neutral-nearBlack leading-relaxed whitespace-pre-wrap">
                    {customCommitments}
                  </Text>
                </>
              ) : null}
            </Section>
          </>
        )}
      </Section>
    </BaseLayout>
  );
}
