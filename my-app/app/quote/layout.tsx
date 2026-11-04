import localFont from 'next/font/local';
import './quoteFonts.css';

/* Same self-hosted Manrope as root layout — keeps quote pages off next/font/google. */
const manrope = localFont({
  src: '../fonts/Manrope-latin-wght-normal.woff2',
  variable: '--font-manrope',
  weight: '300 800',
  display: 'swap',
});

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.variable} quote-page min-h-screen`}>{children}</div>;
}
