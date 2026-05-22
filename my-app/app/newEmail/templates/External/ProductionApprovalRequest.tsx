import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { Button } from '../../component/blocks/Button';
import { FileList, FileItem } from '../../component/blocks/FileList';

export interface ProductionApprovalRequestEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  attachments?: FileItem[];
}

export default function ProductionApprovalRequestEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  attachments = [],
}: ProductionApprovalRequestEmailProps) {
  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="PRODUCTION" status="APPROVAL REQUIRED" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          Final Approval Required – Production Initiation
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          With the 40% milestone successfully completed, your project is now ready to move into the production phase.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 font-bold">
          Before we initiate manufacturing, we request your formal approval on the final design package, which includes:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Final drawings</li>
          <li className="mb-1">Material and laminate selections</li>
          <li className="mb-1">Hardware specifications</li>
          <li className="mb-1">Final estimate</li>
          <li className="mb-1">Works contract</li>
        </ul>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Please review the details in ERP and confirm your approval to commence manufacturing.
        </Text>

        {/* Attachments Section */}
        {attachments && attachments.length > 0 && (
          <FileList
            title="PROJECT DOCUMENTS"
            files={attachments.map((a) => ({
              name: (a as any).filename || (a as any).name || 'Document',
              meta: 'Uploaded Document',
              url: (a as any).path || (a as any).url,
            }))}
          />
        )}

        <div className="text-center mt-6 mb-6">
          <Button text="APPROVE FOR PRODUCTION" href="#" />
        </div>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2 mt-4 font-bold">
          Upon receiving your confirmation:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Manufacturing will be initiated</li>
          <li className="mb-1">Execution timeline will be activated</li>
          <li className="mb-1">Your dedicated project POC will be assigned</li>
        </ul>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Kindly note that once production begins, scope or design changes may not be feasible without a formal change request.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
