import { NextResponse } from 'next/server';

export type DesignQAAnswerEntry = {
    question: string;
    selected: {
        id: number;
        src: string;
        alt: string;
        css: string;
        text: string;
    } | null;
    optionLabel?: string;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const answers = body.answers as DesignQAAnswerEntry[] | undefined;

        if (!Array.isArray(answers)) {
            return NextResponse.json(
                { error: 'Invalid payload: answers array required' },
                { status: 400 }
            );
        }

        // TODO: Send to your CRM here (e.g. forward to CRM API, save to DB).
        // Example: await fetch(process.env.CRM_WEBHOOK_URL, { method: 'POST', body: JSON.stringify({ designQA: answers }) });
        // For now we accept and return success. Add your CRM endpoint URL in env and forward the payload.
        const crmUrl = process.env.CRM_DESIGN_QA_URL || process.env.NEXT_PUBLIC_CRM_DESIGN_QA_URL;
        if (crmUrl) {
            const res = await fetch(crmUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ designQA: answers, submittedAt: new Date().toISOString() }),
            });
            if (!res.ok) {
                const text = await res.text();
                console.error('CRM request failed', res.status, text);
                return NextResponse.json(
                    { error: 'Failed to submit to CRM' },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Design QA API error', e);
        return NextResponse.json(
            { error: 'Server error' },
            { status: 500 }
        );
    }
}
