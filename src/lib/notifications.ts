import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { get } from 'svelte/store';
import { tournamentStartsAfter } from '../engine/tournamentSchedule';
import { setTournamentRemindersSetting, settings } from '../util/settings';

// Tournament-start reminders, with no push backend: the schedule is fixed
// (engine/tournamentSchedule.ts), so the device schedules the next few starts
// as LOCAL notifications and the OS fires them whether or not the app runs.
// Native only — a browser cannot schedule a notification for a time when its
// tab is closed, so this is a no-op on the web build.

const CHANNEL_ID = 'tournament-starts';
// Reserved id block; rescheduling always cancels this whole range first.
const ID_BASE = 41_000;
const HORIZON = 8; // one start a week, so ~8 weeks of cover between app opens

export const notificationsSupported = (): boolean => Capacitor.isNativePlatform();

const ids = () => Array.from({ length: HORIZON }, (_, i) => ({ id: ID_BASE + i }));

async function ensureChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Tournament starts',
    description: 'A reminder when a new tournament opens.',
    importance: 3,
  });
}

// True once the player has said yes at the OS level.
export async function notificationsGranted(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (await notificationsGranted()) return true;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

export async function cancelTournamentReminders(): Promise<void> {
  if (!notificationsSupported()) return;
  try {
    await LocalNotifications.cancel({ notifications: ids() });
  } catch {
    // Nothing scheduled, or the OS refused — nothing to clean up.
  }
}

// Rebuild the whole reminder window. Safe to call on every launch and resume:
// it cancels the reserved id block first, so reminders never pile up or go
// stale, and the rolling horizon is topped up each time the player opens the
// game.
export async function scheduleTournamentReminders(): Promise<void> {
  if (!notificationsSupported()) return;
  if (!(await notificationsGranted())) return;
  await ensureChannel();
  await cancelTournamentReminders();
  const starts = tournamentStartsAfter(Date.now(), HORIZON);
  await LocalNotifications.schedule({
    notifications: starts.map((at, i) => ({
      id: ID_BASE + i,
      title: '🏆 Tournament open',
      body: "This week's tournament just started. Join now — every place in your group wins workers.",
      channelId: CHANNEL_ID,
      // Inexact alarm: a game reminder does not justify prompting for (or
      // shipping) Android's exact-alarm permission. allowWhileIdle still gets
      // it through Doze, within the OS's ~9-minute window.
      isExactNotification: false,
      schedule: { at: new Date(at), allowWhileIdle: true },
    })),
  });
}

// Called once at startup (no-op on web). Reminders only cover a few weeks and
// the OS permission can be revoked from system settings at any time, so the
// window is rebuilt on every launch and resume, and the stored preference is
// dropped the moment the permission is gone.
export function initTournamentReminders(): void {
  if (!notificationsSupported()) return;

  const refresh = async () => {
    if (!get(settings).tournamentReminders) return;
    if (!(await notificationsGranted())) {
      setTournamentRemindersSetting(false);
      return;
    }
    await scheduleTournamentReminders();
  };

  void refresh();
  void CapacitorApp.addListener('resume', () => void refresh());
}

// Settings toggle. Returns whether reminders are on afterwards — turning them
// on fails when the player declines the OS permission prompt.
export async function setTournamentReminders(enabled: boolean): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (!enabled) {
    await cancelTournamentReminders();
    return false;
  }
  if (!(await requestNotificationPermission())) return false;
  await scheduleTournamentReminders();
  return true;
}
