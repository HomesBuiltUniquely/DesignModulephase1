import * as React from 'react';
import { Section, Row, Column, Text, Img, Link } from '@react-email/components';

export interface FileItem {
  name: string;
  meta: string;
  url?: string; // Clickable link URL
  iconUrl?: string; // Optional URL for the file icon
}

export interface FileListProps {
  title?: string;
  files: FileItem[];
}

export const FileList = ({ title = 'FILES UPLOADED', files }: FileListProps) => {
  return (
    <Section className="w-full mb-2">
      {title && (
        <Text className="m-0 mb-3 text-brand-primary font-sans text-[10px] font-bold tracking-widest uppercase">
          {title}
        </Text>
      )}
      <Section className="w-full bg-neutral-white border border-neutral-lightGrey border-l-4 border-l-brand-primary rounded">
        {files.map((file, index) => {
          const isLast = index === files.length - 1;
          const borderClass = isLast ? '' : 'border-b border-neutral-lightGrey';

          return (
            <Row key={index} className="w-full">
              <Column align="center" className={`px-2 py-2 align-middle w-[60px] ${borderClass}`}>
                <div className="bg-brand-mid rounded-md w-8 h-8 inline-block text-center leading-8">
                  {file.iconUrl ? (
                    <Img src={file.iconUrl} width="14" height="14" alt="File" className="inline-block align-middle" />
                  ) : (
                    // Fallback visual if no icon URL is provided
                    <Text className="m-0 text-[14px] text-brand-primary font-bold leading-8">≡</Text> 
                  )}
                </div>
              </Column>
              <Column align="left" className={`px-0 py-3 align-middle ${borderClass}`}>
                {file.url ? (
                  <Link href={file.url} target="_blank" className="m-0 mb-1 text-brand-primary font-sans text-[14px] font-medium underline block">
                    {file.name}
                  </Link>
                ) : (
                  <Text className="m-0 mb-1 text-neutral-nearBlack font-sans text-[14px] font-medium">{file.name}</Text>
                )}
                <Text className="m-0 text-neutral-mediumGrey font-sans text-[12px]">{file.meta}</Text>
              </Column>
            </Row>
          );
        })}
      </Section>
    </Section>
  );
};
