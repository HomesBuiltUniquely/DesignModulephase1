import * as React from 'react';
import { Section, Row, Column, Img, Text } from '@react-email/components';
import { theme } from '../../theme';

interface HeaderProps {
  projectId: string;
}

export const Header = ({ projectId }: HeaderProps) => {
  return (
    <Section style={headerStyle}>
      <Row>
        {/* Left Side: Logo and Title */}
        <Column align="left">
          <table cellPadding={0} cellSpacing={0} border={0}>
            <tr>
              <td style={logoContainerStyle}>
                <Img
                  // Note: In Next.js/React Email, images should typically be served from a public URL or the static folder.
                  // You might need to move "Pasted image.png" to your public directory or provide an absolute URL when sending the email.
                  src="/images/Pasted image.png"
                  width="44"
                  height="44"
                  alt="HUB Logo"
                  style={logoImgStyle}
                />
              </td>
              <td style={titleContainerStyle}>
                <Text style={titleStyle}>HUB INTERIORS</Text>
                <Text style={taglineStyle}>Homes Build Uniquely</Text>
              </td>
            </tr>
          </table>
        </Column>
        
        {/* Right Side: Project ID */}
        <Column align="right" style={rightColumnStyle}>
          <Text style={projectIdLabelStyle}>PROJECT ID</Text>
          <Text style={projectIdValueStyle}>{projectId}</Text>
        </Column>
      </Row>
    </Section>
  );
};

const headerStyle = {
  backgroundColor: theme.colors.brand.primary,
  padding: '24px',
  borderTopLeftRadius: '12px',
  borderTopRightRadius: '12px',
  width: '100%',
};

const logoContainerStyle = {
  backgroundColor: theme.colors.neutral.white,
  borderRadius: '8px',
  padding: '6px',
  width: '56px',
  height: '56px',
  verticalAlign: 'middle',
  textAlign: 'center' as const,
};

const logoImgStyle = {
  display: 'block',
  margin: '0 auto',
};

const titleContainerStyle = {
  paddingLeft: '16px',
  verticalAlign: 'middle',
};

const titleStyle = {
  margin: '0',
  color: theme.colors.neutral.white,
  fontFamily: theme.fonts.heading,
  fontSize: '20px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
};

const taglineStyle = {
  margin: '4px 0 0 0',
  color: theme.colors.neutral.white,
  fontFamily: theme.fonts.body,
  fontSize: '11px',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  opacity: 0.9,
};

const rightColumnStyle = {
  verticalAlign: 'middle',
  textAlign: 'right' as const,
};

const projectIdLabelStyle = {
  margin: '0',
  color: theme.colors.neutral.white,
  fontFamily: theme.fonts.body,
  fontSize: '10px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase' as const,
  opacity: 0.9,
};

const projectIdValueStyle = {
  margin: '2px 0 0 0',
  color: theme.colors.neutral.white,
  fontFamily: theme.fonts.body,
  fontSize: '18px',
  fontWeight: 'bold',
};
