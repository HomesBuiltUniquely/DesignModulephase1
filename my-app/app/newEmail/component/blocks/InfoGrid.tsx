import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';

export interface InfoGridItem {
  label: string;
  value: string;
}

export interface InfoGridProps {
  items: InfoGridItem[];
}

export const InfoGrid = ({ items }: InfoGridProps) => {
  const pairs: InfoGridItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }

  return (
    <Section className="w-full mb-7 border border-neutral-lightGrey rounded-lg overflow-hidden">
      {pairs.map((pair, rowIndex) => (
        <Row key={rowIndex} className="w-full">
          {pair.map((item, colIndex) => {
            const isLastRow = rowIndex === pairs.length - 1;
            const borderBottom = !isLastRow ? 'border-b border-neutral-lightGrey' : '';
            const borderRight =
              colIndex === 0 && pair.length > 1
                ? 'border-r border-neutral-lightGrey'
                : '';

            return (
              <Column
                key={item.label}
                className={`w-1/2 bg-neutral-nearWhite px-4 py-3.5 align-top ${borderBottom} ${borderRight}`}
              >
                <Text className="m-0 mb-1 text-neutral-mediumGrey font-sans text-[10px] tracking-wide uppercase">
                  {item.label}
                </Text>
                <Text className="m-0 text-neutral-nearBlack font-serif text-[13.5px] leading-snug">
                  {item.value}
                </Text>
              </Column>
            );
          })}
          {pair.length === 1 && <Column className={`w-1/2 ${rowIndex < pairs.length - 1 ? 'border-b border-neutral-lightGrey' : ''}`} />}
        </Row>
      ))}
    </Section>
  );
};
