import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "./auth/AuthContext";

/* ── Body font: Manrope — Google Fonts ── */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

/* ── Heading font: Wulkan ──
   Wulkan is loaded via standard @font-face in globals.css.
   This avoids Next.js build errors when the .woff2 files are not yet in /public/fonts/.
   It gracefully falls back to Georgia until the files are added. */

export const metadata: Metadata = {
  title: "Design Module",
  description: "Design Module",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
