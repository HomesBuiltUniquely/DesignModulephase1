"use client";

import { useState } from "react";
import type { RefObject } from "react";

type Props = {
  designUploadFiles: File[];
  designFileInputRef: RefObject<HTMLInputElement | null>;
  openDesignFileUpload: (accept: string) => void;
  onDesignFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDesignDrop: (e: React.DragEvent) => void;
  onDesignDragOver: (e: React.DragEvent) => void;
  removeDesignFile: (index: number) => void;
  /**
   * Send meeting invite + upload; does not complete task or close.
   * Can be called multiple times.
   */
  onSubmit?: (meta?: {
    meetingDate?: string;
    meetingTime?: string;
    meetingMode?: "online" | "offline";
    meetingLink?: string;
  }) => void;
  /** Called when designer marks 100% complete; parent should record task complete and close. */
  onCompleteAndProceed?: (meta?: {
    meetingDate?: string;
    meetingTime?: string;
    meetingMode?: "online" | "offline";
    meetingLink?: string;
  }) => void;
};

/**
 * First cut design + quotation discussion meeting request – date, time, meeting mode, design upload.
 */
export default function PopupFirstCutDesign({
  designUploadFiles,
  designFileInputRef,
  openDesignFileUpload,
  onDesignFilesSelected,
  onDesignDrop,
  onDesignDragOver,
  removeDesignFile,
  onSubmit,
  onCompleteAndProceed,
}: Props) {
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingMode, setMeetingMode] = useState<"online" | "offline">("online");
  const [meetingLink, setMeetingLink] = useState("");
  const [completionPercent, setCompletionPercent] = useState(0);
  const isMeetingLinkEmpty = meetingLink.trim().length === 0;
  const isMeetingScheduleIncomplete = !meetingDate || !meetingTime || isMeetingLinkEmpty;

  return (
    <div className="w-full">
      <div>
        <div className="w-full border border-gray-200 mt-2" />
        <div className="flex items-center gap-2 py-4 px-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-5 text-blue-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
          <div className="text-[14px] font-bold text-black">
            MEETING SCHEDULE
          </div>
        </div>
        <div className="px-6 pt-2">
          <div className="font-bold text-sm text-black mb-1">
            Meeting link <span className="text-red-500">*</span>
          </div>
          <input
            type="url"
            placeholder="Paste Google Meet / Teams / Zoom link"
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            This link is mandatory and will be included in the meeting email.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-2">
          <div>
            <div className="font-bold text-sm text-black">Date</div>
            <input
              type="date"
              className="w-[250px] border border-gray-300 rounded-md p-2 mt-2"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div>
            <div className="font-bold text-sm text-black">Time</div>
            <input
              type="time"
              className="w-[250px] border border-gray-300 rounded-md p-2 mt-2"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 py-4 px-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-5 text-blue-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
          <div className="text-[14px] font-bold text-black">MEETING MODE</div>
        </div>
        <div className="flex justify-start gap-4 bg-gray-200 w-47 h-12 rounded-md ml-5">
          <button
            type="button"
            onClick={() => setMeetingMode("online")}
            className={`w-24 h-[4.5vh] text-center font-bold mt-1.5 pt-1.5 ml-1.5 rounded-md ${
              meetingMode === "online"
                ? "bg-white text-blue-500"
                : "bg-transparent text-gray-500"
            }`}
          >
            Online
          </button>
          <button
            type="button"
            onClick={() => setMeetingMode("offline")}
            className={`w-24 h-[4.5vh] text-center font-bold mt-1.5 pt-1.5 rounded-md ${
              meetingMode === "offline"
                ? "bg-white text-blue-500"
                : "bg-transparent text-gray-500"
            }`}
          >
            Offline
          </button>
        </div>
        <div className="flex items-center gap-2 py-4 px-6 mt-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-6 text-blue-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
            />
          </svg>
          <div className="text-[14px] text-black font-bold">DESIGN UPLOAD</div>
        </div>
        <div className="px-6 pb-6">
          <input
            ref={designFileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={onDesignFilesSelected}
          />
          <div
            className="w-full max-w-[540px] border-2 border-dashed border-gray-300 rounded-xl bg-white p-8 flex flex-col items-center justify-center min-h-[220px] cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            onClick={() =>
              openDesignFileUpload(".pdf,.jpg,.jpeg,.png,.fig,.psd")
            }
            onDrop={onDesignDrop}
            onDragOver={onDesignDragOver}
          >
            <div className="w-14 h-14 rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-7 h-7 text-blue-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-800 mb-1">
              Click or drag design file to upload
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Upload first design version for discussion
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDesignFileUpload(".pdf");
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-red-600 font-medium text-sm"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDesignFileUpload(".jpg,.jpeg,.png");
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-blue-600 font-medium text-sm"
              >
                JPG/PNG
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDesignFileUpload(".fig,.psd");
                }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-purple-600 font-medium text-sm"
              >
                FIG/PSD
              </button>
            </div>
          </div>
          {designUploadFiles.length > 0 && (
            <div className="mt-3 space-y-2 max-w-[540px]">
              <p className="text-sm font-medium text-gray-700">
                Selected files ({designUploadFiles.length})
              </p>
              {designUploadFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-700 truncate flex-1">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDesignFile(index)}
                    className="text-red-600 hover:underline ml-2 flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-full border border-gray-200 mt-4" />
        {/* Design completion level bar: 0–100%; only "Mark 100% complete & proceed" advances the stage */}
        <div className="px-6 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-black">Design completion</span>
            <span className="text-sm font-medium text-gray-700">{completionPercent}%</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={completionPercent}
              onChange={(e) => setCompletionPercent(Number(e.target.value))}
              className="flex-1 h-2.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={completionPercent}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCompletionPercent(Math.min(100, Math.max(0, isNaN(v) ? 0 : v)));
              }}
              className="w-14 border border-gray-300 rounded-md px-2 py-1 text-sm text-center"
            />
          </div>
          <p className="text-xs text-gray-500">
            Send as many meeting invites as needed. When design is 100% complete, use &quot;Mark 100% complete & proceed&quot; to advance to the next stage.
          </p>
        </div>
        <div className="w-full border border-gray-200" />
        <div className="flex justify-end gap-2 bg-gray-100 px-6 py-3">
          <button
            type="button"
            onClick={() =>
              onSubmit?.({
                meetingDate,
                meetingTime,
                meetingMode,
                meetingLink: meetingLink.trim(),
              })
            }
            disabled={isMeetingScheduleIncomplete}
            className="bg-blue-500 text-white px-4 h-9 rounded-md flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Invite
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() =>
              onCompleteAndProceed?.({
                meetingDate,
                meetingTime,
                meetingMode,
                meetingLink: meetingLink.trim(),
              })
            }
            disabled={completionPercent < 100 || isMeetingScheduleIncomplete}
            className="bg-green-600 text-white px-4 h-9 rounded-md flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark 100% complete & proceed
          </button>
        </div>
      </div>
    </div>
  );
}
