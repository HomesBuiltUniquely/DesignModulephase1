"use client";

import { useState } from "react";
import Intro from "./Intro";
import AboutHub from "./AboutHub";
import DesignPort from "./DesignPort";
import ScopeOfWork from "./ScopeOfWork";
import FinalQuoteSum from "./FinalQuoteSum";
import { MeetingWizTimerProvider } from "./MeetingWizTimer";
import type { LeadshipTypes } from "@/app/Components/Types/Types";
import {
  MeetingWizSessionContext,
  MeetingWizShell,
  MeetingWizTopBar,
  mwH1,
  mwMuted,
} from "./MeetingWizChrome";

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
}: {
  stepNumber: number;
  title: string;
  onNext: () => void;
  onPrev: () => void;
}) {
  const progress = Math.round((stepNumber / 5) * 100);

  return (
    <MeetingWizShell>
      <MeetingWizTopBar onPrev={onPrev} onNext={onNext} prevDisabled={stepNumber <= 1} />
      <div className="mx-auto w-full max-w-[900px] flex-1 px-8 py-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--foreground)]/50">Current Step</p>
        <h1 className={mwH1}>
          {stepNumber}. {title}
        </h1>
        <div className="mb-8 mt-2 h-0.5 overflow-hidden rounded-full bg-[var(--border-color)]">
          <div className="h-full bg-[var(--brand-primary)]" style={{ width: `${progress}%` }} />
        </div>
        <p className={mwMuted}>This step will be added in a later release.</p>
      </div>
    </MeetingWizShell>
  );
}

function MeetingWizSteps({ onClose, lead, onLeadUpdated }: Props) {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

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
          onPrev={prev}
          onNext={next}
        />
      );
  }
}

export default function MeetingWizFlow(props: Props) {
  return (
    <MeetingWizSessionContext.Provider value={{ onClose: props.onClose }}>
      <MeetingWizTimerProvider>
        <MeetingWizSteps {...props} />
      </MeetingWizTimerProvider>
    </MeetingWizSessionContext.Provider>
  );
}
