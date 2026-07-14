'use client';

import { useEffect, type ReactNode } from 'react';
import type { ConfigScopeRoom, ConfigScopeSummary, LeadshipTypes } from './Types/Types';
import { formatHubPid } from '@/app/lib/formatHubPid';
type Props = {
    lead: LeadshipTypes;
    timeSlotLabel: string;
    onClose: () => void;
};

function displayValue(value: string | number | null | undefined): string {
    if (value == null) return '—';
    const v = String(value).trim();
    return v || '—';
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{value}</dd>
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
        <section className="space-y-3">
            <h3 className="border-b border-gray-100 pb-1 text-xs font-semibold uppercase tracking-wider text-teal-800">
                {title}
            </h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
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
        return <Field label="Rooms" value={fallbackNames.join(', ')} />;
    }
    if (!rooms.length) {
        return <Field label="Rooms" value="—" />;
    }
    return (
        <div className="sm:col-span-2 space-y-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Rooms</dt>
            <dd className="space-y-3">
                {rooms.map((room) => (
                    <div
                        key={room.roomName || Math.random()}
                        className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
                    >
                        <p className="text-sm font-semibold text-gray-900">{room.roomName || 'Room'}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                    Units required
                                </p>
                                <p className="mt-0.5 text-sm text-gray-900">{roomUnitsLabel(room)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                    False ceiling required
                                </p>
                                <p className="mt-0.5 text-sm text-gray-900">
                                    {room.falseCeilingRequired ? 'Yes' : 'No'}
                                </p>
                            </div>
                            {room.notes?.trim() ? (
                                <div className="sm:col-span-2">
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                        Room notes
                                    </p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">
                                        {room.notes.trim()}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </dd>
        </div>
    );
}

export function Pre10LeadViewModal({ lead, timeSlotLabel, onClose }: Props) {
    const projectLabel = formatHubPid(lead.pid, lead.id);
    const customerName =
        lead.intakeCustomerName?.trim() ||
        lead.projectName?.trim() ||
        null;
    const floorPlanUrl = lead.floorPlanPublicLink?.trim() || '';
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pre10-view-modal-title"
            onClick={onClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
                    <div>
                        <h2 id="pre10-view-modal-title" className="text-lg font-semibold text-gray-900">
                            {projectLabel}
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-600">{lead.projectName || '—'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6 overflow-y-auto px-6 py-5">
                    <Section title="Customer">
                        <Field label="Customer name" value={displayValue(customerName)} />
                        <Field label="Phone" value={displayValue(lead.contactNo)} />
                        <Field label="Alt phone" value={displayValue(lead.intakeAltPhone)} />
                        <Field label="Email" value={displayValue(lead.clientEmail)} />
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
                        <div className="sm:col-span-2">
                            <Field label="Property notes" value={displayValue(lead.intakeNotes)} />
                        </div>
                    </Section>

                    <Section title="Connection / Meeting">
                        <Field label="Meeting type" value={displayValue(lead.intakeMeetingType)} />
                        <Field label="Time slot" value={displayValue(timeSlotLabel)} />
                        <Field label="Designer" value={displayValue(lead.designerName)} />
                        <div className="sm:col-span-2">
                            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Floor plan</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                                {floorPlanUrl ? (
                                    <a
                                        href={floorPlanUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 shadow-sm hover:bg-teal-50"
                                    >
                                        Open floor plan
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                            <path d="M11 3a1 1 0 1 0 0 2h2.586l-6.293 6.293a1 1 0 1 0 1.414 1.414L15 6.414V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
                                            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
                                        </svg>
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </dd>
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
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Family Size & Details"
                                        value={displayValue(familySizeDetails)}
                                    />
                                </div>
                                <Field label="Family contact" value={scopeText(scope, 'familyContactName')} />
                                <Field label="Family phone" value={scopeText(scope, 'familyContactPhone')} />
                                <RoomsBlock rooms={rooms} fallbackNames={scope.selectedRoomNames} />
                            </Section>

                            <Section title="Miscellaneous Add-ons">
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Add-ons"
                                        value={
                                            scope.miscAddOns?.length
                                                ? scope.miscAddOns.join(', ')
                                                : '—'
                                        }
                                    />
                                </div>
                            </Section>

                            <Section title="Reference & Inspiration">
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Aesthetic notes"
                                        value={displayValue(scope.referenceInspiration?.aestheticNotes)}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                        Reference files
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                        {refs.length ? (
                                            <ul className="space-y-1.5">
                                                {refs.map((ref) => (
                                                    <li key={ref.id || ref.fileName}>
                                                        {ref.viewUrl ? (
                                                            <a
                                                                href={ref.viewUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-medium text-teal-800 underline-offset-2 hover:underline"
                                                            >
                                                                {ref.fileName || 'Open reference'}
                                                            </a>
                                                        ) : (
                                                            ref.fileName || '—'
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            '—'
                                        )}
                                    </dd>
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
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Executive summary"
                                        value={displayValue(internalNotes?.executiveSummary)}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Internal notes"
                                        value={displayValue(internalNotes?.internalNotes)}
                                    />
                                </div>
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

                <div className="flex shrink-0 justify-end border-t border-gray-100 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
