"use client";

import { useState } from "react";
import Intro from "./Intro";
import AboutHub from "./AboutHub";
import DesignPort from "./DesignPort";
import ScopeOfWork from "./ScopeOfWork";
import FinalQuoteSum from "./FinalQuoteSum";
import { MeetingWizTimerProvider } from "./MeetingWizTimer";
import type { LeadshipTypes } from "@/app/Components/Types/Types";

const WIZARD_STEPS = 5;

type Props = {
  onClose?: () => void;
  lead?: LeadshipTypes | null;
  onLeadUpdated?: (lead: LeadshipTypes) => void;
};

function StepPlaceholder({
  stepNumber,
  title,
  onNext,
  onPrev,
  onClose,
}: {
  stepNumber: number;
  title: string;
  onNext: () => void;
  onPrev: () => void;
  onClose?: () => void;
}) {
  const progress = Math.round((stepNumber / 5) * 100);

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f9fc] font-sans">
      <WizardTopBar onPrev={onPrev} onNext={onNext} onClose={onClose} prevDisabled={stepNumber <= 1} />
      <div className="mx-auto w-full max-w-[900px] flex-1 px-8 py-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Current Step</p>
        <h1 className="text-3xl font-extrabold text-gray-900">
          {stepNumber}. {title}
        </h1>
        <div className="mb-8 mt-2 h-0.5 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full bg-[#2EE86B]" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-sm text-gray-500">This step will be added in a later release.</p>
      </div>
    </main>
  );
}

function WizardTopBar({
  onPrev,
  onNext,
  onClose,
  prevDisabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  onClose?: () => void;
  prevDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={prevDisabled}
        className="text-sm font-medium text-gray-500 disabled:text-gray-300"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={onNext}
        className="rounded-md bg-[#2EE86B] px-5 py-2 text-sm font-bold text-black"
      >
        Next Phase
      </button>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="px-2 text-xl text-gray-400 hover:text-gray-700"
          aria-label="Close meeting wizard"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function MeetingWizSteps({ onClose, lead, onLeadUpdated }: Props) {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const wrapClose = onClose
    ? () => {
        onClose();
      }
    : undefined;

  switch (step) {
    case 1:
      return <Intro onNext={next} onPrev={prev} lead={lead} />;
    case 2:
      return <AboutHub onNext={next} onPrev={prev} />;
    case 3:
      return <DesignPort onNext={next} onPrev={prev} />;
    case 4:
      return (
        <ScopeOfWork
          onNext={next}
          onPrev={prev}
          lead={lead}
          onLeadUpdated={onLeadUpdated}
        />
      );
    case 5:
      return (
        <FinalQuoteSum
          onNext={next}
          onPrev={prev}
          lead={lead}
          onLeadUpdated={onLeadUpdated}
          onMeetingCompleted={() => {
            window.setTimeout(() => onClose?.(), 900);
          }}
        />
      );
    default:
      return (
        <StepPlaceholder
          stepNumber={step}
          title={`Step ${step}`}
          onNext={next}
          onPrev={prev}
          onClose={wrapClose}
        />
      );
  }
}

export default function MeetingWizFlow(props: Props) {
  return (
    <MeetingWizTimerProvider>
      <MeetingWizSteps {...props} />
    </MeetingWizTimerProvider>
  );
}
