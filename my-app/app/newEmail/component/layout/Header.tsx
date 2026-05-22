import * as React from 'react';
import { Section, Row, Column, Img, Text } from '@react-email/components';
import { theme } from '../../theme';

interface HeaderProps {
  projectId?: string;
} 

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';

export const Header = ({ projectId = '' }: HeaderProps) => {
  return (
    <Section className="bg-brand-primary px-8 py-3  rounded-t-xl w-full">
      <Row className='m-2'>
        {/* Left Side: Logo and Title */}
        <Column align="left">
          <table cellPadding={0} cellSpacing={0} border={0}>
            <tr>
              <td className="align-middle text-center">
                <Img
                  src={`${baseUrl}/static/logo.png`}
                  width="100"
                  height="auto"
                  alt="HUB Logo"
                  className="block mx-auto"
                />
              </td>
              <td className="pl-3 align-middle">
                <Text className="m-0 text-white font-serif text-[20px] font-bold tracking-wide leading-none">
                  HUB INTERIORS
                </Text>
                <Text className="m-0 mt-0.5 text-white font-sans text-[11px] tracking-widest uppercase opacity-90 leading-none">
                  Homes Build Uniquely
                </Text>
              </td>
            </tr>
          </table>
        </Column>
        
        {/* Right Side: Project ID */}
        <Column align="right" className="align-middle text-right">
          <Text className="m-0 text-white font-sans text-[12px] tracking-wide uppercase opacity-90 leading-none">
            PROJECT ID
          </Text>
          <Text className="m-0 mt-1 text-white font-sans text-[18px] font-bold leading-none">
            {projectId}
          </Text>
        </Column>
      </Row>
    </Section>
  );
};
