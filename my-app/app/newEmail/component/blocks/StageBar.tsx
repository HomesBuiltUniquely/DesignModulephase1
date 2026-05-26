import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { theme } from '../../theme';

interface StageBarProps {
  stageName: string;
  status: string;
}

export const StageBar = ({ stageName, status }: StageBarProps) => {
  return (
    <Section className="bg-brand-lightBg px-8 py-3 w-full">
      <Row>
        <Column align="left">
          <Text className="m-0 text-brand-dark font-sans text-[12px] font-bold tracking-widest uppercase">
            {stageName}
          </Text>
        </Column>
        <Column align="right">
          <Text className="m-0 text-brand-primary font-sans text-[12px] font-bold tracking-widest uppercase">
            {status}
          </Text>
        </Column>
      </Row>
    </Section>
  );
};
