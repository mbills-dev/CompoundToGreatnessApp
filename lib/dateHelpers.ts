export function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDateString(): string {
  return toLocalDateString(new Date());
}

export function isDateInPast(dateString: string): boolean {
  const today = getTodayDateString();
  return dateString < today;
}

export function isDateToday(dateString: string): boolean {
  const today = getTodayDateString();
  return dateString === today;
}

export function isDateLocked(
  dateString: string,
  challengeStartDate: string | null,
  lastCompletionDate: string | null
): boolean {
  if (isDateInPast(dateString)) {
    return true;
  }

  if (!challengeStartDate || !lastCompletionDate) {
    return false;
  }

  if (dateString < lastCompletionDate) {
    return true;
  }

  return false;
}

export function getDayNumberFromChallengeStart(
  challengeStartDate: string | null,
  targetDate: string
): number {
  if (!challengeStartDate) return 1;

  const startDate = parseLocalDate(challengeStartDate.split('T')[0]);
  const target = parseLocalDate(targetDate.split('T')[0]);

  const daysDiff = Math.floor(
    (target.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysDiff + 1;
}

export function getDateForChallengeDay(
  challengeStartDate: string | null,
  dayNumber: number
): string {
  if (!challengeStartDate) {
    return getTodayDateString();
  }

  const startDate = parseLocalDate(challengeStartDate.split('T')[0]);
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (dayNumber - 1));

  return toLocalDateString(targetDate);
}

export function isPhase2DayLocked(dateString: string): boolean {
  const today = getTodayDateString();
  return dateString > today;
}
