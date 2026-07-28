import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface D1FilesReadyInternalEmailProps {
  projectId?: string;
  customerName?: string;
  designerName?: string;
  approvedByName?: string;
  fileName?: string | null;
}

/**
 * Internal: D1 measurement files are ready in Files Uploaded (after approve or manager/admin upload).
 */
export default function D1FilesReadyInternalEmail({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  designerName = 'Designer',
  approvedByName = 'MMT Manager',
  fileName = null,
}: D1FilesReadyInternalEmailProps) {
  const details: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Project ID', value: projectId },
    { label: 'Designer', value: designerName },
    { label: 'Ready by', value: approvedByName },
    ...(fileName ? [{ label: 'File', value: fileName }] : []),
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL" status="D1 FILES READY" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {designerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          D1 Measurement Files Uploaded
        </Text>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          D1 site measurement files for the project below are ready. You can review them under{' '}
          <strong>Files Uploaded</strong> on the lead.
        </Text>

        <DetailsList title="PROJECT DETAILS" items={details} />

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          The D1 files upload task is marked complete. Please proceed with the next milestone steps.
        </Text>

        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior - ERP Notification</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
