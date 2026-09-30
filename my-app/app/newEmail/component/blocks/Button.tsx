import * as React from 'react';
import { Button as ReactEmailButton, Section } from '@react-email/components';

export interface ButtonProps {
  text: string;
  href: string;
}

export const Button = ({ text, href }: ButtonProps) => {
  return (
    <Section className="w-full text-center py-4">
      <ReactEmailButton
        href={href}
        target="_blank"
        className="hub-pay-btn"
        style={{
          backgroundColor: '#EF0101',
          backgroundImage: 'linear-gradient(180deg, #FF3B3B 0%, #EF0101 55%, #D40000 100%)',
          color: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          textAlign: 'center',
          display: 'inline-block',
          padding: '16px 36px',
          borderRadius: '10px',
          border: '1px solid #C40000',
          boxShadow: '0 10px 24px rgba(239, 1, 1, 0.38), 0 2px 0 rgba(255,255,255,0.22) inset',
          lineHeight: '1.2',
          transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease, background 0.22s ease',
        }}
      >
        {text}
        <span style={{ display: 'inline-block', marginLeft: '10px', fontSize: '15px', lineHeight: 1 }}>
          →
        </span>
      </ReactEmailButton>
    </Section>
  );
};
