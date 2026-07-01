// Notification tones synthesized with the Web Audio API - no audio files to
// source, license, or host. Each sound is built from short oscillator notes
// shaped with a simple attack/decay envelope so they read as a clean chime
// rather than a harsh beep. All three are one-shot (no looping ringtone) -
// the experience is a brief, non-disruptive ping, not an alarm.

import { getNotificationSettings, effectiveVolume, type NotificationCategory } from './settings';

export type SoundCategory = NotificationCategory;

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedContext ??= new Ctor();
  return sharedContext;
}

async function getRunningContext(): Promise<AudioContext | null> {
  const ctx = getContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { return null; }
  }
  return ctx.state === 'running' ? ctx : null;
}

function tone(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  startTime: number,
  duration: number,
  peakVolume: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  // Quick attack, gentle release - avoids the click/pop of a hard on/off.
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakVolume, startTime + 0.015);
  gain.gain.linearRampToValueAtTime(peakVolume * 0.7, startTime + duration * 0.6);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

const lastPlayedAt: Record<string, number> = {};

// Rapid duplicate pings (e.g. a broadcast ping arriving in two tabs at once,
// or a refetch landing twice) shouldn't double-fire the same sound.
function shouldPlay(key: string, dedupeMs = 900) {
  const now = Date.now();
  if (now - (lastPlayedAt[key] ?? 0) < dedupeMs) return false;
  lastPlayedAt[key] = now;
  return true;
}

export async function playVerifyChime(volume: number) {
  const ctx = await getRunningContext();
  if (!ctx || volume <= 0 || !shouldPlay('verify')) return;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  tone(ctx, master, 880, now, 0.16, 0.5);
  tone(ctx, master, 1175, now + 0.14, 0.22, 0.5);
}

export async function playMessagePing(volume: number) {
  const ctx = await getRunningContext();
  if (!ctx || volume <= 0 || !shouldPlay('messages')) return;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  tone(ctx, master, 660, ctx.currentTime, 0.22, 0.35);
}

export async function playCallChime(volume: number) {
  const ctx = await getRunningContext();
  if (!ctx || volume <= 0 || !shouldPlay('calls')) return;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  // Three quick ascending notes - distinct rhythm from the other two tones,
  // but still a brief one-shot ping, not a ringtone.
  const now = ctx.currentTime;
  tone(ctx, master, 523, now, 0.1, 0.45);
  tone(ctx, master, 659, now + 0.1, 0.1, 0.45);
  tone(ctx, master, 784, now + 0.2, 0.16, 0.5);
}

async function playToneForCategory(category: SoundCategory, volume: number) {
  if (category === 'verify') await playVerifyChime(volume);
  if (category === 'messages') await playMessagePing(volume);
  if (category === 'calls') await playCallChime(volume);
}

// Respects the user's mute/per-category/volume settings - the one entry
// point callers should use for a real (non-preview) notification sound.
export function playNotificationSound(category: NotificationCategory) {
  const settings = getNotificationSettings();
  const volume = effectiveVolume(settings, category);
  void playToneForCategory(category, volume);
}

// Settings panel "Test" buttons preview at the slider's volume regardless
// of the master/category mute toggles, so muting doesn't make Test silent.
export function previewNotificationSound(category: NotificationCategory, volume: number) {
  void playToneForCategory(category, volume);
}
