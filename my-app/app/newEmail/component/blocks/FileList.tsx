import * as React from 'react';
import { Section, Row, Column, Text, Img } from '@react-email/components';
import { theme } from '../../theme';

export interface FileItem {
  name: string;
  meta: string;
  iconUrl?: string; // Optional URL for the file icon
}

export interface FileListProps {
  title?: string;
  files: FileItem[];
}

export const FileList = ({ title = 'FILES UPLOADED', files }: FileListProps) => {
  return (
    <Section style={containerStyle}>
      <Section style={boxStyle}>
        {title && (
          <Row>
            <Column style={titleColumnStyle}>
              <Text style={titleStyle}>{title}</Text>
            </Column>
          </Row>
        )}
        
        {files.map((file, index) => {
          const isLast = index === files.length - 1;
          const rowBorderStyle = isLast
            ? {}
            : { borderBottom: `1px solid ${theme.colors.neutral.lightGrey}` };

          return (
            <Row key={index} style={rowStyle}>
              <Column style={{ ...iconColumnStyle, ...rowBorderStyle }}>
                <div style={iconContainerStyle}>
                  {file.iconUrl ? (
                    <Img src={file.iconUrl} width="16" height="16" alt="File" style={iconImgStyle} />
                  ) : (
                    // Fallback visual if no icon URL is provided
                    <Text style={fallbackIconStyle}>≡</Text> 
                  )}
                </div>
              </Column>
              <Column style={{ ...textColumnStyle, ...rowBorderStyle }}>
                <Text style={fileNameStyle}>{file.name}</Text>
                <Text style={fileMetaStyle}>{file.meta}</Text>
              </Column>
            </Row>
          );
        })}
      </Section>
    </Section>
  );
};

const containerStyle = {
  width: '100%',
  padding: '24px',
};

const boxStyle = {
  width: '100%',
  backgroundColor: theme.colors.neutral.white,
  border: `1px solid ${theme.colors.neutral.lightGrey}`,
  borderLeft: `3px solid ${theme.colors.brand.primary}`,
  borderRadius: '4px',
};

const titleColumnStyle = {
  padding: '16px 16px 8px 16px',
};

const titleStyle = {
  margin: '0',
  color: theme.colors.brand.primary,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
};

const rowStyle = {
  width: '100%',
};

const iconColumnStyle = {
  width: '48px',
  padding: '12px 0 12px 16px',
  verticalAlign: 'top',
};

const iconContainerStyle = {
  backgroundColor: theme.colors.brand.mid, // Light red background as per theme
  borderRadius: '6px',
  width: '32px',
  height: '32px',
  display: 'inline-block',
  textAlign: 'center' as const,
  lineHeight: '32px',
};

const iconImgStyle = {
  display: 'inline-block',
  verticalAlign: 'middle',
};

const fallbackIconStyle = {
  margin: '0',
  fontSize: '16px',
  lineHeight: '32px',
  color: theme.colors.brand.primary,
  fontWeight: 'bold',
};

const textColumnStyle = {
  padding: '12px 16px',
  verticalAlign: 'top',
};

const fileNameStyle = {
  margin: '0 0 4px 0',
  color: theme.colors.neutral.nearBlack,
  fontFamily: theme.fonts.body,
  fontSize: '14px',
  fontWeight: '500',
};

const fileMetaStyle = {
  margin: '0',
  color: theme.colors.neutral.mediumGrey,
  fontFamily: theme.fonts.body,
  fontSize: '12px',
};
