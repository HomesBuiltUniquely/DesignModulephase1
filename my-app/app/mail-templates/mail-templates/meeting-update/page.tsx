'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import MeetingUpdateEmail from '@/app/newEmail/templates/External/MeetingUpdate';

function MeetingUpdatePreview() {
  const params = useSearchParams();
  const action = params.get('action') === 'rescheduled' ? 'rescheduled' : 'cancelled';

  if (action === 'rescheduled') {
    return (
      <MeetingUpdateEmail
        action="rescheduled"
        customerName="Anurag Jain"
        projectId="HUB-1024"
        meetingTypeLabel="First cut"
        meetingDate="28 Oct 2026"
        meetingTime="2:30 PM"
        previousMeetingDate="27 Oct 2026"
        previousMeetingTime="11:00 AM"
        meetingMode="online"
        designerName="Arjun R S"
        reason="Customer requested a later slot"
      />
    );
  }

  return (
    <MeetingUpdateEmail
      action="cancelled"
      customerName="Anurag Jain"
      projectId="HUB-1024"
      meetingTypeLabel="First cut"
      meetingDate="27 Oct 2026"
      meetingTime="11:00 AM"
      meetingMode="online"
      designerName="Arjun R S"
      reason="Customer is travelling this week"
    />
  );
}

export default function MeetingUpdateMailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading email preview…</div>}>
      <MeetingUpdatePreview />
    </Suspense>
  );
}
