const fs = require('fs');
const path = require('path');

const templates = [
  {
    name: 'DQC1ReviewRequestInternal',
    stageName: 'INTERNAL',
    status: 'REVIEW REQUEST',
    title: 'DQC1 Review Request',
    bodyLines: [
      "A new project has been submitted for DQC1 review.",
      "Please review the attached drawings and quotations and provide your feedback."
    ]
  },
  {
    name: 'DQC2ApprovalInternal',
    stageName: 'INTERNAL',
    status: 'APPROVAL',
    title: 'DQC2 Approved',
    bodyLines: [
      "The DQC2 phase has been approved.",
      "Please proceed with the subsequent steps in the project timeline."
    ]
  },
  {
    name: 'DQC2AssignPmInternal',
    stageName: 'INTERNAL',
    status: 'ACTION REQUIRED',
    title: 'Assign Project Manager (DQC2)',
    bodyLines: [
      "The project has reached the DQC2 stage.",
      "Please assign a Project Manager to oversee the execution and completion of this project."
    ]
  },
  {
    name: 'DQC2FinalDesignSubmissionInternal',
    stageName: 'INTERNAL',
    status: 'SUBMISSION',
    title: 'DQC2 Final Design Submission',
    bodyLines: [
      "The final design for DQC2 has been submitted for internal review.",
      "Kindly review the attached documents to ensure all standards are met."
    ]
  },
  {
    name: 'NewQuoteGenerated',
    stageName: 'INTERNAL',
    status: 'QUOTE GENERATED',
    title: 'New Quote Generated',
    bodyLines: [
      "A new quote has been generated for the project.",
      "Please review the details in the system."
    ]
  },
  {
    name: 'PmAssignmentNotification',
    stageName: 'INTERNAL',
    status: 'NOTIFICATION',
    title: 'Project Manager Assigned',
    bodyLines: [
      "A new Project Manager has been assigned to the project.",
      "Please sync with the newly assigned PM for onboarding and next steps."
    ]
  },
  {
    name: 'SalesClosurePaymentRejected',
    stageName: 'INTERNAL',
    status: 'ALERT',
    title: 'Sales Closure Payment Rejected',
    bodyLines: [
      "The payment required for sales closure has been rejected.",
      "Please contact the customer to resolve this issue immediately."
    ]
  },
  {
    name: 'TenPercentPaymentInternal',
    stageName: 'INTERNAL',
    status: 'PAYMENT UPDATE',
    title: '10% Payment Received',
    bodyLines: [
      "The initial 10% payment has been confirmed.",
      "The project is officially ready to kick off."
    ]
  },
  {
    name: 'D2MaskingRequestInternal',
    stageName: 'INTERNAL',
    status: 'MASKING REQUEST',
    title: 'D2 Masking Request',
    bodyLines: [
      "A masking request has been initiated for a site.",
      "Please coordinate with the operations team to fulfill this request."
    ]
  }
];

const templateDir = path.join(__dirname, 'my-app/app/newEmail/templates/Internal');

templates.forEach(t => {
  const content = `import * as React from 'react';
import { Text, Section } from '@react-email/components';
import { BaseLayout } from '../../component/layout/BaseLayout';
import { StageBar } from '../../component/blocks/StageBar';

export interface ${t.name}EmailProps {
  projectId?: string;
}

export default function ${t.name}Email({
  projectId = 'HI-2025-0000',
}: ${t.name}EmailProps) {
  return (
    <BaseLayout projectId={projectId}>
      <StageBar stageName="${t.stageName}" status="${t.status}" />

      <Section className="bg-neutral-white px-8 pt-6 pb-8">
        
        {/* Greeting & Title */}
        <Text className="m-0 text-[16px] text-neutral-mediumGrey mb-1">Internal Notification,</Text>
        <Text className="m-0 text-[24px] font-bold text-neutral-nearBlack leading-tight mb-4 font-serif">
          ${t.title}
        </Text>
        
        {/* Intro Paragraph */}
        ${t.bodyLines.map(line => `<Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-2">
          ${line}
        </Text>`).join('\n        ')}

        {/* Closing text */}
        <Text className="m-0 text-[15px] leading-relaxed text-neutral-nearBlack pb-8 mt-4">
          Please review the details in the system.
        </Text>

        {/* Sign off */}
        <Section className="border-t border-neutral-lightGrey pt-6">
          <Text className="m-0 text-[14px] text-neutral-mediumGrey">HUB Interiors - Internal System</Text>
        </Section>

      </Section>
    </BaseLayout>
  );
}
`;

  fs.writeFileSync(path.join(templateDir, `${t.name}.tsx`), content);
  console.log(`Generated ${t.name}.tsx`);
});
