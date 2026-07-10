import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermissions } from '@/lib/notifications';
import { WhenPickerValue } from './WhenPickerModal';

export function formatDaysList(days: string[]): string {
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekends = ['Sat', 'Sun'];

  if (days.length === 7) return 'every day';
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return 'weekdays';
  if (days.length === 2 && weekends.every(d => days.includes(d))) return 'weekends';

  const ordered = allDays.filter(d => days.includes(d));
  if (ordered.length <= 3) return ordered.join(', ');
  return ordered.slice(0, -1).join(', ') + ' & ' + ordered[ordered.length - 1];
}

export function formatScheduleText(schedule: WhenPickerValue): string {
  const time = `${schedule.hour}:${String(schedule.minute).padStart(2, '0')} ${schedule.period}`;
  const days = formatDaysList(schedule.days);
  return `${time}, ${days}`;
}

export async function scheduleTaskReminder(schedule: WhenPickerValue, taskLabel: string) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  let hour24 = schedule.hour;
  if (schedule.period === 'PM' && schedule.hour !== 12) hour24 += 12;
  if (schedule.period === 'AM' && schedule.hour === 12) hour24 = 0;

  const hour = schedule.allDay ? 9 : hour24;
  const minute = schedule.allDay ? 0 : schedule.minute;

  const dayMap: Record<string, number> = {
    Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
  };

  for (const day of schedule.days) {
    const weekday = dayMap[day];
    if (!weekday) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to do the work',
        body: taskLabel,
        sound: true,
      },
      trigger: {
        weekday,
        hour,
        minute,
        repeats: true,
      } as any,
    });
  }
}
