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
