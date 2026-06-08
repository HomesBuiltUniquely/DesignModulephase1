import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { StatusBadge } from './OfferCards';

export interface FreebieItem {
  title: string;
  description: string;
  badge?: React.ReactNode;
  badgeVariant?: 'confirmed' | 'conditional';
}

export interface FreebieListProps {
  items: FreebieItem[];
}

export const FreebieList = ({ items }: FreebieListProps) => {
  return (
    <Section className="w-full mb-7">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const badge =
          item.badge ??
          (item.badgeVariant ? (
            <StatusBadge variant={item.badgeVariant}>
              {item.badgeVariant === 'conditional' ? 'Conditional' : 'Included'}
            </StatusBadge>
          ) : null);

        return (
          <table
            key={item.title}
            cellPadding={0}
            cellSpacing={0}
            border={0}
            className={`w-full ${isLast ? '' : 'border-b border-neutral-lightGrey'}`}
          >
            <tr>
              <td className="w-[3px] bg-brand-primary align-stretch py-3 pr-3" />
              <td className="py-3 align-top">
                <Text className="m-0 font-serif text-[13.5px] text-neutral-nearBlack">
                  {item.title}
                  {badge ? <> {badge}</> : null}
                </Text>
                <Text className="m-0 mt-1 font-sans text-[12px] text-neutral-mediumGrey leading-relaxed">
                  {item.description}
                </Text>
              </td>
            </tr>
          </table>
        );
      })}
    </Section>
  );
};
