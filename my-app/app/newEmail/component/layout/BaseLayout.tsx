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
      <Head />
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
