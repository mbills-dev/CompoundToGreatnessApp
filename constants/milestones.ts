export const MILESTONE_DAYS = [7, 21, 40, 60, 77];

export const MILESTONE_DATA: Record<number, {
  tag: string;
  h1: string;
  h2: string;
  body: string;
  coachHeadline: string;
  nextMilestone: number | null;
}> = {
  7: {
    tag: 'MILESTONE UNLOCKED',
    h1: 'WEEK 1',
    h2: 'COMPLETE.',
    body: 'Day 7 is where most fall off. You didn\'t. That means something.',
    coachHeadline: 'WEEK 1 COMPLETE.',
    nextMilestone: 21,
  },
  21: {
    tag: 'MILESTONE UNLOCKED',
    h1: 'IDENTITY',
    h2: 'IS FORMING.',
    body: 'This is becoming who you are.',
    coachHeadline: 'IDENTITY IS FORMING.',
    nextMilestone: 40,
  },
  40: {
    tag: 'MILESTONE UNLOCKED',
    h1: 'POINT OF',
    h2: 'NO RETURN.',
    body: 'Past halfway. Quitting now costs more than finishing.',
    coachHeadline: 'POINT OF NO RETURN.',
    nextMilestone: 60,
  },
  60: {
    tag: 'MILESTONE UNLOCKED',
    h1: 'THE HOME',
    h2: 'STRETCH.',
    body: '17 days left. The finish line is visible.',
    coachHeadline: 'THE HOME STRETCH.',
    nextMilestone: 77,
  },
  77: {
    tag: 'CHALLENGE COMPLETE',
    h1: 'YOU DID',
    h2: 'IT.',
    body: '77 days. One identity. This is who you are now.',
    coachHeadline: 'YOU DID IT.',
    nextMilestone: null,
  },
};

export function isMilestoneDay(day: number): boolean {
  return MILESTONE_DAYS.includes(day);
}

export function getNextMilestone(currentDay: number): number | null {
  return MILESTONE_DAYS.find(m => m > currentDay) ?? null;
}

export function getMilestoneProgress(currentDay: number): number {
  const next = getNextMilestone(currentDay);
  const prev = [...MILESTONE_DAYS].reverse().find(m => m <= currentDay) ?? 0;
  if (!next) return 100;
  return Math.round(((currentDay - prev) / (next - prev)) * 100);
}
