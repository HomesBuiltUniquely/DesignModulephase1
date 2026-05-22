import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface TenPercentPaymentRequestEmailProps {
  customerName?: string;
  projectId?: string;
  propertyType?: string;
  amountDue?: string;
  dueDate?: string;
  designerName?: string;
}

export default function TenPercentPaymentRequestEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  propertyType = '',
  amountDue = '',
  dueDate = '',
  designerName = 'Your Design Consultant',
}: TenPercentPaymentRequestEmailProps) {
  const paymentDetails: DetailItem[] = [
    { label: 'Project ID', value: projectId },
    ...(propertyType ? [{ label: 'Property Type', value: propertyType }] : []),
    ...(amountDue ? [{ label: 'Payable Amount', value: amountDue }] : []),
    ...(dueDate ? [{ label: 'Due Date', value: dueDate }] : []),
  ];

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="INITIAL PAYMENT" status="REQUEST" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Ready for Site Masking – 10% Milestone
        </Text>
        
        {/* Intro Paragraph */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-4">
          We’re pleased to inform you that your design has been successfully reviewed and approved under DQC 1.
          Your project is now ready to move into the Site Masking & Detailed Development stage. To initiate this next step, we request the 10% milestone payment.
        </Text>

        {/* Payment Summary */}
        <DetailsList title="PAYMENT SUMMARY" items={paymentDetails} />

        {/* Bank Account Details */}
        <Section className="w-full mb-6 mt-6">
          <Text className="m-0 mb-3 text-brand-primary font-sans text-[12px] font-bold tracking-widest uppercase">
            BANK ACCOUNT DETAILS
          </Text>
          <Section className="w-full bg-neutral-white border border-neutral-lightGrey border-l-4 border-l-brand-primary rounded p-4">
            <table cellPadding={0} cellSpacing={0} border={0} className="w-full text-[13px] text-neutral-nearBlack">
              <tr>
                <td className="py-2 pr-4 text-neutral-mediumGrey font-medium w-[40%]">Company Name</td>
                <td className="py-2 text-neutral-nearBlack font-bold">Brightspace Creation Private Limited</td>
              </tr>
              <tr className="border-t border-neutral-lightGrey">
                <td className="py-2 pr-4 text-neutral-mediumGrey font-medium">Bank Name</td>
                <td className="py-2 text-neutral-nearBlack font-bold">ICICI Bank</td>
              </tr>
              <tr className="border-t border-neutral-lightGrey">
                <td className="py-2 pr-4 text-neutral-mediumGrey font-medium">Account Type</td>
                <td className="py-2 text-neutral-nearBlack font-bold">Current Account</td>
              </tr>
              <tr className="border-t border-neutral-lightGrey">
                <td className="py-2 pr-4 text-neutral-mediumGrey font-medium">Account Number</td>
                <td className="py-2 text-neutral-nearBlack font-bold">748305000519</td>
              </tr>
              <tr className="border-t border-neutral-lightGrey">
                <td className="py-2 pr-4 text-neutral-mediumGrey font-medium">IFSC Code</td>
                <td className="py-2 text-neutral-nearBlack font-bold">ICIC0007483</td>
              </tr>
              <tr className="border-t border-neutral-lightGrey">
                <td className="py-2 pr-4 text-neutral-mediumGrey font-medium">Payment Reference</td>
                <td className="py-2 text-neutral-nearBlack font-bold">{projectId}-10PCT</td>
              </tr>
            </table>
          </Section>
        </Section>

        {/* CTA Button */}
        <div className="text-center mt-6 mb-8">
          <Button text="PAY 10% NOW" href="#" />
          <Text className="m-0 mt-4 text-[12px] text-neutral-mediumGrey leading-relaxed max-w-[480px] mx-auto">
            You can also make a bank transfer using the above details and share the confirmation screenshot with your designer.
          </Text>
        </div>

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          Looking forward to our continued collaboration.
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
