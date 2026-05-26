import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { theme } from '../../theme';

export interface DetailItem {
  label: string;
  value: string | React.ReactNode;
}

export interface DetailsListProps {
  title?: string;
  items: DetailItem[];
}

export const DetailsList = ({ title = 'MEETING DETAILS', items }: DetailsListProps) => {
  return (
    <Section className="w-full mb-6">
      {title && <Text className="m-0 mb-3 text-brand-primary font-sans text-[12px] font-bold tracking-widest uppercase">{title}</Text>}
      <Section className="w-full bg-neutral-white border border-neutral-lightGrey border-l-4 border-l-brand-primary rounded">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const colClass = isLast 
            ? "px-4 py-3 align-middle" 
            : "px-4 py-3 align-middle border-b border-neutral-lightGrey";

          return (
            <Row key={index} className="w-full">
              <Column align="left" className={`${colClass} w-[40%]`}>
                <Text className="m-0 text-neutral-mediumGrey font-sans text-[14px]">{item.label}</Text>
              </Column>
              <Column align="right" className={`${colClass} w-[60%] text-right`}>
                {typeof item.value === 'string' ? (
                  <Text className="m-0 text-neutral-nearBlack font-sans text-[14px] font-medium">{item.value}</Text>
                ) : (
                  item.value
                )}
              </Column>
            </Row>
          );
        })}
      </Section>
    </Section>
  );
};
