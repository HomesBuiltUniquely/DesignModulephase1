import { Manrope } from 'next/font/google';
import './quoteFonts.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['400', '500', '600', '700', '800'],
});

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.variable} quote-page min-h-screen`}>{children}</div>;
}
