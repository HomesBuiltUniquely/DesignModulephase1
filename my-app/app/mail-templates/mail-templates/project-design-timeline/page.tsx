/**
 * Milestone helper: Project Design Timeline (used across multiple milestones)
 * Primary usage in sheet:
 * - DQC 1 "meeting completed" → Timeline mail if not automated
 * - Later stages as a generic "project timeline" reference mail
 *
 * This template is a reusable timeline email that can be sent
 * after key meetings (e.g. First Cut, Design Freeze) to show
 * the overall journey and upcoming steps.
 */
export default function ProjectDesignTimelineMailPage() {
  const customerName = '[Customer Name]';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-900 leading-7">
        <h1 className="text-2xl font-semibold mb-4">Project Design Timeline – Upcoming Stages</h1>
        <p className="mb-3">Dear {customerName},</p>
        <p className="mb-3">
          Here is the tentative timeline for your project&apos;s design journey. This will help us stay aligned and move
          smoothly from design to production.
        </p>
        <p className="font-semibold mb-2">🗓 Project Design Roadmap</p>
        <ol className="list-decimal ml-6 space-y-2 mb-4">
          <li><span className="font-semibold">1️⃣ First Cut Design Presentation</span><br />→ Within 2 days from receipt of site measurements</li>
          <li><span className="font-semibold">2️⃣ Design Freezing Meeting</span><br />→ Within 2 days after the First Cut discussion</li>
          <li><span className="font-semibold">3️⃣ 10% Payment Collection</span><br />→ Within 1 day after Design Freezing</li>
          <li><span className="font-semibold">4️⃣ DQC 1 Submission (Internal Review)</span><br />→ Same day of 10% payment confirmation</li>
          <li><span className="font-semibold">5️⃣ DQC 1 Approval</span><br />→ Within 1 day of submission</li>
          <li><span className="font-semibold">6️⃣ D2 – Site Masking</span><br />→ Same day or 1 day after DQC 1 approval</li>
          <li><span className="font-semibold">7️⃣ Color Selection Meeting (Offline at Experience Center)</span><br />→ Within 1 day after D2 completion</li>
          <li><span className="font-semibold">8️⃣ DQC 2 Submission</span><br />→ Within 2 days from color selection</li>
          <li><span className="font-semibold">9️⃣ DQC 2 Approval</span><br />→ Within 2 days from submission</li>
          <li><span className="font-semibold">🔟 Design Sign-Off Meeting</span><br />→ Same day or 1 day after DQC 2 approval</li>
          <li><span className="font-semibold">1️⃣1️⃣ 40% Payment</span><br />→ Same day or 1 day after sign-off</li>
          <li><span className="font-semibold">1️⃣2️⃣ Customer Approval for Production</span><br />→ Same day or next day of payment</li>
          <li><span className="font-semibold">1️⃣3️⃣ Push to Production (P2P)</span><br />→ Same day of production approval</li>
        </ol>
        <p className="mb-3">
          We will keep you updated at every milestone to ensure clarity and transparency throughout the process.
        </p>
        <p className="mb-3">
          Looking forward to progressing step by step together.
        </p>
        <p>
          Warm regards,<br />
          [Designer Name]<br />
          HUB Interiors
        </p>
      </div>
    </div>
  );
}

