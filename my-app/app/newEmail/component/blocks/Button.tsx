import * as React from 'react';
import { Button as ReactEmailButton, Section } from '@react-email/components';
import { theme } from '../../theme';

export interface ButtonProps {
  text: string;
  href: string;
}

export const Button = ({ text, href }: ButtonProps) => {
  return (
    <Section className="w-full text-center py-4">
      <ReactEmailButton 
        href={href} 
        className="bg-brand-primary text-neutral-white font-sans text-[12px] font-bold tracking-widest px-8 py-4 rounded uppercase text-center w-auto inline-block"
      >
        {text}
      </ReactEmailButton>
    </Section>
  );
};
