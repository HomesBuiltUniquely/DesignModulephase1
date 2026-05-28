'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ReceiptContent() {
  const searchParams = useSearchParams();

  const customerName = searchParams.get('customerName') || 'Customer';
  const projectId = searchParams.get('projectId') || 'HI-2025-0000';
  const amountPaid = searchParams.get('amountPaid') || '0';
  const paymentDate = searchParams.get('paymentDate') || '';
  const paymentMode = searchParams.get('paymentMode') || 'Bank Transfer (NEFT)';
  const transactionRef = searchParams.get('transactionRef') || '';
  const totalProjectValue = searchParams.get('totalProjectValue') || '';
  const type = searchParams.get('type') || '10p'; // '10p' or '40p'

  const numTotal = totalProjectValue ? Number(String(totalProjectValue).replace(/[^0-9.]/g, '')) : NaN;
  const numPaid = amountPaid ? Number(String(amountPaid).replace(/[^0-9.]/g, '')) : NaN;

  const displayTotalValue = !isNaN(numTotal) ? numTotal : (numPaid ? numPaid * (type === '10p' ? 10 : 2.5) : 0);
  const displayAmountPaid = !isNaN(numPaid) ? numPaid : 0;
  const displayBalanceRemaining = displayTotalValue - displayAmountPaid;

  const displayReceiptNumber = transactionRef || `HI-REC-2026-${projectId.replace(/[^0-9]/g, '') || '0387'}`;
  const displayPaymentDate = paymentDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  function formatIndianCurrency(amount: number): string {
    if (isNaN(amount) || amount === 0) return '₹0';
    const parts = amount.toFixed(0).split('.');
    let lastThree = parts[0].substring(parts[0].length - 3);
    const otherParts = parts[0].substring(0, parts[0].length - 3);
    if (otherParts !== '') {
      lastThree = ',' + lastThree;
    }
    const formatted = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return `₹${formatted}`;
  }

  // Automatically trigger printing/PDF save when the page is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-8 print:bg-white print:p-0">
      
      {/* Floating Action Bar (hidden when printing) */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-[#E02424] hover:bg-[#c81e1e] text-white font-bold py-2.5 px-5 rounded-lg shadow-md transition duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save PDF
        </button>
      </div>

      <div className="w-full max-w-[640px] bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden print:shadow-none print:border-none print:max-w-full">
        
        {/* Stage Header */}
        <div className="bg-[#FFF5F5] border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <span className="text-[12px] font-bold text-[#E02424] tracking-wide uppercase">
            PAYMENT CONFIRMED
          </span>
          <span className="text-[11px] font-bold text-[#E02424] tracking-wide uppercase text-right">
            {type === '10p' ? '10% MILESTONE - READY FOR SITE MASKING' : '40% MILESTONE - DESIGN SIGN-OFF'}
          </span>
        </div>

        {/* Brand Bar */}
        <div className="px-8 pt-8 pb-4 flex justify-between items-center">
          <span className="text-xl font-extrabold text-[#111827] tracking-tight">HUB INTERIORS</span>
          <span className="text-xs text-gray-400 font-mono uppercase">E-RECEIPT</span>
        </div>

        <div className="px-8 pb-8">
          {/* Greeting */}
          <p className="text-gray-500 text-sm mb-1">Dear {customerName},</p>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-2 font-serif">
            Payment received — thank you
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            We have successfully received and confirmed your milestone payment. Your project is now cleared to proceed to the next phase.
          </p>

          {/* Amount Card */}
          <div className="bg-[#E02424] rounded-xl p-6 text-white flex justify-between items-center mb-6">
            <div>
              <span className="text-[11px] font-bold opacity-80 tracking-widest block uppercase">
                AMOUNT RECEIVED
              </span>
              <span className="text-3xl font-extrabold block mt-1">
                {formatIndianCurrency(displayAmountPaid)}
              </span>
            </div>
            <div className="bg-white text-[#E02424] rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
              {type === '10p' ? '10% Milestone' : '40% Milestone'}
            </div>
          </div>

          {/* Details Table */}
          <div className="border-l-4 border-[#E02424] bg-[#FAFAFA] rounded-r-xl overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-4 text-xs text-gray-500 uppercase font-semibold">Receipt number</td>
                  <td className="p-4 text-sm text-gray-900 font-semibold text-right">{displayReceiptNumber}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-4 text-xs text-gray-500 uppercase font-semibold">Payment date</td>
                  <td className="p-4 text-sm text-gray-900 font-medium text-right">{displayPaymentDate}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-4 text-xs text-gray-500 uppercase font-semibold">Payment mode</td>
                  <td className="p-4 text-sm text-gray-900 font-medium text-right">{paymentMode}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-4 text-xs text-gray-500 uppercase font-semibold">Project ID</td>
                  <td className="p-4 text-sm text-gray-900 font-semibold text-right">{projectId}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-4 text-xs text-gray-500 uppercase font-semibold">Total project value</td>
                  <td className="p-4 text-sm text-gray-900 font-medium text-right">{formatIndianCurrency(displayTotalValue)}</td>
                </tr>
                <tr>
                  <td className="p-4 text-xs text-gray-500 uppercase font-semibold">Balance remaining</td>
                  <td className="p-4 text-sm text-[#E02424] font-bold text-right">{formatIndianCurrency(displayBalanceRemaining)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Progress Notification */}
          <div className="border border-[#DEF7EC] bg-[#F3FBF7] rounded-xl px-5 py-3.5 mb-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#03543F]">
              <span className="text-[#31C48D] text-sm leading-none">●</span>
              Confirmed · {type === '10p' ? 'Site masking phase begins within 24 hours' : 'Production phase begins within 24 hours'}
            </div>
          </div>

          {/* Sign Off */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-gray-400 text-xs mb-1">Warm regards,</p>
            <p className="font-bold text-gray-900 text-sm">Hub Interiors Finance Team</p>
            <p className="text-gray-400 text-xs mt-1">
              finance@hubinteriors.in · +91 80 1234 5678
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading receipt...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}
