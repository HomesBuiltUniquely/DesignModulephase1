import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ClientProviders } from "./providers/ClientProviders";
import DesignAppShell from "./Components/DesignAppShell";

/* Self-hosted Manrope — avoids next/font/google Turbopack deploy failures
   (Can't resolve '@vercel/turbopack-next/internal/font/google/font'). */
const manrope = localFont({
  src: "./fonts/Manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  weight: "300 800",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('design-module-theme');
                  const theme = saved === 'dark' ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${manrope.variable} antialiased`}>
        <ClientProviders>
          <DesignAppShell>{children}</DesignAppShell>
        </ClientProviders>
      </body>
    </html>
  );
}
