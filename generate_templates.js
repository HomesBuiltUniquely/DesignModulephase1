const fs = require('fs');
const path = require('path');

const templates = [
  {
    name: 'D1MMTVisitScheduled',
    stageName: 'D1 · MMT VISIT',
    status: 'SCHEDULED',
    title: 'MMT Visit Scheduled',
    bodyLines: [
      "We have scheduled a site visit with our Measurement & Marking Team (MMT) to take detailed dimensions of your space.",
      "This helps us ensure our designs are perfectly tailored to your home."
    ],
    bullets: [],
    showMeetingDetails: true
  },
  {
    name: 'D1SiteMeasurement',
    stageName: 'D1 · SITE MEASUREMENT',
    status: 'COMPLETED',
    title: 'Site Measurement Completed',
    bodyLines: [
      "Our Measurement & Marking Team (MMT) has successfully completed the site measurement for your project.",
      "We are now processing these details to begin crafting your preliminary designs."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'D2MaskingRequest',
    stageName: 'D2 · MASKING REQUEST',
    status: 'SUBMITTED',
    title: 'Masking Request Submitted',
    bodyLines: [
      "We have initiated a masking request for your project to protect existing surfaces during our work.",
      "Our team will coordinate the necessary steps shortly."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'DesignSignoff40pcPaymentApproval',
    stageName: 'DESIGN SIGN-OFF',
    status: 'PAYMENT APPROVED',
    title: '40% Payment Approved',
    bodyLines: [
      "Thank you for your prompt response.",
      "We have received and approved your 40% milestone payment. Your project is now moving forward seamlessly."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'DesignSignoff40pcPaymentRequest',
    stageName: 'DESIGN SIGN-OFF',
    status: 'PAYMENT REQUEST',
    title: '40% Payment Request',
    bodyLines: [
      "As we approach the design sign-off stage, we kindly request the 40% milestone payment.",
      "This payment enables us to proceed with the next critical steps in production."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'DesignSignoffMeetingScheduled',
    stageName: 'DESIGN SIGN-OFF',
    status: 'MEETING SCHEDULED',
    title: 'Design Sign-Off Meeting Scheduled',
    bodyLines: [
      "We are ready to finalize all design aspects of your project.",
      "Let's meet to review and sign off on the comprehensive design package."
    ],
    bullets: [
      "Final review of all drawings and finishes",
      "Confirmation of material selections",
      "Official design sign-off"
    ],
    showMeetingDetails: true
  },
  {
    name: 'DQC1DesignFreezeMeetingSummary',
    stageName: 'DQC 1',
    status: 'MEETING SUMMARY',
    title: 'Design Freeze Meeting Summary',
    bodyLines: [
      "Thank you for your time during our recent design freeze meeting.",
      "We have documented all the decisions and adjustments discussed."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'DQC1DesignFreezingScheduled',
    stageName: 'DQC 1',
    status: 'MEETING SCHEDULED',
    title: 'Design Freezing Meeting Scheduled',
    bodyLines: [
      "It is time to freeze the initial design concepts for your space.",
      "Let's connect to finalize the layout and core design elements."
    ],
    bullets: [
      "Review spatial planning and layouts",
      "Confirm core design concepts",
      "Freeze preliminary design"
    ],
    showMeetingDetails: true
  },
  {
    name: 'MomColorLaminateSelectionConfirmation',
    stageName: 'MATERIAL SELECTION',
    status: 'CONFIRMATION',
    title: 'Color & Laminate Selection Confirmed',
    bodyLines: [
      "We have documented your final choices for colors and laminates.",
      "These selections will now be incorporated into your final design package."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'ProductionApprovalRequest',
    stageName: 'PRODUCTION',
    status: 'APPROVAL REQUEST',
    title: 'Production Approval Request',
    bodyLines: [
      "Your project is ready to enter the production phase.",
      "Please review the final details and provide your approval to commence manufacturing."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'ProductionPocTimeline',
    stageName: 'PRODUCTION',
    status: 'TIMELINE UPDATE',
    title: 'Production Timeline & POC Details',
    bodyLines: [
      "Your project is officially in production.",
      "We have outlined the production timeline and assigned a Point of Contact (POC) for your reference."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'ProjectDesignTimeline',
    stageName: 'DESIGN',
    status: 'TIMELINE',
    title: 'Project Design Timeline',
    bodyLines: [
      "We have prepared a detailed timeline for the design phase of your project.",
      "This schedule outlines the key milestones and review points."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'ProjectFileTimeline',
    stageName: 'PROJECT',
    status: 'TIMELINE',
    title: 'Project File & Timeline Update',
    bodyLines: [
      "An update regarding your project files and overall timeline is available.",
      "Please review the latest schedule to stay informed on our progress."
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'TenPercentPaymentApproval',
    stageName: 'INITIAL PAYMENT',
    status: 'APPROVED',
    title: '10% Payment Approved',
    bodyLines: [
      "We have successfully received and approved your 10% advance payment.",
      "Thank you for officially kicking off the project with us!"
    ],
    bullets: [],
    showMeetingDetails: false
  },
  {
    name: 'TenPercentPaymentRequest',
    stageName: 'INITIAL PAYMENT',
    status: 'REQUEST',
    title: '10% Payment Request',
    bodyLines: [
      "To officially begin work on your project and allocate resources, we request the initial 10% payment.",
      "This allows us to move forward with the design and planning phases."
    ],
    bullets: [],
    showMeetingDetails: false
  }
];

const templateDir = path.join(__dirname, 'my-app/app/newEmail/templates/External');

templates.forEach(t => {
  const content = `import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';
import { DetailsList, DetailItem } from '../../component/blocks/DetailsList';
import { Button } from '../../component/blocks/Button';

export interface ${t.name}EmailProps {
  customerName?: string;
  projectId?: string;
  ${t.showMeetingDetails ? `meetingDate?: string;
  meetingTime?: string;
  meetingMode?: 'online' | 'offline' | string;
  meetingLink?: string;
  branchName?: string;` : ''}
  designerName?: string;
}

export default function ${t.name}Email({
  customerName = 'Customer',
  projectId = 'HI-2025-0000',
  ${t.showMeetingDetails ? `meetingDate = 'October 24, 2025',
  meetingTime = '10:00 AM – 12:00 PM',
  meetingMode = 'online',
  meetingLink = '#',
  branchName = 'HUB Experience Center',` : ''}
  designerName = 'Your Design Consultant',
}: ${t.name}EmailProps) {
  ${t.showMeetingDetails ? `const meetingDetails: DetailItem[] = [
    { label: 'Date', value: meetingDate },
    { label: 'Time', value: meetingTime },
  ];

  if (meetingMode === 'offline') {
    meetingDetails.push({ label: 'Location', value: \`\${branchName} Branch\` });
  } else {
    meetingDetails.push({ label: 'Mode', value: 'Online Meeting' });
  }` : ''}

  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="${t.stageName}" status="${t.status}" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Dear {customerName},</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-2 font-serif">
          ${t.title}
        </Text>
        
        {/* Intro Paragraph */}
        ${t.bodyLines.map(line => `<Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          ${line}
        </Text>`).join('\n        ')}

        ${t.showMeetingDetails ? `{/* Meeting Details List */}
        <DetailsList title="MEETING DETAILS" items={meetingDetails} />

        {/* CTA Button / Location Note */}
        {meetingMode === 'online' ? (
          <div className="text-center mt-6 mb-6">
            <Button text="JOIN MEETING" href={meetingLink || '#'} />
          </div>
        ) : (
          <Section className="bg-neutral-nearWhite border border-neutral-lightGrey rounded p-4 my-6 text-center">
            <Text className="m-0 text-[14px] text-neutral-nearBlack">
              We look forward to hosting you at our <span className="font-bold">{branchName} Branch</span> for the presentation.
            </Text>
          </Section>
        )}` : ''}

        ${t.bullets.length > 0 ? `<Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          During this meeting, we will:
        </Text>
        <ul className="m-0 ml-4 p-0 text-[14px] leading-relaxed text-neutral-nearBlack pb-4">
          ${t.bullets.map(b => `<li className="mb-1">${b}</li>`).join('\n          ')}
        </ul>` : ''}

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8">
          ${t.showMeetingDetails ? 'I hope this schedule works for you. In case of any constraints, please feel free to let me know. ' : ''}Looking forward to our continued collaboration.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey mb-2">Warm regards,</Text>
          <Text className="m-0 text-[16px] font-bold text-neutral-nearBlack mb-1">{designerName}</Text>
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
`;

  fs.writeFileSync(path.join(templateDir, `${t.name}.tsx`), content);
  console.log(`Generated ${t.name}.tsx`);
});
