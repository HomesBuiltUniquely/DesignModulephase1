import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';

export interface OfferCardItem {
  label: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
  badge?: React.ReactNode;
}

export interface OfferCardsProps {
  items: OfferCardItem[];
}

export const OfferCards = ({ items }: OfferCardsProps) => {
  const pairs: OfferCardItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }

  return (
    <Section className="w-full mb-7">
      {pairs.map((pair, rowIndex) => (
        <Row key={rowIndex} className={rowIndex > 0 ? 'mt-2.5' : ''}>
          {pair.map((card, colIndex) => (
            <Column
              key={card.label}
              className={`w-1/2 align-top ${colIndex === 0 && pair.length > 1 ? 'pr-1.5' : ''} ${colIndex === 1 ? 'pl-1.5' : ''}`}
            >
              <Section
                className={`rounded-lg border border-neutral-lightGrey bg-neutral-white px-4 py-4 h-full ${
                  card.accent ? 'border-t-2 border-t-brand-primary' : ''
                }`}
              >
                <Text className="m-0 mb-1.5 text-neutral-mediumGrey font-sans text-[10px] tracking-wider uppercase">
                  {card.label}
                </Text>
                <Text
                  className={`m-0 font-serif text-[17px] leading-tight ${
                    card.accent ? 'text-brand-primary' : 'text-neutral-nearBlack'
                  }`}
                >
                  {card.value}
                </Text>
                {(card.subtitle || card.badge) && (
                  <Text className="m-0 mt-1 text-neutral-mediumGrey font-sans text-[11px] leading-relaxed">
                    {card.subtitle}
                    {card.badge ? <> {card.badge}</> : null}
                  </Text>
                )}
              </Section>
            </Column>
          ))}
        </Row>
      ))}
    </Section>
  );
};

export const StatusBadge = ({
  children,
  variant = 'confirmed',
}: {
  children: React.ReactNode;
  variant?: 'confirmed' | 'conditional';
}) => {
  const classes =
    variant === 'conditional'
      ? 'bg-brand-lightBg text-brand-dark border border-brand-mid'
      : 'bg-neutral-offWhite text-neutral-mediumGrey border border-neutral-lightGrey';

  return (
    <span
      className={`inline-block font-sans text-[10px] tracking-wide px-2 py-0.5 rounded-full ${classes}`}
    >
      {children}
    </span>
  );
};
