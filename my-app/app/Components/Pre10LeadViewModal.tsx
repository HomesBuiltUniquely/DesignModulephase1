'use client';

import { useEffect, type ReactNode } from 'react';
import type { ConfigScopeRoom, ConfigScopeSummary, LeadshipTypes } from './Types/Types';
import { formatHubPid } from '@/app/lib/formatHubPid';
import { StartMeetingButton } from '@/app/Components/MeetingWiz/StartMeetingButton';
import styles from './pre10LeadViewModal.module.css';

type Props = {
    lead: LeadshipTypes;
    timeSlotLabel: string;
    onClose: () => void;
    showStartMeeting?: boolean;
    onStartMeeting?: () => void;
};

function displayValue(value: string | number | null | undefined): string {
    if (value == null) return '—';
    const v = String(value).trim();
    return v || '—';
}

function Field({
    label,
    value,
    wide,
}: {
    label: string;
    value: string;
    wide?: boolean;
}) {
    const empty = value === '—';
    return (
        <div className={wide ? styles.fieldWide : styles.field}>
            <p className={styles.fieldLabel}>{label}</p>
            <p className={empty ? styles.fieldValueMuted : styles.fieldValue}>{value}</p>
        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
                <span className={styles.sectionAccent} aria-hidden="true" />
                {title}
            </h3>
            <div className={styles.grid}>{children}</div>
        </section>
    );
}

function scopeText(scope: ConfigScopeSummary | null | undefined, key: keyof ConfigScopeSummary): string {
    if (!scope) return '—';
    const v = scope[key];
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (v && typeof v === 'object') return '—';
    return displayValue(v as string | null | undefined);
}

function roomUnitsLabel(room: ConfigScopeRoom): string {
    if (room.unitsRequired?.length) return room.unitsRequired.join(', ');
    const selected = (room.units ?? [])
        .filter((u) => u.selected !== false && u.label?.trim())
        .map((u) => u.label!.trim());
    if (selected.length) return selected.join(', ');
    const all = (room.units ?? []).map((u) => u.label?.trim()).filter(Boolean);
    return all.length ? all.join(', ') : '—';
}

function RoomsBlock({ rooms, fallbackNames }: { rooms: ConfigScopeRoom[]; fallbackNames?: string[] }) {
    if (!rooms.length && fallbackNames?.length) {
        return <Field label="Rooms" value={fallbackNames.join(', ')} wide />;
    }
    if (!rooms.length) {
        return <Field label="Rooms" value="—" wide />;
    }
    return (
        <div className={styles.fieldWide}>
            <p className={styles.fieldLabel}>Rooms</p>
            <div className="mt-2 space-y-2.5">
                {rooms.map((room, idx) => (
                    <div key={room.roomName || `room-${idx}`} className={styles.roomCard}>
                        <p className={styles.roomName}>{room.roomName || 'Room'}</p>
                        <div className={styles.roomMeta}>
                            <div>
                                <p className={styles.fieldLabel}>Units required</p>
                                <p className={styles.fieldValue}>{roomUnitsLabel(room)}</p>
                            </div>
                            <div>
                                <p className={styles.fieldLabel}>False ceiling required</p>
                                <p className={styles.fieldValue}>
                                    {room.falseCeilingRequired ? 'Yes' : 'No'}
                                </p>
                            </div>
                            {room.notes?.trim() ? (
                                <div className={styles.fieldWide} style={{ padding: 0, background: 'transparent' }}>
                                    <p className={styles.fieldLabel}>Room notes</p>
                                    <p className={styles.fieldValue}>{room.notes.trim()}</p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ExternalIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
            <path d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
        </svg>
    );
}

export function Pre10LeadViewModal({
    lead,
    timeSlotLabel,
    onClose,
    showStartMeeting,
    onStartMeeting,
}: Props) {
    const projectLabel = formatHubPid(lead.pid, lead.id);
    const customerName =
        lead.intakeCustomerName?.trim() ||
        lead.projectName?.trim() ||
        null;
    const floorPlans = (() => {
        const fromList = Array.isArray(lead.floorPlans)
            ? lead.floorPlans
                  .map((item, i) => ({
                      index: typeof item?.index === 'number' ? item.index : i,
                      filename: String(item?.filename || '').trim() || `Floor plan ${i + 1}`,
                      publicUrl: String(item?.publicUrl || '').trim(),
                  }))
                  .filter((item) => item.publicUrl)
                  .sort((a, b) => a.index - b.index)
            : [];
        if (fromList.length) return fromList;
        const legacy = lead.floorPlanPublicLink?.trim() || '';
        return legacy ? [{ index: 0, filename: 'Floor plan', publicUrl: legacy }] : [];
    })();
    const scope = lead.configScopeSummary ?? null;
    const experience = lead.experienceSummary ?? null;
    const decision = lead.decisionSummary ?? null;
    const rooms = scope?.selectedRooms ?? [];
    const refs = scope?.referenceInspiration?.references ?? [];
    const financial = scope?.financialGuardrails;
    const internalNotes = scope?.internalExecutiveNotes;
    const familySizeDetails =
        scope?.familySizeDetails?.trim() ||
        scope?.projectUnderstanding?.trim() ||
        '';

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pre10-view-modal-title"
            onClick={onClose}
        >
            <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerMain}>
                        <span className={styles.headerBar} aria-hidden="true" />
                        <div className={styles.headerText}>
                            <div className={styles.headerTopRow}>
                                <h2 id="pre10-view-modal-title" className={styles.headerTitle}>
                                    {projectLabel}
                                </h2>
                                <span className={styles.headerBadge}>Pre 10%</span>
                            </div>
                            <p className={styles.headerSub}>{lead.projectName || '—'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.closeBtn}
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className={styles.body}>
                    <Section title="Customer">
                        <Field label="Customer name" value={displayValue(customerName)} />
                        <Field label="Pincode" value={displayValue(lead.intakePincode)} />
                        <Field label="Lead source" value={displayValue(lead.intakeLeadSource)} />
                        <Field label="Possession date" value={displayValue(lead.intakePossessionDate)} />
                        <Field label="Sales executive" value={displayValue(lead.salesExecutive)} />
                    </Section>

                    <Section title="Discovery">
                        <Field label="Property / location" value={displayValue(lead.intakePropertyLocation)} />
                        <Field label="Budget" value={displayValue(lead.intakeBudget)} />
                        <Field label="Language" value={displayValue(lead.intakeLanguage)} />
                        <Field label="Configuration" value={displayValue(lead.intakeConfiguration)} />
                        <Field label="Booking type" value={displayValue(lead.intakeBookingType)} />
                        <Field label="Property notes" value={displayValue(lead.intakeNotes)} wide />
                    </Section>

                    <Section title="Connection / Meeting">
                        <Field label="Meeting type" value={displayValue(lead.intakeMeetingType)} />
                        <Field label="Time slot" value={displayValue(timeSlotLabel)} />
                        <Field label="Designer" value={displayValue(lead.designerName)} />
                        <div className={styles.fieldWide}>
                            <p className={styles.fieldLabel}>
                                Floor plan{floorPlans.length > 1 ? 's' : ''}
                            </p>
                            {floorPlans.length ? (
                                <ul className={styles.floorPlanList}>
                                    {floorPlans.map((plan, i) => {
                                        const label =
                                            floorPlans.length > 1
                                                ? `View ${plan.filename || `Floor plan ${i + 1}`}`
                                                : plan.filename || 'Floor plan';
                                        return (
                                            <li key={`${plan.index}-${plan.publicUrl}`} className="min-w-0">
                                                <a
                                                    href={plan.publicUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.floorPlanLink}
                                                    title={plan.filename || `Floor plan ${i + 1}`}
                                                >
                                                    <span>{label}</span>
                                                    <ExternalIcon className={styles.floorPlanIcon} />
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className={styles.fieldValueMuted}>—</p>
                            )}
                        </div>
                    </Section>

                    {scope ? (
                        <>
                            <Section title="Config scope — basic">
                                <Field label="Expected timeline" value={scopeText(scope, 'expectedTimeline')} />
                                <Field label="Kitchen layout" value={scopeText(scope, 'kitchenLayout')} />
                                <Field label="Material / finish" value={scopeText(scope, 'materialFinish')} />
                                <Field label="WFH setup" value={scope.wfhSetup ? 'Yes' : 'No'} />
                                <Field label="Pet friendly" value={scope.petFriendly ? 'Yes' : 'No'} />
                                <Field label="Family Size & Details" value={displayValue(familySizeDetails)} wide />
                                <Field label="Family contact" value={scopeText(scope, 'familyContactName')} />
                                <Field label="Family phone" value={scopeText(scope, 'familyContactPhone')} />
                                <RoomsBlock rooms={rooms} fallbackNames={scope.selectedRoomNames} />
                            </Section>

                            <Section title="Miscellaneous Add-ons">
                                <Field
                                    label="Add-ons"
                                    value={
                                        scope.miscAddOns?.length
                                            ? scope.miscAddOns.join(', ')
                                            : '—'
                                    }
                                    wide
                                />
                            </Section>

                            <Section title="Reference & Inspiration">
                                <Field
                                    label="Aesthetic notes"
                                    value={displayValue(scope.referenceInspiration?.aestheticNotes)}
                                    wide
                                />
                                <div className={styles.fieldWide}>
                                    <p className={styles.fieldLabel}>Reference files</p>
                                    {refs.length ? (
                                        <ul className={styles.refList}>
                                            {refs.map((ref) => (
                                                <li key={ref.id || ref.fileName}>
                                                    {ref.viewUrl ? (
                                                        <a
                                                            href={ref.viewUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={styles.refLink}
                                                        >
                                                            {ref.fileName || 'Open reference'}
                                                            <ExternalIcon className="h-3.5 w-3.5" />
                                                        </a>
                                                    ) : (
                                                        <span className={styles.fieldValue}>
                                                            {ref.fileName || '—'}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={styles.fieldValueMuted}>—</p>
                                    )}
                                </div>
                            </Section>

                            <Section title="Financial Guardrails">
                                <Field
                                    label="Investment range"
                                    value={displayValue(financial?.investmentRange)}
                                />
                                <Field label="Sensitivity" value={displayValue(financial?.sensitivity)} />
                                <Field label="Financing" value={displayValue(financial?.financing)} />
                            </Section>

                            <Section title="Internal Executive Notes">
                                <Field
                                    label="Personality type"
                                    value={displayValue(internalNotes?.personalityType)}
                                />
                                <Field
                                    label="Competition"
                                    value={displayValue(internalNotes?.competition)}
                                />
                                <Field
                                    label="Closure probability"
                                    value={displayValue(internalNotes?.closureProbability)}
                                />
                                <Field
                                    label="Executive summary"
                                    value={displayValue(internalNotes?.executiveSummary)}
                                    wide
                                />
                                <Field
                                    label="Internal notes"
                                    value={displayValue(internalNotes?.internalNotes)}
                                    wide
                                />
                            </Section>
                        </>
                    ) : null}

                    {experience || decision ? (
                        <Section title="Experience / Decision">
                            <Field
                                label="Quote amount"
                                value={displayValue(
                                    (experience?.quoteAmount as string | number | undefined) ??
                                        (decision?.finalBudget as string | number | undefined),
                                )}
                            />
                            <Field
                                label="Expected timeline"
                                value={displayValue(decision?.expectedTimeline as string | undefined)}
                            />
                            <Field
                                label="Decision maker"
                                value={displayValue(decision?.decisionMaker as string | undefined)}
                            />
                            <Field
                                label="Quote link"
                                value={displayValue(experience?.quoteLink as string | undefined)}
                            />
                        </Section>
                    ) : null}
                </div>

                <div className={styles.footer}>
                    {showStartMeeting && onStartMeeting ? (
                        <StartMeetingButton onClick={onStartMeeting} size="md" />
                    ) : null}
                    <button type="button" onClick={onClose} className={styles.closeAction}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
