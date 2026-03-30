function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function ordinal(day: number): string {
  const mod10 = day % 10;
  const mod100 = day % 100;
  if (mod10 === 1 && mod100 !== 11) return `${day}st`;
  if (mod10 === 2 && mod100 !== 12) return `${day}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${day}rd`;
  return `${day}th`;
}

function formatLongDate(date: Date): string {
  const month = date.toLocaleString("en-IN", { month: "long" });
  const year = date.getFullYear();
  return `${ordinal(date.getDate())} ${month} ${year}`;
}

export type ProjectFileTimelineEmailParams = {
  customerName: string;
  projectId: string;
  customerEmail: string;
  designLeadName: string;
  designerName: string;
  pmName: string;
  spmName: string;
  estimateValue: string;
  projectConfiguration: string;
  designApprovalDate: string; // yyyy-mm-dd
  estimateDays: number;
};

export function renderProjectFileTimelineEmail(params: ProjectFileTimelineEmailParams): string {
  const baseDate = new Date(`${params.designApprovalDate}T00:00:00`);
  const dispatchStart = addDays(baseDate, 20);
  const dispatchEnd = addDays(baseDate, 21);
  const moveInStart = addDays(baseDate, params.estimateDays);
  const moveInEnd = addDays(moveInStart, 8);

  const dispatchRange = `${formatLongDate(dispatchStart)} - ${formatLongDate(dispatchEnd)}`;
  const moveInRange = `${formatLongDate(moveInStart)}; ${formatLongDate(moveInEnd)}`;
  const approvalDate = formatLongDate(baseDate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Timeline Update</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;">
  <div style="max-width:760px;margin:24px auto;background:#ffffff;border:1px solid #e6e9f2;border-radius:14px;padding:24px 26px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;">
    <h2 style="margin:0 0 14px 0;color:#3b3f75;">++ TIMELINE FOR ${params.customerName.toUpperCase()} - HUB ${params.projectId} ++</h2>
    <p style="margin:0 0 10px 0;">Hello ${params.customerName},</p>
    <p style="margin:0 0 10px 0;">Your home is getting ready!</p>

    <p style="margin:0 0 12px 0;">
      Your Before Installation production is ready for dispatch at site (40% payment) date - <strong>${dispatchRange}</strong>.<br/>
      <strong>Note:</strong> Dispatch will be initiated within 48hrs from the date of payment.
    </p>

    <p style="margin:0 0 12px 0;">
      <strong>Note:</strong> This timeline is contingent upon the completion of the 40% payment only. As per our standard policy, the project will kick off on the next working day from the drawing approval date.
      Drawing was approved on <strong>${approvalDate}</strong> as per the records.
    </p>

    <p style="margin:0 0 12px 0;">
      You can expect to move-in to the brand new home within <strong>${moveInRange}</strong>, if dependencies are holidays.
    </p>

    <div style="background:#f8f9ff;border:1px solid #e0e5ff;border-radius:10px;padding:12px 14px;margin:14px 0;">
      <p style="margin:0 0 6px 0;font-weight:700;">Project details submitted</p>
      <p style="margin:0;">Customer Email: ${params.customerEmail}</p>
      <p style="margin:0;">Design Lead: ${params.designLeadName}</p>
      <p style="margin:0;">Designer: ${params.designerName}</p>
      <p style="margin:0;">PM: ${params.pmName}</p>
      <p style="margin:0;">SPM: ${params.spmName}</p>
      <p style="margin:0;">Estimate: ${params.estimateValue}</p>
      <p style="margin:0;">Configuration: ${params.projectConfiguration}</p>
    </div>

    <p style="margin:0 0 6px 0;"><strong>PS:</strong></p>
    <ul style="margin:0 0 12px 18px;padding:0;">
      <li>Timeline may vary due to pandemic outbreak or government restrictions.</li>
      <li>Committed timelines will not be applicable in case of any delays in payments at any stage or delays in dependent works not in our scope.</li>
      <li>If dispatch is ready but cannot be delivered due to customer-side reasons, inventory charges of Rs.500/day apply from scheduled dispatch date till actual dispatch date.</li>
      <li>Please refer to the works contract for better understanding.</li>
      <li>Site readiness will be initiated after design phase.</li>
    </ul>

    <p style="margin:0 0 4px 0;">Thank you for being a great customer!</p>
    <p style="margin:0;">Thanks & Regards,<br/>Team HUB Interior</p>
  </div>
</body>
</html>`;
}
