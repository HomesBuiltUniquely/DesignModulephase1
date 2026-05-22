import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface DesignSignoff40pcPaymentRequestEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  amount?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export default function DesignSignoff40pcPaymentRequestEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  amount = '0.00',
  accountName = 'Brightspace Creation Private Limited',
  accountNumber = '748305000519',
  ifscCode = 'ICIC0007483',
}: DesignSignoff40pcPaymentRequestEmailProps) {
  const paymentDetails: DetailItem[] = [
    { label: 'Payable Amount (40%)', value: `₹ ${amount}` },
  ];

  const bankDetails: DetailItem[] = [
    { label: 'Account Name', value: accountName },
    { label: 'Account Number', value: accountNumber },
    { label: 'IFSC Code', value: ifscCode },
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="DESIGN SIGN-OFF" status="40% PAYMENT DUE" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Design Sign-Off Completed & 40% Milestone Payment
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          Thank you for your time during the Design Sign-Off discussion. As aligned, the final drawings, material selections, hardware specifications, and scope have now been formally confirmed. We will now proceed to the next stage of your project.
        </Text>
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          To initiate production planning and block your execution schedule, we request the 40% milestone payment.
        </Text>

        {/* Payment Summary */}
        <DetailsList title="PAYMENT SUMMARY" items={paymentDetails} />

        {/* Bank Details */}
        <DetailsList title="BANK ACCOUNT DETAILS" items={bankDetails} />

        <div className="text-center mt-6 mb-6">
          <Button text="PAY 40% MILESTONE" href="#" />
        </div>

        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          Upon payment confirmation:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          <li className="mb-1">Production slot will be allocated</li>
          <li className="mb-1">Project timeline will be activated</li>
          <li className="mb-1">Execution coordination will begin</li>
        </ul>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please feel free to reach out if any clarification is required.
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
