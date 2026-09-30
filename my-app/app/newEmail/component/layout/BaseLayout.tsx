import * as React from 'react';
import { Html, Head, Body, Container, Tailwind } from '@react-email/components';
import { Header } from './Header';
import { Footer } from './Footer';
import { theme } from '../../theme';

interface BaseLayoutProps {
  children: React.ReactNode;
  projectId?: string;
}

export const BaseLayout = ({ children, projectId }: BaseLayoutProps) => {
  const tailwindConfig: any = {
    theme: {
      extend: {
        colors: {
          brand: theme.colors.brand,
          neutral: theme.colors.neutral,
        },
        fontFamily: {
          sans: theme.fonts.body.split(', '),
          serif: theme.fonts.heading.split(', '),
        },
      },
    },
  };

  return (
    <Html>
      <Head>
        <style>{`
          .hub-pay-btn {
            transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.22s ease,
              filter 0.22s ease,
              background 0.22s ease !important;
            cursor: pointer !important;
          }
          .hub-pay-btn:hover {
            background-color: #C40000 !important;
            background-image: linear-gradient(180deg, #FF2A2A 0%, #D40000 60%, #B00000 100%) !important;
            transform: translateY(-3px) scale(1.03);
            box-shadow: 0 16px 32px rgba(239, 1, 1, 0.48), 0 2px 0 rgba(255,255,255,0.25) inset !important;
            filter: brightness(1.05);
          }
          .hub-pay-btn:active {
            background-color: #9F0000 !important;
            background-image: linear-gradient(180deg, #E00000 0%, #9F0000 100%) !important;
            transform: translateY(1px) scale(0.97);
            box-shadow: 0 4px 12px rgba(239, 1, 1, 0.28), 0 1px 0 rgba(255,255,255,0.12) inset !important;
            filter: brightness(0.98);
          }
          .hub-pay-btn:focus {
            outline: 2px solid #EF0101;
            outline-offset: 3px;
          }
        `}</style>
      </Head>
      <Tailwind config={tailwindConfig}>
        <Body className="bg-neutral-offWhite font-sans">
          <Container className="mx-auto py-6 w-[640px] max-w-full">
            <Header projectId={projectId} />
            {children}
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
