'use client';

import { use } from 'react';
import { QuoteExperience } from '@/app/quote/QuoteExperience';

type PageProps = { params: Promise<{ quoteId: string }> };

export default function SharedQuotePage(props: PageProps) {
  const { quoteId: quoteIdRaw } = use(props.params);
  return <QuoteExperience quoteId={String(quoteIdRaw ?? '').trim()} />;
}
