import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MILESTONE_DATA, getNextMilestone, getMilestoneProgress, isMilestoneDay } from '@/constants/milestones';
import { useTheme } from '@/contexts/ThemeContext';

type QuoteEntry = {
  type: 'quote';
  l1: string;
  l2: string;
  l3: string;
  attr: string;
  next: string;
  pct: number;
};

type MilestoneEntry = {
  type: 'milestone';
  tag: string;
  h1: string;
  h2: string;
  body: string;
  next: string;
};

type DayEntry = QuoteEntry | MilestoneEntry;

const DAYS: DayEntry[] = [
  { type: 'quote', l1: 'YESTERDAY', l2: 'YOU SAID', l3: 'TOMORROW.', attr: 'today is the day', next: 'Day 7', pct: 1 },
  { type: 'quote', l1: 'YOUR LIFE', l2: 'MATTERS.', l3: 'MAKE IT COUNT.', attr: 'this is why you\'re here', next: 'Day 7', pct: 14 },
  { type: 'quote', l1: 'SAY GOODBYE', l2: 'TO', l3: 'AVERAGE.', attr: 'you decided. now prove it.', next: 'Day 7', pct: 29 },
  { type: 'quote', l1: 'ARE WE', l2: 'CRUSHING', l3: 'TODAY?', attr: 'day 4. the answer is yes.', next: 'Day 7', pct: 43 },
  { type: 'quote', l1: 'NO GUTS.', l2: 'NO', l3: 'GLORY.', attr: 'earn every single day', next: 'Day 7', pct: 57 },
  { type: 'quote', l1: 'DECIDE', l2: 'TO', l3: 'WIN.', attr: 'winners decided before they started', next: 'Day 7', pct: 86 },
  { type: 'milestone', tag: MILESTONE_DATA[7].tag, h1: MILESTONE_DATA[7].h1, h2: MILESTONE_DATA[7].h2, body: MILESTONE_DATA[7].body, next: `Day ${MILESTONE_DATA[7].nextMilestone}` },
  { type: 'quote', l1: 'DON\'T', l2: 'STOP', l3: 'NOW.', attr: 'day 8. the streak is real.', next: 'Day 21', pct: 7 },
  { type: 'quote', l1: 'BE', l2: 'LEGEND-', l3: 'ARY.', attr: 'legends are built one day at a time', next: 'Day 21', pct: 14 },
  { type: 'quote', l1: '1%', l2: 'BETTER', l3: 'EVERY DAY.', attr: 'day 10. the compound effect is working', next: 'Day 21', pct: 21 },
  { type: 'quote', l1: 'THIS IS', l2: 'YOUR', l3: 'TIME.', attr: 'not someday. right now.', next: 'Day 21', pct: 29 },
  { type: 'quote', l1: 'HOLD', l2: 'THE', l3: 'LINE.', attr: 'discipline is doing it when you don\'t feel like it', next: 'Day 21', pct: 36 },
  { type: 'quote', l1: 'WINNING', l2: 'ISN\'T FOR', l3: 'EVERYONE.', attr: 'good. more for you.', next: 'Day 21', pct: 43 },
  { type: 'quote', l1: 'TWO WEEKS.', l2: 'STILL', l3: 'HERE.', attr: 'most quit before now. you didn\'t.', next: 'Day 21', pct: 50 },
  { type: 'quote', l1: 'SHOW UP.', l2: 'EVERY', l3: 'DAY.', attr: 'that\'s the whole strategy', next: 'Day 21', pct: 57 },
  { type: 'quote', l1: 'ARE YOU', l2: 'BUILT', l3: 'FOR THIS?', attr: 'prove it today.', next: 'Day 21', pct: 64 },
  { type: 'quote', l1: 'NO', l2: 'DAYS', l3: 'OFF.', attr: 'the inputs don\'t care how you feel', next: 'Day 21', pct: 71 },
  { type: 'quote', l1: 'MEET THE', l2: '10X VERSION', l3: 'OF YOU.', attr: 'they showed up today too.', next: 'Day 21', pct: 79 },
  { type: 'quote', l1: 'BELIEVE', l2: 'IN', l3: 'YOURSELF.', attr: 'because no one else can do this for you', next: 'Day 21', pct: 86 },
  { type: 'quote', l1: 'ONE MORE', l2: 'DAY.', l3: 'ALWAYS.', attr: 'day 21 is tomorrow. don\'t blink.', next: 'Day 21', pct: 93 },
  { type: 'milestone', tag: MILESTONE_DATA[21].tag, h1: MILESTONE_DATA[21].h1, h2: MILESTONE_DATA[21].h2, body: MILESTONE_DATA[21].body, next: `Day ${MILESTONE_DATA[21].nextMilestone}` },
  { type: 'quote', l1: 'YOU ARE', l2: 'UNSTOP-', l3: 'PABLE.', attr: 'act like it today', next: 'Day 40', pct: 5 },
  { type: 'quote', l1: 'NEVER.', l2: 'NEVER.', l3: 'QUIT.', attr: 'churchill said it. now you live it.', next: 'Day 40', pct: 11 },
  { type: 'quote', l1: 'ARE YOU', l2: 'WHO YOU', l3: 'SAID YOU\'D BE?', attr: 'today is your answer.', next: 'Day 40', pct: 16 },
  { type: 'quote', l1: 'THE INPUTS', l2: 'ARE THE', l3: 'OUTCOME.', attr: 'trust the system', next: 'Day 40', pct: 21 },
  { type: 'quote', l1: 'YOUR LIFE', l2: 'MATTERS.', l3: 'MAKE IT COUNT.', attr: 'every single day', next: 'Day 40', pct: 26 },
  { type: 'quote', l1: 'NO', l2: 'EXCUSES.', l3: 'EVER.', attr: 'the person you\'re becoming doesn\'t make them', next: 'Day 40', pct: 32 },
  { type: 'quote', l1: 'FOUR', l2: 'WEEKS', l3: 'DONE.', attr: 'compounding is invisible until it isn\'t', next: 'Day 40', pct: 37 },
  { type: 'quote', l1: 'DO IT', l2: 'SCARED.', l3: 'DO IT TIRED.', attr: 'just do it', next: 'Day 40', pct: 42 },
  { type: 'quote', l1: 'YOUR LIFE', l2: 'YOUR', l3: 'RULES.', attr: 'own every inch of it', next: 'Day 40', pct: 47 },
  { type: 'quote', l1: 'YOUR FUTURE', l2: 'SELF IS', l3: 'WATCHING.', attr: 'don\'t let them down', next: 'Day 40', pct: 53 },
  { type: 'quote', l1: 'THE WORK', l2: 'IS THE', l3: 'WAY.', attr: 'nothing replaces this', next: 'Day 40', pct: 58 },
  { type: 'quote', l1: 'ARE WE', l2: 'BUILDING', l3: 'TODAY?', attr: 'day 33. the answer never changes.', next: 'Day 40', pct: 63 },
  { type: 'quote', l1: 'BE THE', l2: 'PERSON', l3: 'YOU NEEDED.', attr: 'someone is watching you become them', next: 'Day 40', pct: 68 },
  { type: 'quote', l1: 'HALF-', l2: 'WAY', l3: 'ISN\'T DONE.', attr: 'five weeks in. keep going.', next: 'Day 40', pct: 74 },
  { type: 'quote', l1: 'GOOD THINGS', l2: 'TAKE', l3: 'TIME.', attr: 'great things take 77 days', next: 'Day 40', pct: 79 },
  { type: 'quote', l1: 'YOUR ONLY', l2: 'COMPETITION', l3: 'IS YOU.', attr: 'beat yesterday', next: 'Day 40', pct: 84 },
  { type: 'quote', l1: 'WINNERS', l2: 'DO IT', l3: 'ANYWAY.', attr: 'feeling it or not', next: 'Day 40', pct: 89 },
  { type: 'quote', l1: 'ONE DAY', l2: 'FROM', l3: 'HALFWAY.', attr: 'tomorrow is a milestone. show up.', next: 'Day 40', pct: 95 },
  { type: 'milestone', tag: MILESTONE_DATA[40].tag, h1: MILESTONE_DATA[40].h1, h2: MILESTONE_DATA[40].h2, body: MILESTONE_DATA[40].body, next: `Day ${MILESTONE_DATA[40].nextMilestone}` },
  { type: 'quote', l1: 'THERE IS', l2: 'NO', l3: 'GOING BACK.', attr: 'you\'re already someone different', next: 'Day 77', pct: 11 },
  { type: 'quote', l1: 'SIX', l2: 'WEEKS', l3: 'IN.', attr: 'the compound effect doesn\'t lie', next: 'Day 77', pct: 14 },
  { type: 'quote', l1: 'THIS IS', l2: 'WHO', l3: 'YOU ARE.', attr: 'not who you\'re trying to be', next: 'Day 77', pct: 19 },
  { type: 'quote', l1: 'MAKE IT', l2: 'LOOK', l3: 'EASY.', attr: 'because the work already happened', next: 'Day 77', pct: 22 },
  { type: 'quote', l1: 'ARE YOU', l2: 'ALL IN', l3: 'TODAY?', attr: '32 days left. leave nothing.', next: 'Day 77', pct: 27 },
  { type: 'quote', l1: 'LEGENDARY', l2: 'ISN\'T', l3: 'LUCKY.', attr: 'it\'s days like today, repeated', next: 'Day 77', pct: 30 },
  { type: 'quote', l1: 'YOUR LIFE', l2: 'YOUR', l3: 'RULES.', attr: 'own every inch of it', next: 'Day 77', pct: 35 },
  { type: 'quote', l1: 'THE BEST', l2: 'VERSION', l3: 'OF YOU', attr: 'showed up today', next: 'Day 77', pct: 38 },
  { type: 'quote', l1: 'SEVEN', l2: 'WEEKS', l3: 'DONE.', attr: 'you belong here now', next: 'Day 77', pct: 43 },
  { type: 'quote', l1: 'FIFTY', l2: 'DAYS.', l3: 'FIFTY.', attr: 'most people only dream about this', next: 'Day 77', pct: 46 },
  { type: 'quote', l1: 'KEEP', l2: 'STACK-', l3: 'ING.', attr: 'every input compounds', next: 'Day 77', pct: 51 },
  { type: 'quote', l1: 'THIS IS', l2: 'YOUR', l3: 'SEASON.', attr: 'not someday. now.', next: 'Day 77', pct: 54 },
  { type: 'quote', l1: 'ARE YOU', l2: 'LEAVING', l3: 'IT ALL?', attr: 'day 53. give everything.', next: 'Day 77', pct: 59 },
  { type: 'quote', l1: 'DON\'T', l2: 'COAST', l3: 'NOW.', attr: 'the finish line pulls weak people backward', next: 'Day 77', pct: 62 },
  { type: 'quote', l1: 'NEVER.', l2: 'NEVER.', l3: 'QUIT.', attr: '22 days left. finish what you started.', next: 'Day 77', pct: 65 },
  { type: 'quote', l1: 'EIGHT', l2: 'WEEKS', l3: 'STRONG.', attr: 'you\'re not the same person who started', next: 'Day 77', pct: 68 },
  { type: 'quote', l1: 'THE INPUTS', l2: 'NEVER', l3: 'LIE.', attr: 'what did you put in today?', next: 'Day 77', pct: 73 },
  { type: 'quote', l1: 'DECIDE', l2: 'AGAIN', l3: 'TODAY.', attr: 'commitment isn\'t a one-time thing', next: 'Day 77', pct: 76 },
  { type: 'quote', l1: 'YOUR BEST', l2: 'IS', l3: 'AHEAD.', attr: 'the compound curve is about to spike', next: 'Day 77', pct: 81 },
  { type: 'milestone', tag: MILESTONE_DATA[60].tag, h1: MILESTONE_DATA[60].h1, h2: MILESTONE_DATA[60].h2, body: MILESTONE_DATA[60].body, next: `Day ${MILESTONE_DATA[60].nextMilestone}` },
  { type: 'quote', l1: 'THE END', l2: 'IS THE', l3: 'BEGINNING.', attr: 'finish this. then go further.', next: 'Day 77', pct: 86 },
  { type: 'quote', l1: 'ARE YOU', l2: 'GOING TO', l3: 'FINISH?', attr: 'day 62. that\'s not a real question.', next: 'Day 77', pct: 89 },
  { type: 'quote', l1: 'NINE', l2: 'WEEKS.', l3: 'NINE.', attr: 'one more week to go', next: 'Day 77', pct: 92 },
  { type: 'quote', l1: 'YOUR LIFE', l2: 'MATTERS.', l3: 'MAKE IT COUNT.', attr: '13 days left. make each one.', next: 'Day 77', pct: 73 },
  { type: 'quote', l1: 'HOLD', l2: 'THE', l3: 'LINE.', attr: 'the finish line is close enough to smell', next: 'Day 77', pct: 76 },
  { type: 'quote', l1: 'SAY GOODBYE', l2: 'TO', l3: 'AVERAGE.', attr: 'you already did. day 1.', next: 'Day 77', pct: 78 },
  { type: 'quote', l1: 'THE 10X', l2: 'VERSION', l3: 'OF YOU', attr: 'finishes what they start', next: 'Day 77', pct: 81 },
  { type: 'quote', l1: 'TEN', l2: 'DAYS', l3: 'LEFT.', attr: 'everything you\'ve built is about to pay off', next: 'Day 77', pct: 84 },
  { type: 'quote', l1: 'YOU\'RE', l2: 'ALMOST', l3: 'THERE.', attr: 'don\'t you dare stop', next: 'Day 77', pct: 86 },
  { type: 'quote', l1: 'ONE', l2: 'WEEK', l3: 'LEFT.', attr: 'seven days. give them everything.', next: 'Day 77', pct: 89 },
  { type: 'quote', l1: 'BE', l2: 'LEGEND-', l3: 'ARY.', attr: '6 days. legends finish.', next: 'Day 77', pct: 92 },
  { type: 'quote', l1: 'THIS', l2: 'IS', l3: 'YOUR TIME.', attr: 'it always was', next: 'Day 77', pct: 95 },
  { type: 'quote', l1: 'WINNING', l2: 'ISN\'T FOR', l3: 'EVERYONE.', attr: 'but it\'s for you. prove it.', next: 'Day 77', pct: 97 },
  { type: 'quote', l1: 'THREE', l2: 'DAYS.', l3: 'THREE.', attr: 'you\'ve come too far to slow down now', next: 'Day 77', pct: 99 },
  { type: 'quote', l1: 'ARE YOU', l2: 'READY TO', l3: 'BE GREAT?', attr: 'two days left. yes.', next: 'Day 77', pct: 99 },
  { type: 'quote', l1: 'TOMORROW', l2: 'YOU', l3: 'FINISH.', attr: 'the last day of the old you', next: 'Day 77', pct: 99 },
  { type: 'milestone', tag: MILESTONE_DATA[77].tag, h1: MILESTONE_DATA[77].h1, h2: MILESTONE_DATA[77].h2, body: MILESTONE_DATA[77].body, next: '' },
];

interface CoachCardProps {
  challengeDay: number;
}

export default function CoachCard({ challengeDay }: CoachCardProps) {
  const { colors, isDark } = useTheme();
  const cardBg = '#1A1A1A';
  const textPrimary = '#FFFFFF';
  const textAttr = '#444444';
  const footerLabelColor = '#555555';
  const footerBorderColor = 'rgba(255,255,255,0.08)';
  const progressTrackBg = 'rgba(255,255,255,0.12)';
  const day = challengeDay || 1;
  const index = Math.min(Math.max(day - 1, 0), DAYS.length - 1);
  const entry = DAYS[index];

  if (entry.type === 'milestone') {
    const isLastMilestone = MILESTONE_DATA[day]?.nextMilestone === null;
    const nextDay = MILESTONE_DATA[day]?.nextMilestone;
    return (
      <View style={styles.milestoneCard}>
        <View style={styles.milestoneContent}>
          <Text style={styles.milestoneTag}>{entry.tag}</Text>
          <Text style={styles.milestoneH1}>{entry.h1}</Text>
          <Text style={styles.milestoneH2}>{entry.h2}</Text>
          <Text style={styles.milestoneBody}>{entry.body}</Text>
        </View>
        <View style={styles.milestoneFooter}>
          {isLastMilestone ? (
            <Text style={styles.milestonePhase2}>PHASE 2 UNLOCKED — JOURNEY CONTINUES</Text>
          ) : (
            <>
              <Text style={styles.milestoneNextLabel}>NEXT MILESTONE</Text>
              <View style={styles.milestonePill}>
                <Text style={styles.milestonePillText}>Day {nextDay}</Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  const quoteEntry = entry as QuoteEntry;
  const nextMilestone = getNextMilestone(day);
  const progress = getMilestoneProgress(day);

  return (
    <View style={[styles.quoteCard, { backgroundColor: cardBg }]}>
      <View style={styles.quoteContent}>
        <Text style={[styles.quoteLine1, { color: textPrimary }]}>{quoteEntry.l1}</Text>
        <Text style={styles.quoteLine2}>{quoteEntry.l2}</Text>
        <Text style={[styles.quoteLine3, { color: textPrimary }]}>{quoteEntry.l3}</Text>
        <Text style={[styles.quoteAttr, { color: textAttr }]}>— {quoteEntry.attr}</Text>
      </View>
      <View style={[styles.quoteFooter, { borderTopColor: footerBorderColor }]}>
        <Text style={[styles.quoteNextLabel, { color: footerLabelColor }]}>NEXT MILESTONE</Text>
        <View style={styles.quotePill}>
          <Text style={styles.quotePillText}>{nextMilestone ? `Day ${nextMilestone}` : quoteEntry.next}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: progressTrackBg }]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quoteCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  quoteContent: {
    padding: 16,
    paddingBottom: 14,
  },
  quoteLine1: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 25,
    letterSpacing: -0.25,
  },
  quoteLine2: {
    fontSize: 25,
    fontWeight: '900',
    color: '#CCFF00',
    lineHeight: 25,
    letterSpacing: -0.25,
  },
  quoteLine3: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 25,
    letterSpacing: -0.25,
    marginBottom: 10,
  },
  quoteAttr: {
    fontSize: 9,
    color: '#444444',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  quoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  quoteNextLabel: {
    fontSize: 8,
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  quotePill: {
    backgroundColor: '#CCFF00',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quotePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#CCFF00',
    borderRadius: 2,
  },
  milestoneCard: {
    backgroundColor: '#CCFF00',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  milestoneContent: {
    padding: 16,
    paddingBottom: 14,
  },
  milestoneTag: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  milestoneH1: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    lineHeight: 22,
    letterSpacing: -0.25,
  },
  milestoneH2: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    lineHeight: 22,
    letterSpacing: -0.25,
    marginBottom: 10,
  },
  milestoneBody: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.65)',
    lineHeight: 15,
  },
  milestoneFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.12)',
    gap: 8,
  },
  milestoneNextLabel: {
    fontSize: 8,
    color: 'rgba(0,0,0,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  milestonePill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  milestonePillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#CCFF00',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  milestonePhase2: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
