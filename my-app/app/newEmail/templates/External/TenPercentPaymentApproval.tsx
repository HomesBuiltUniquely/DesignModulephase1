import * as React from 'react';
import { Text, Section, Link } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';

export interface TenPercentPaymentApprovalEmailProps {
  customerName?: string;
  projectId?: string;
  designerName?: string;
  amountPaid?: string | number;
  paymentDate?: string;
  transactionRef?: string;
  totalProjectValue?: string | number;
  paymentMode?: string;
}

function formatIndianCurrency(amount: string | number | undefined): string {
  if (amount === undefined || amount === null || amount === '—' || amount === '') return '—';
  const num = typeof amount === 'number' 
    ? amount 
    : Number(String(amount).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(amount);
  
  const parts = num.toFixed(0).split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherParts = parts[0].substring(0, parts[0].length - 3);
  if (otherParts !== '') {
    lastThree = ',' + lastThree;
  }
  const formatted = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `₹${formatted}`;
}

export default function TenPercentPaymentApprovalEmail({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  designerName = 'Your Design Consultant',
  amountPaid = '',
  paymentDate = '',
  transactionRef = '',
  totalProjectValue = '',
  paymentMode = 'Bank Transfer (NEFT)',
}: TenPercentPaymentApprovalEmailProps) {
  
  const numTotal = totalProjectValue 
    ? (typeof totalProjectValue === 'number' ? totalProjectValue : Number(String(totalProjectValue).replace(/[^0-9.]/g, '')))
    : NaN;
    
  let rawAmountPaid = amountPaid;
  if (!rawAmountPaid && !isNaN(numTotal)) {
    rawAmountPaid = numTotal * 0.10;
  }
  
  const numPaid = rawAmountPaid 
    ? (typeof rawAmountPaid === 'number' ? rawAmountPaid : Number(String(rawAmountPaid).replace(/[^0-9.]/g, '')))
    : NaN;

  const displayTotalValue = !isNaN(numTotal) ? numTotal : (numPaid ? numPaid * 10 : '');
  const displayAmountPaid = !isNaN(numPaid) ? numPaid : '';
  const displayBalanceRemaining = (!isNaN(numTotal) && !isNaN(numPaid)) ? (numTotal - numPaid) : (numPaid ? numPaid * 9 : '');

  const displayReceiptNumber = transactionRef || `HI-REC-2026-${projectId.replace(/[^0-9]/g, '') || '0387'}`;
  const displayPaymentDate = paymentDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://hubinteriors.in';
  
  // Clean values for query parameters
  const queryParams = [
    `customerName=${encodeURIComponent(customerName)}`,
    `projectId=${encodeURIComponent(projectId)}`,
    `amountPaid=${encodeURIComponent(String(displayAmountPaid))}`,
    `paymentDate=${encodeURIComponent(displayPaymentDate)}`,
    `paymentMode=${encodeURIComponent(paymentMode)}`,
    `transactionRef=${encodeURIComponent(displayReceiptNumber)}`,
    `totalProjectValue=${encodeURIComponent(String(displayTotalValue))}`,
    `type=10p`
  ].join('&');
  
  const receiptUrl = `${baseUrl}/receipt?${queryParams}`;

  return (
    <BaseLayout projectId={projectId}>
      {/* Premium Header StageBar */}
      <table width="100%" cellPadding="0" cellSpacing="0" style={{ backgroundColor: '#FFF5F5', padding: '12px 24px', borderBottom: '1px solid #F3F4F6' }}>
        <tr>
          <td align="left" style={{ fontSize: '12px', fontWeight: 'bold', color: '#E02424', letterSpacing: '0.5px' }}>
            PAYMENT CONFIRMED
          </td>
          <td align="right" style={{ fontSize: '11px', fontWeight: 'bold', color: '#E02424', letterSpacing: '0.5px' }}>
            10% MILESTONE - READY FOR SITE MASKING
          </td>
        </tr>
      </table>

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        {/* Greeting & Title */}
        <Text className="m-0 text-[15px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          Payment received — thank you
        </Text>
        
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-mediumGrey pb-4">
          We have successfully received and confirmed your milestone payment. Your project is now cleared to proceed to the next phase.
        </Text>

        {/* AMOUNT RECEIVED CARD */}
        <div style={{ backgroundColor: '#E02424', borderRadius: '8px', padding: '20px 24px', color: '#FFFFFF', margin: '20px 0' }}>
          <table width="100%" cellPadding="0" cellSpacing="0">
            <tr>
              <td align="left">
                <span style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.8, letterSpacing: '1px', display: 'block' }}>
                  AMOUNT RECEIVED
                </span>
                <span style={{ fontSize: '28px', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                  {formatIndianCurrency(displayAmountPaid)}
                </span>
              </td>
              <td align="right" style={{ verticalAlign: 'middle' }}>
                <span style={{ backgroundColor: '#FFFFFF', color: '#E02424', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  10% MILESTONE
                </span>
              </td>
            </tr>
          </table>
        </div>

        {/* DETAILS TABLE */}
        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse', width: '100%', borderLeft: '4px solid #E02424', backgroundColor: '#FAFAFA', borderRadius: '0 8px 8px 0', overflow: 'hidden', margin: '24px 0' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280' }}>Receipt number</td>
              <td align="right" style={{ padding: '12px 20px', fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{displayReceiptNumber}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280' }}>Payment date</td>
              <td align="right" style={{ padding: '12px 20px', fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{displayPaymentDate}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280' }}>Payment mode</td>
              <td align="right" style={{ padding: '12px 20px', fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{paymentMode}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280' }}>Project ID</td>
              <td align="right" style={{ padding: '12px 20px', fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{projectId}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280' }}>Total project value</td>
              <td align="right" style={{ padding: '12px 20px', fontSize: '14px', color: '#1F2937', fontWeight: 500 }}>{formatIndianCurrency(displayTotalValue)}</td>
            </tr>
            <tr>
              <td style={{ padding: '12px 20px', fontSize: '14px', color: '#6B7280' }}>Balance remaining</td>
              <td align="right" style={{ padding: '12px 20px', fontSize: '14px', color: '#E02424', fontWeight: 'bold' }}>{formatIndianCurrency(displayBalanceRemaining)}</td>
            </tr>
          </tbody>
        </table>

        {/* PROGRESS BADGE */}
        <div style={{ border: '1px solid #DEF7EC', backgroundColor: '#F3FBF7', borderRadius: '6px', padding: '10px 16px', display: 'inline-block', margin: '8px 0 24px 0' }}>
          <table cellPadding="0" cellSpacing="0">
            <tr>
              <td style={{ fontSize: '13px', color: '#03543F', fontWeight: 500 }}>
                <span style={{ color: '#31C48D', marginRight: '6px' }}>●</span>
                Confirmed · Site masking phase begins within 24 hours
              </td>
            </tr>
          </table>
        </div>

        {/* DOWNLOAD BUTTON */}
        <div style={{ textAlign: 'center', margin: '20px 0 32px 0' }}>
          <Link
            href={receiptUrl}
            style={{
              backgroundColor: '#E02424',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 'bold',
              textDecoration: 'none',
              display: 'inline-block',
              letterSpacing: '0.5px',
            }}
          >
            DOWNLOAD RECEIPT PDF
          </Link>
          <Text style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px', fontStyle: 'italic' }}>
            This is an official payment receipt. Please retain for your records.
          </Text>
        </div>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-1">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">Hub Interiors Finance Team</Text>
          <Text className="m-0 text-[13px] text-neutral-mediumGrey">
            finance@hubinteriors.in · +91 80 1234 5678
          </Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
