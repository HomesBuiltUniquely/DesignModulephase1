import * as React from 'react';
import { Text, Section, Row, Column } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';

export interface DqcRemark {
  priority: string;
  text: string;
}

export interface DqcReviewFeedbackInternalProps {
  projectId?: string;
  customerName?: string;
  ecName?: string;
  designerName?: string;
  dqcRepName?: string;
  verdict?: string; // 'rejected' | 'approved_with_changes'
  submissionVariant?: 'dqc1' | 'dqc2';
  remarks?: DqcRemark[];
}

export default function DqcReviewFeedbackInternal({
  projectId = 'HI-2025-0000',
  customerName = 'Customer',
  ecName = 'Experience Center',
  designerName = 'Designer',
  dqcRepName = 'DQC Team Member',
  verdict = 'rejected',
  submissionVariant = 'dqc1',
  remarks = [],
}: DqcReviewFeedbackInternalProps) {
  const isRejected = verdict === 'rejected';
  const stageNum = submissionVariant === 'dqc2' ? 'DQC2' : 'DQC1';
  const statusText = isRejected ? 'REJECTED' : 'APPROVED WITH CHANGES';

  const snapshotItems: DetailItem[] = [
    { label: 'Project Name', value: customerName },
    { label: 'Experience Center', value: ecName },
    { label: 'Designer', value: designerName },
    { label: 'Reviewed By', value: dqcRepName },
    { label: 'Stage', value: stageNum },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INTERNAL REVIEW FEEDBACK" status={statusText} />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {designerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          {stageNum} Design Review Feedback: {statusText}
        </Text>

        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          {isRejected ? (
            <span>
              Your recent <strong>{stageNum} design files</strong> submission has been reviewed by the DQC team and is <strong>REJECTED</strong>. Please address the remarks below and resubmit your design for verification.
            </span>
          ) : (
            <span>
              Your recent <strong>{stageNum} design files</strong> submission has been <strong>APPROVED WITH CHANGES</strong>. Please address the remarks below before final freeze.
            </span>
          )}
        </Text>

        <DetailsList title="REVIEW SNAPSHOT" items={snapshotItems} />

        {remarks.length > 0 && (
          <Section className="mt-6 mb-6">
            <Text className="m-0 mb-3 text-brand-primary font-sans text-[12px] font-bold tracking-widest uppercase">
              DQC REMARKS & COMMENTS ({remarks.length})
            </Text>
            <Section className="w-full space-y-4">
              {remarks.map((remark, index) => {
                const priority = (remark.priority || 'medium').toLowerCase();
                const isHigh = priority === 'high';
                const isMedium = priority === 'medium';
                
                const borderColor = isHigh ? '#EF0101' : isMedium ? '#D97706' : '#9CA3AF';
                const bgColor = isHigh ? '#FFF0F0' : isMedium ? '#FEF3C7' : '#F3F4F6';
                const textColor = isHigh ? '#7A0000' : isMedium ? '#78350F' : '#374151';

                return (
                  <Section 
                    key={index} 
                    style={{
                      borderLeft: `4px solid ${borderColor}`,
                      backgroundColor: bgColor,
                      padding: '12px 16px',
                      borderRadius: '4px',
                      marginBottom: '12px'
                    }}
                  >
                    <Row>
                      <Column align="left">
                        <span 
                          style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            color: textColor,
                            backgroundColor: isHigh ? '#FCA5A5' : isMedium ? '#FCD34D' : '#E5E7EB',
                            padding: '2px 6px',
                            borderRadius: '3px',
                          }}
                        >
                          {priority} priority
                        </span>
                      </Column>
                    </Row>
                    <Text 
                      style={{ 
                        margin: '6px 0 0 0', 
                        fontSize: '14px', 
                        color: '#1C1C1C', 
                        lineHeight: '1.5' 
                      }}
                    >
                      {remark.text}
                    </Text>
                  </Section>
                );
              })}
            </Section>
          </Section>
        )}

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          You can also view these comments directly placed on the submitted drawings in the Design CRM panel under lead history/details.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{dqcRepName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">Quality Control Team · HUB Interior</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}
