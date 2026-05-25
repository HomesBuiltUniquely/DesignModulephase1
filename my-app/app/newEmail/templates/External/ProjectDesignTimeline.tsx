import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { Button } from '../../component/blocks/Button';

export interface ProjectDesignTimelineEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
}

export default function ProjectDesignTimelineEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
}: ProjectDesignTimelineEmailProps) {
  const milestones = [
    { num: '1', title: 'First Cut Design Presentation', subtitle: 'Within 2 days from receipt of site measurements' },
    { num: '2', title: 'Design Freezing Meeting', subtitle: 'Within 2 days after the First Cut discussion' },
    { num: '3', title: '10% Payment Collection', subtitle: 'Within 1 day after Design Freezing' },
    { num: '4', title: 'DQC 1 Submission (Internal Review)', subtitle: 'Same day of 10% payment confirmation' },
    { num: '5', title: 'DQC 1 Approval', subtitle: 'Within 1 day of submission' },
    { num: '6', title: 'D2 – Site Masking', subtitle: 'Same day or 1 day after DQC 1 approval' },
    { num: '7', title: 'Color Selection Meeting', subtitle: 'Within 1 day after D2 completion' },
    { num: '8', title: 'DQC 2 Submission', subtitle: 'Within 2 days from color selection' },
    { num: '9', title: 'DQC 2 Approval', subtitle: 'Within 2 days from submission' },
    { num: '10', title: 'Design Sign-Off Meeting', subtitle: 'Same day or 1 day after DQC 2 approval' },
    { num: '11', title: '40% Payment', subtitle: 'Same day or 1 day after sign-off' },
    { num: '12', title: 'Customer Approval for Production', subtitle: 'Same day or next day of payment' },
    { num: '13', title: 'Push to Production (P2P)', subtitle: 'Same day of production approval' },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="DESIGN" status="TIMELINE" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Project Design Timeline
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-6">
          Hi {customerName}, your journey to a beautiful space starts here. Here's an overview of the key stages ahead.
        </Text>

        <Section className="bg-neutral-nearWhite border border-neutral-lightGrey rounded-lg p-6 mb-6">
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-4 font-serif">
            UPCOMING KEY STAGES
          </Text>
          {milestones.map((m, idx) => (
            <Section key={idx} className="mb-4">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td style={{ width: '40px', verticalAlign: 'top' }}>
                    <div className="w-[28px] h-[28px] rounded-full bg-brand-primary text-neutral-white text-center leading-[28px] font-bold text-[13px]">
                      {m.num}
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top' }}>
                    <Text className="m-0 text-[15px] font-bold text-neutral-nearBlack">{m.title}</Text>
                    <Text className="m-0 text-[13px] text-neutral-mediumGrey">{m.subtitle}</Text>
                  </td>
                </tr>
              </table>
            </Section>
          ))}
        </Section>

        <div className="text-center mt-6 mb-6">
          <Button text="PROJECT DASHBOARD" href="#" />
        </div>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Looking forward to our continued collaboration.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interior</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
