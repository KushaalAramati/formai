// Audio-safe feedback. CRITICAL REQUIREMENT: never interrupt the user's music.
// - Visual + haptic never touch audio.
// - Voice uses the Web Speech API (speechSynthesis), which mixes with / ducks media rather than
//   stopping it, and is OFF by default. The user fully controls the channel via settings.
export type FeedbackMode = 'silent' | 'visual' | 'haptic' | 'voice';

export interface FeedbackSettings {
  mode: FeedbackMode;
  units: 'kg' | 'lbs';
}

export const DEFAULT_FEEDBACK: FeedbackSettings = { mode: 'visual', units: 'kg' };

let lastSpoken = '';
let lastSpokenAt = 0;

/** Fire a cue through the user's chosen channel. Visual is handled by the caller (UI state). */
export function cue(settings: FeedbackSettings, message: string) {
  if (settings.mode === 'haptic') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(120);
    return;
  }
  if (settings.mode === 'voice') speak(message);
  // 'silent' and 'visual' make no sound; 'visual' is rendered by the component.
}

/** Speak without hijacking music: short, de-duped, and only if the API exists. */
export function speak(message: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const now = Date.now();
  // de-dupe identical cues within 3s so we don't nag
  if (message === lastSpoken && now - lastSpokenAt < 3000) return;
  lastSpoken = message;
  lastSpokenAt = now;
  try {
    const u = new SpeechSynthesisUtterance(message);
    u.rate = 1.05;
    u.volume = 1;
    // Do NOT cancel the queue aggressively; just add ours.
    window.speechSynthesis.speak(u);
  } catch {
    /* no-op */
  }
}

export function haptic(pattern: number | number[] = 80) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}
