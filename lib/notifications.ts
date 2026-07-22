import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getTodayDateString } from '@/lib/dateHelpers';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleDailyReminders(
  morningEnabled: boolean = true,
  eveningEnabled: boolean = true
) {
  if (Platform.OS === 'web') {
    return;
  }

  if (morningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'LEAVE YOURSELF IN THE DUST',
        body: "Today's inputs are waiting. Go stack the win.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
  }

  if (eveningEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "DON'T LET TODAY SLIP",
        body: 'Close out your inputs before the streak resets.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  }
}

export async function cancelAllNotifications() {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendImmediateNotification(title: string, body: string) {
  if (Platform.OS === 'web') {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}

const BRAND_LINES = [
  'NEVER STOP WINNING 🚀',
  'ZERO EXCUSES. ZERO MISSES.',
  'YOUR IDENTITY VOTES NOW.',
  'SHOW UP. STACK THE WIN.',
  'THE COMPOUND IS CALLING.',
  'PROVE IT. TODAY.',
  'BE THE PERSON YOU SIGNED FOR.',
];

const DAY_TO_WEEKDAY: Record<string, number> = {
  Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
};

const ORDERED_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function to24Hour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'PM' && hour !== 12) return hour + 12;
  if (period === 'AM' && hour === 12) return 0;
  return hour;
}

function formatTime12h(hour24: number, minute: number): string {
  let period: 'AM' | 'PM' = 'AM';
  let h = hour24;
  if (h === 0) {
    h = 12;
  } else if (h >= 12) {
    period = 'PM';
    if (h > 12) h -= 12;
  }
  return `${h}:${String(minute).padStart(2, '0')} ${period}`;
}

function stableHashIndex(id: string, mod: number): number {
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum = (sum * 31 + id.charCodeAt(i)) % 1000003;
  }
  return sum % mod;
}

let resyncInFlight: Promise<void> | null = null;
let resyncQueuedUserId: string | null = null;

export function resyncAllReminders(userId: string): Promise<void> {
  if (resyncInFlight) {
    resyncQueuedUserId = userId;
    return resyncInFlight;
  }
  resyncInFlight = doResync(userId).finally(() => {
    resyncInFlight = null;
    if (resyncQueuedUserId) {
      const next = resyncQueuedUserId;
      resyncQueuedUserId = null;
      resyncAllReminders(next);
    }
  });
  return resyncInFlight;
}

async function doResync(userId: string) {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  // General morning/evening reminders from saved settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('morning_notifications, evening_notifications')
    .eq('user_id', userId)
    .maybeSingle();

  const morningEnabled = settings?.morning_notifications ?? true;
  const eveningEnabled = settings?.evening_notifications ?? true;

  await scheduleDailyReminders(morningEnabled, eveningEnabled);

  // Per-input reminders from the active goal's daily activities
  const { data: goal } = await supabase
    .from('goals')
    .select('id, scheduled_start_date')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!goal) return;

  // During pre-start (scheduled_start_date in the future), suppress per-input
  // reminders — general morning/evening reminders still fire. Compare as plain
  // YYYY-MM-DD strings so no Date/timezone parsing is involved.
  if (goal.scheduled_start_date && goal.scheduled_start_date > getTodayDateString()) {
    return;
  }

  const { data: activities } = await supabase
    .from('daily_activities')
    .select('id, activity_name, what, where_location, schedule')
    .eq('goal_id', goal.id);

  if (!activities || activities.length === 0) return;

  for (const activity of activities) {
    const schedule = activity.schedule as any;
    if (!schedule || schedule.reminder !== true) continue;

    const isAllDay = !!schedule.allDay;
    const hour24 = isAllDay ? 9 : to24Hour(schedule.hour ?? 7, schedule.period ?? 'AM');
    const minute = isAllDay ? 0 : (schedule.minute ?? 0);
    const offset = typeof schedule.reminderOffset === 'number' ? schedule.reminderOffset : 0;

    const originalTimeLabel = isAllDay ? '9:00 AM' : formatTime12h(hour24, minute);

    let fireTotal = hour24 * 60 + minute - offset;
    let dayShiftedBack = false;
    if (fireTotal < 0) {
      fireTotal += 1440;
      dayShiftedBack = true;
    }
    const fireHour = Math.floor(fireTotal / 60);
    const fireMinute = fireTotal % 60;

    const days: string[] = Array.isArray(schedule.days) && schedule.days.length > 0
      ? schedule.days
      : ORDERED_DAYS;

    const whereSuffix = activity.where_location ? ` • ${activity.where_location}` : '';
    const body = `${activity.activity_name} — ${originalTimeLabel}${whereSuffix}`;

    if (days.length === 7) {
      const titleIdx = stableHashIndex(activity.id, BRAND_LINES.length);
      await Notifications.scheduleNotificationAsync({
        content: { title: BRAND_LINES[titleIdx], body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: fireHour, minute: fireMinute },
      });
    } else {
      for (const day of days) {
        let weekday = DAY_TO_WEEKDAY[day];
        if (!weekday) continue;
        if (dayShiftedBack) {
          weekday = weekday === 1 ? 7 : weekday - 1;
        }
        const titleIdx = weekday - 1;
        await Notifications.scheduleNotificationAsync({
          content: { title: BRAND_LINES[titleIdx], body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: fireHour, minute: fireMinute },
        });
      }
    }
  }
}
