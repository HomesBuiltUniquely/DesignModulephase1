import { QUOTE_FONTS } from './quoteBrand';

export const QUOTE = {
  red: '#c1272d',
  brown: '#3d2b1f',
  brownDark: '#2a1d14',
  gold: '#c9a84c',
  beige: '#f7f3ef',
  cream: '#faf8f5',
  border: '#e8e0d8',
  muted: '#6b6560',
  fonts: QUOTE_FONTS,
};

export function inr(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `₹ ${v.toLocaleString('en-IN')}`;
  }
  return '-';
}

export function inrFull(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `₹ ${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return '-';
}
