import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface D1MmtManagerRequestInternalEmailProps {
  projectId?: string;
  customerName?: string;
  designerName?: string;
  mmtManagerName?: string;
  ecName?: string;
  siteAddress?: string;
  visitDate?: string | null;
  visitTime?: string | null;
}

export default function D1MmtManagerRequestInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  designerName = 'Designer',
  mmtManagerName = 'MMT Manager',
  ecName = 'Experience Center',
  siteAddress = '—',
  visitDate = null,
  visitTime = null,
}: D1MmtManagerRequestInternalEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
    { label: 'Experience Center', value: ecName },
    { label: 'Site Address', value: siteAddress },
    { label: 'Designer', value: designerName },
    { label: 'Requested MMT Manager', value: mmtManagerName },
    ...(visitDate ? [{ label: 'Preferred Date', value: visitDate }] : []),
    ...(visitTime ? [{ label: 'Preferred Time', value: visitTime }] : []),
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="D1 MMT REQUEST" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">
          Dear {mmtManagerName},
        </Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          D1 Site Measurement – Assign MMT Executive
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          A D1 site measurement request has been raised for the project below.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please assign an MMT executive from your team so the site visit can be confirmed with the
          client.
        </Text>

        <DetailsList title="PROJECT DETAILS" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Open your dashboard → D1 Requests to assign the executive.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior - ERP Notification</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
