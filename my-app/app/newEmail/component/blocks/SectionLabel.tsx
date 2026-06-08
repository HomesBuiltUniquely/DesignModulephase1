import * as React from 'react';
import { Section, Text } from '@react-email/components';

export interface SectionLabelProps {
  children: React.ReactNode;
}

export const SectionLabel = ({ children }: SectionLabelProps) => {
  return (
    <Section className="w-full mb-3">
      <table cellPadding={0} cellSpacing={0} border={0} className="w-full">
        <tr>
          <td className="align-middle whitespace-nowrap pr-3">
            <Text className="m-0 text-brand-primary font-sans text-[10px] font-bold tracking-[2.5px] uppercase">
              {children}
            </Text>
          </td>
          <td className="align-middle w-full">
            <div className="h-px bg-neutral-lightGrey w-full" />
          </td>
        </tr>
      </table>
    </Section>
  );
};
