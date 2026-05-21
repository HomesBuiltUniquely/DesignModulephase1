import * as React from 'react';
import { Section, Row, Column, Img, Text } from '@react-email/components';
import { theme } from '../../theme';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';

export const Footer = () => (
  <Section className="bg-brand-primary px-8 py-6 w-full rounded-b-xl border-t border-brand-primary">
    <Row>


      {/* RIGHT SIDE: Social, Address, Contact */}
      <Column align="left" className="w-[55%] align-top pl-4">
        <Text className="m-0 mb-4 text-white text-[24px] leading-none">
          Ⓕ ✕ ⓘ
        </Text>
        <Text className="m-0 text-white opacity-80 font-sans text-[14px] leading-[24px] font-semibold">
          123 Main Street Anytown, CA 12345
        </Text>
        <Text className="m-0 mt-2 text-white opacity-80 font-sans text-[14px] leading-[24px] font-semibold">
          mail@example.com +123456789
        </Text>
      </Column>
    </Row>
  </Section>
);