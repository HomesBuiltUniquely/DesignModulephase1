import * as React from 'react';
import { Section, Row, Column, Img, Text } from '@react-email/components';
import { theme } from '../../theme';

export const Footer = () => {
  return (
    <Section style={footerStyle}>
      <Row>
        {/* Left Column: Logo and Brand Info */}
        <Column align="left" style={leftColumnStyle}>
          <div style={logoContainerStyle}>
            <Img
              src="/images/Pasted image.png"
              width="36"
              height="36"
              alt="HUB Logo"
              style={logoImgStyle}
            />
          </div>
          <Text style={brandTitleStyle}>HUB INTERIORS</Text>
          <Text style={descriptionStyle}>Homes Build Uniquely.</Text>
          <Text style={descriptionStyle}>We create luxury living</Text>
          <Text style={descriptionStyle}>spaces tailored to you.</Text>
        </Column>

        {/* Right Column: Contact Details */}
        <Column align="right" style={rightColumnStyle}>
          <div style={rightColumnContentStyle}>
            <div style={socialIconContainerStyle}>
              {/* Replace these src paths with actual social icon image paths */}
              <Img src="/images/fb-icon.png" width="20" height="20" alt="Facebook" style={socialIconStyle} />
              <Img src="/images/x-icon.png" width="20" height="20" alt="X" style={socialIconStyle} />
              <Img src="/images/ig-icon.png" width="20" height="20" alt="Instagram" style={socialIconStyle} />
            </div>
            <Text style={contactTextStyle}>123 Main Street Anytown, CA 12345</Text>
            <Text style={contactTextStyle}>mail@example.com +123456789</Text>
          </div>
        </Column>
      </Row>
      <Row>
        <Column>
          <Text style={copyrightStyle}>
            &copy; {new Date().getFullYear()} HUB Interiors. All rights reserved.
          </Text>
        </Column>
      </Row>
    </Section>
  );
};

const footerStyle = {
  backgroundColor: theme.colors.brand.lightBg,
  padding: '32px 24px',
  width: '100%',
  borderBottomLeftRadius: '12px',
  borderBottomRightRadius: '12px',
};

const leftColumnStyle = {
  width: '50%',
  verticalAlign: 'top',
};

const logoContainerStyle = {
  backgroundColor: theme.colors.neutral.white,
  borderRadius: '8px',
  padding: '6px',
  width: '48px',
  height: '48px',
  display: 'inline-block',
  textAlign: 'center' as const,
  marginBottom: '16px',
};

const logoImgStyle = {
  display: 'block',
  margin: '0 auto',
};

const brandTitleStyle = {
  margin: '0 0 8px 0',
  color: theme.colors.brand.dark,
  fontFamily: theme.fonts.heading,
  fontSize: '16px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
};

const descriptionStyle = {
  margin: '0 0 4px 0',
  color: theme.colors.brand.dark,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
  lineHeight: '1.5',
  opacity: 0.8,
};

const rightColumnStyle = {
  width: '50%',
  verticalAlign: 'top',
  textAlign: 'right' as const,
};

const rightColumnContentStyle = {
  display: 'inline-block',
  textAlign: 'left' as const,
};

const socialIconContainerStyle = {
  margin: '0 0 12px 0',
};

const socialIconStyle = {
  display: 'inline-block',
  marginRight: '12px',
};

const contactTextStyle = {
  margin: '0 0 8px 0',
  color: theme.colors.neutral.mediumGrey,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
};

const copyrightStyle = {
  margin: '32px 0 0 0',
  color: theme.colors.brand.dark,
  fontFamily: theme.fonts.body,
  fontSize: '10px',
  textAlign: 'center' as const,
  opacity: 0.6,
  borderTop: `1px solid ${theme.colors.brand.mid}`,
  paddingTop: '16px',
};
