/**
 * In-app notification chime (soft iOS Chord style).
 * Replace `public/sounds/notification-chord.wav` with a file from
 * https://www.zedge.net/ringtones/b004c978-d95e-3cce-ad96-16076759dea0 if desired.
 */
export const NOTIFICATION_SOUND_PATH = '/sounds/notification-chord.wav';
export const DESIGN_NOTIFICATION_CHIME_EVENT = 'design-notification-chime';

function soundUrl(): string {
  if (typeof window === 'undefined') return NOTIFICATION_SOUND_PATH;
  return `${window.location.origin}${NOTIFICATION_SOUND_PATH}`;
}

/** Single shared element — must reuse the primed element for autoplay to work. */
let audio: HTMLAudioElement | null = null;
let primed = false;
let lastChimeAt = 0;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(soundUrl());
    audio.preload = 'auto';
  }
  return audio;
}

/** Unlock browser autoplay after first user gesture. */
export function primeNotificationSound(): void {
  if (primed || typeof window === 'undefined') return;
  try {
    const el = getAudio();
    el.volume = 0.01;
    const p = el.play();
    if (p) {
      p
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.volume = 0.85;
          primed = true;
        })
        .catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function isNotificationMuted(): boolean {
  try {
    return localStorage.getItem('design-module-notifications-muted') === 'true';
  } catch {
    return false;
  }
}

/** Preview when unmuting — always plays (user gesture). */
export function playNotificationSoundPreview(): void {
  if (typeof window === 'undefined' || isNotificationMuted()) return;
  lastChimeAt = 0;
  playNotificationChime();
}

/** Live notification chime (reuses primed audio element). */
export function playNotificationChime(): void {
  if (typeof window === 'undefined' || isNotificationMuted()) return;

  const now = Date.now();
  if (now - lastChimeAt < 600) return;
  lastChimeAt = now;

  try {
    const el = getAudio();
    el.volume = 0.85;
    el.currentTime = 0;
    const p = el.play();
    if (p) {
      p.catch((err) => {
        console.warn('[notification] chime blocked — click bell once:', err);
      });
    }
  } catch (err) {
    console.warn('[notification] chime error:', err);
  }
}

/** Notify inbox UI to refresh and chime (e.g. after an action that creates notifications). */
export function signalDesignNotificationChime(delayMs = 600): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(DESIGN_NOTIFICATION_CHIME_EVENT));
  }, delayMs);
}
