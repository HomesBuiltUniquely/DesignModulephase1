/**
 * Formal two-tone desk ring (A5 → E5).
 * File: /sounds/notification-ring.wav
 * Fallback: Web Audio if the file cannot play.
 * Unlock once on a user click so the browser allows later plays.
 */

const SOUND_URL = "/sounds/notification-ring.wav";

let primedAudio: HTMLAudioElement | null = null;
let unlocked = false;
let audioCtx: AudioContext | null = null;

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!primedAudio) {
    primedAudio = new Audio(SOUND_URL);
    primedAudio.preload = "auto";
  }
  return primedAudio;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

function playTone(ctx: AudioContext, freq: number, when: number, duration: number, gain: number) {
  const osc = ctx.createOscillator();
  const harm = ctx.createOscillator();
  const mix = ctx.createGain();
  const harmGain = ctx.createGain();
  osc.type = "sine";
  harm.type = "sine";
  osc.frequency.setValueAtTime(freq, when);
  harm.frequency.setValueAtTime(freq * 2, when);
  harmGain.gain.value = 0.16;
  mix.gain.setValueAtTime(0.0001, when);
  mix.gain.exponentialRampToValueAtTime(gain, when + 0.018);
  mix.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(mix);
  harm.connect(harmGain);
  harmGain.connect(mix);
  mix.connect(ctx.destination);
  osc.start(when);
  harm.start(when);
  osc.stop(when + duration);
  harm.stop(when + duration);
}

function playFallbackRing() {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime;
  playTone(ctx, 880, t, 0.55, 0.22);
  playTone(ctx, 659.25, t + 0.16, 0.7, 0.2);
}

/** Must run inside a click/keydown once so later plays are allowed. */
export function unlockNotificationSound(): void {
  const audio = ensureAudio();
  const ctx = ensureCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
  if (!audio) return;
  try {
    audio.volume = 0.001;
    audio.currentTime = 0;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        unlocked = true;
      })
      .catch(() => {
        unlocked = true;
      });
  } catch {
    unlocked = true;
  }
}

export function playNotificationSound(): void {
  const audio = ensureAudio();
  const tryFile = () => {
    if (!audio) {
      playFallbackRing();
      return;
    }
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.62;
      void audio.play().catch(() => playFallbackRing());
    } catch {
      playFallbackRing();
    }
  };

  if (!unlocked) {
    unlockNotificationSound();
    window.setTimeout(tryFile, 80);
    return;
  }
  tryFile();
}

export function isNotificationSoundUnlocked(): boolean {
  return unlocked;
}
