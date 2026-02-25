"use client";

import { useEffect, useState } from "react";
import type { ChecklistDefinition } from "../Checklists/types";

type Props = {
  milestoneIndex: number;
  taskName: string;
  definition: ChecklistDefinition;
  onClose: () => void;
  onSuccess: () => void;
};

export default function GenericMeetingChecklistPopup({
  milestoneIndex,
  taskName,
  definition,
  onClose,
  onSuccess,
}: Props) {
  const [currentSection, setCurrentSection] = useState(0);
  const [checked, setChecked] = useState<Record<number, Set<string>>>({});

  const sections = definition.sections;

  const toggleItem = (sectionIdx: number, req: string) => {
    setChecked((prev) => {
      const copy = { ...prev };
      const setFor = new Set(copy[sectionIdx] ?? []);
      if (setFor.has(req)) {
        setFor.delete(req);
      } else {
        setFor.add(req);
      }
      copy[sectionIdx] = setFor;
      return copy;
    });
  };

  useEffect(() => {
    const section = sections[currentSection];
    if (!section) return;

    const reqs = section.requirements || [];
    if (reqs.length > 0) {
      const doneCount = checked[currentSection]?.size ?? 0;
      if (doneCount === reqs.length && currentSection < sections.length - 1) {
        setCurrentSection((i) => i + 1);
      }
    } else if (currentSection < sections.length - 1) {
      setCurrentSection((i) => i + 1);
    }
  }, [checked, currentSection, sections]);

  const allDone =
    currentSection >= sections.length - 1 &&
    sections[sections.length - 1].requirements.every((r) =>
      checked[sections.length - 1]?.has(r),
    );

  const handleSubmit = async () => {
    const answers = sections.map((section, idx) => ({
      title: section.title,
      completed: (checked[idx]?.size ?? 0) === section.requirements.length,
      checkedItems: Array.from(checked[idx] ?? []),
      ...(definition.includeSectionNoteInAnswers
        ? { note: section.note ?? "" }
        : {}),
    }));

    const payload = { milestoneIndex, taskName, answers };

    try {
      const res = await fetch(definition.postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("checklist response", data);

      alert(definition.successMessage);

      if (definition.lastUrl) {
        try {
          const res2 = await fetch(definition.lastUrl);
          if (res2.ok) {
            const lastData = await res2.json();
            console.log("last checklist from server", lastData);
          }
        } catch (err) {
          console.warn(
            "Unable to fetch last checklist unable to find check list",
            err,
          );
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Network error: Backend server is not reachable.");
    }
  };

  return (
    <div className="px-6 pb-6 max-w-[640px] mt-6 bg-purple-50 text-green-950">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-green-950">
            {definition.title}
          </h2>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => {
          if (idx > currentSection) return null;
          const reqs = section.requirements || [];
          return (
            <div key={idx}>
              {definition.showBreakdownDividerAtIndex === idx &&
                definition.breakdownDividerTitle && (
                  <div className="mb-6 pb-4 border-b-2 border-green-950">
                    <h3 className="text-lg font-bold text-green-950">
                      {definition.breakdownDividerTitle}
                    </h3>
                  </div>
                )}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-green-950">
                  {section.title}
                </h3>
                {reqs.length === 0 ? (
                  <p className="text-sm italic">(no checks required)</p>
                ) : (
                  <ul className="space-y-1">
                    {reqs.map((req) => (
                      <li key={req} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={checked[idx]?.has(req) || false}
                          onChange={() => toggleItem(idx, req)}
                          className="mr-2"
                        />
                        <span className="text-sm text-green-950">{req}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.note && (
                  <p className="mt-2 text-xs text-green-900 italic">
                    {section.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg bg-purple-50 text-green-950 hover:bg-slate-900 hover:border hover:border-purple-50 hover:text-purple-50 transition font-bold"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
