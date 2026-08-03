import * as React from 'react';
import { Text, Section, Row, Column, Hr } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { SectionLabel } from '../../component/blocks/SectionLabel';
import { InfoGrid } from '../../component/blocks/InfoGrid';
import { OfferCards, StatusBadge } from '../../component/blocks/OfferCards';

// Serialisable subset of ConfigScopeSummary — safe to send over the wire
export interface EmailConfigScopeRoom {
  roomName?: string;
  units?: string; // pre-joined string (e.g. "Base Units, kk")
  falseCeiling?: boolean;
  notes?: string;
}

export interface EmailConfigScope {
  expectedTimeline?: string;
  kitchenLayout?: string;
  materialFinish?: string;
  wfhSetup?: boolean;
  petFriendly?: boolean;
  familySizeDetails?: string;
  familyContactName?: string;
  familyContactPhone?: string;
  rooms?: EmailConfigScopeRoom[];
}

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
  quotationLink?: string;
  /** Full Config scope — basic data from the View modal */
  configScope?: EmailConfigScope | null;
}

// ─── small helpers ────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '1.8px',
  textTransform: 'uppercase',
  color: '#9ca3af',
  marginBottom: '3px',
  fontFamily: 'sans-serif',
};

const VALUE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: '#1f2937',
  lineHeight: '1.4',
  fontFamily: 'serif',
};

function ScopeField({ label, value }: { label: string; value: string }) {
  return (
    <td style={{ width: '50%', padding: '10px 14px', verticalAlign: 'top' }}>
      <p style={LABEL_STYLE}>{label}</p>
      <p style={VALUE_STYLE}>{value || '—'}</p>
    </td>
  );
}

function ScopeRow({ children }: { children: React.ReactNode }) {
  return (
    <tr
      style={{
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      {children}
    </tr>
  );
}

interface DesignScopeSectionProps {
  scope: EmailConfigScope;
}

function DesignScopeSection({ scope }: DesignScopeSectionProps) {
  const hasBasicFields =
    scope.expectedTimeline ||
    scope.kitchenLayout ||
    scope.materialFinish ||
    scope.wfhSetup !== undefined ||
    scope.petFriendly !== undefined ||
    scope.familySizeDetails ||
    scope.familyContactName ||
    scope.familyContactPhone;

  const hasRooms = scope.rooms && scope.rooms.length > 0;

  if (!hasBasicFields && !hasRooms) return null;

  return (
    <>
      <Hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '28px 0' }} />
      <SectionLabel>Scope of work — basic</SectionLabel>

      {hasBasicFields && (
        <Section
          style={{
            width: '100%',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          <table
            cellPadding={0}
            cellSpacing={0}
            border={0}
            style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f9fafb' }}
          >
            {scope.expectedTimeline || scope.kitchenLayout ? (
              <ScopeRow>
                <ScopeField label="Expected timeline" value={scope.expectedTimeline || ''} />
                <ScopeField label="Kitchen layout" value={scope.kitchenLayout || ''} />
              </ScopeRow>
            ) : null}

            {scope.materialFinish || scope.wfhSetup !== undefined ? (
              <ScopeRow>
                <ScopeField label="Material / finish" value={scope.materialFinish || ''} />
                <ScopeField
                  label="WFH setup"
                  value={scope.wfhSetup === true ? 'Yes' : scope.wfhSetup === false ? 'No' : ''}
                />
              </ScopeRow>
            ) : null}

            {scope.petFriendly !== undefined || scope.familySizeDetails ? (
              <ScopeRow>
                <ScopeField
                  label="Pet friendly"
                  value={
                    scope.petFriendly === true ? 'Yes' : scope.petFriendly === false ? 'No' : ''
                  }
                />
                <ScopeField label="Family size & details" value={scope.familySizeDetails || ''} />
              </ScopeRow>
            ) : null}

            {scope.familyContactName || scope.familyContactPhone ? (
              <ScopeRow>
                <ScopeField label="Family contact" value={scope.familyContactName || ''} />
                <ScopeField label="Family phone" value={scope.familyContactPhone || ''} />
              </ScopeRow>
            ) : null}
          </table>
        </Section>
      )}

      {/* Room cards */}
      {hasRooms &&
        scope.rooms!.map((room, idx) => (
          <Section
            key={`${room.roomName ?? 'room'}-${idx}`}
            style={{
              width: '100%',
              border: '1px solid #e5e7eb',
              borderLeft: '3px solid #7c3aed',
              borderRadius: '6px',
              backgroundColor: '#fafafc',
              padding: '12px 14px',
              marginBottom: '10px',
            }}
          >
            <Text
              style={{
                margin: 0,
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#111827',
                fontFamily: 'sans-serif',
              }}
            >
              {room.roomName || 'Room'}
            </Text>

            <Row>
              <Column style={{ width: '50%', paddingRight: '8px' }}>
                <p style={LABEL_STYLE}>Units required</p>
                <p style={VALUE_STYLE}>{room.units || '—'}</p>
              </Column>
              <Column style={{ width: '50%' }}>
                <p style={LABEL_STYLE}>False ceiling</p>
                <p style={VALUE_STYLE}>{room.falseCeiling ? 'Yes' : 'No'}</p>
              </Column>
            </Row>

            {room.notes?.trim() ? (
              <Section style={{ marginTop: '8px' }}>
                <p style={LABEL_STYLE}>Room notes</p>
                <p
                  style={{
                    ...VALUE_STYLE,
                    fontSize: '12px',
                    color: '#4b5563',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    marginTop: '2px',
                  }}
                >
                  {room.notes.trim()}
                </p>
              </Section>
            ) : null}
          </Section>
        ))}
    </>
  );
}

// ─── Main template ─────────────────────────────────────────────────────────────

export default function MailLoopChainInitiateEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  clientFullName = 'Customer',
  dateOfCall = '[Date]',
  addressCity = 'N/A',
  projectType = '[New Home / Renovation]',
  propertyName = '',
  propertyConfiguration = '',
  possession = '',
  leadSource = '',
  salesLeadName = '',
  scopeOfWork = 'Woodwork · Kitchen · Flooring · Civil',
  totalAmount = 'N/A',
  salesConsultantInfo = '[Name] · [Branch]',
  bookingReceived = 'Pending',
  amountPaid = '',
  timelinePromise = '',
  specialOffer = '',
  customCommitments = '',
  quotationLink = '',
  configScope = null,
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
    {
      label: 'Project value',
      value:
        totalAmount === 'N/A' || totalAmount === '[Total Amount]'
          ? totalAmount
          : totalAmount.startsWith('₹')
            ? totalAmount
            : `₹${totalAmount}`,
    },
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
    ...(quotationLink
      ? [
          {
            label: 'Project quotation',
            value: (
              <a
                href={quotationLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#dc2626',
                  textDecoration: 'underline',
                  fontWeight: 700,
                  fontSize: '16px',
                }}
              >
                View Quotation ↗
              </a>
            ),
            subtitle: 'Click to view latest quote online',
            badge: <StatusBadge variant="confirmed">Ready</StatusBadge>,
          },
        ]
      : []),
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

        {/* Scope of work — basic from View modal */}
        {configScope && <DesignScopeSection scope={configScope} />}

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
