import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Goal, DailyActivity } from '@/types/database';
import { toLocalDateString, getDayNumberFromChallengeStart } from '@/lib/dateHelpers';

const LIME = '#CCFF00';
const TOTAL_CHALLENGE_DAYS = 77;
const ROW_HEIGHT = 64;
const TOP_PADDING = 16;

interface ScheduleInfo {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  allDay: boolean;
}

interface DayViewProps {
  visible: boolean;
  onClose: () => void;
  goal: Goal;
  activities: DailyActivity[];
  completedActivities: string[];
  onToggle: (activityId: string) => void;
}

function extractSchedule(activity: DailyActivity): ScheduleInfo | null {
  if (!activity.schedule) return null;
  const s = activity.schedule;
  if (s.allDay === true) return { hour: 0, minute: 0, period: 'AM', allDay: true };
  if (typeof s.hour !== 'number') return null;
  return {
    hour: s.hour,
    minute: s.minute ?? 0,
    period: s.period ?? 'AM',
    allDay: false,
  };
}

function scheduleToMinutes(info: ScheduleInfo): number {
  let h = info.hour;
  if (info.period === 'PM' && h !== 12) h += 12;
  if (info.period === 'AM' && h === 12) h = 0;
  return h * 60 + info.minute;
}

function formatTime(hour: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour;
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const periodLabel = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(minute).padStart(2, '0')} ${periodLabel}`;
}

function formatCurrentTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const periodLabel = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${periodLabel}`;
}

function formatDateAbbrev(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

const COACHING_BG = require('@/assets/images/CleanCinematicMountainSunrise.png');

export default function DayView({
  visible,
  onClose,
  goal,
  activities,
  completedActivities,
  onToggle,
}: DayViewProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [nowTick, setNowTick] = useState(new Date());
  const nowYRef = useRef<number | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      hasScrolledRef.current = false;
      nowYRef.current = null;
      return;
    }
    const interval = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(interval);
  }, [visible]);

  const today = toLocalDateString(new Date());
  const displayDay = goal.challenge_start_date
    ? getDayNumberFromChallengeStart(goal.challenge_start_date, today)
    : 1;
  const challengePct = Math.round((Math.min(displayDay, TOTAL_CHALLENGE_DAYS) / TOTAL_CHALLENGE_DAYS) * 100);

  const timedActivities = useMemo(() => {
    return activities
      .map(a => ({ activity: a, schedule: extractSchedule(a) }))
      .filter(item => item.schedule && !item.schedule.allDay)
      .sort((a, b) => scheduleToMinutes(a.schedule!) - scheduleToMinutes(b.schedule!));
  }, [activities]);

  const anytimeActivities = useMemo(() => {
    return activities
      .map(a => ({ activity: a, schedule: extractSchedule(a) }))
      .filter(item => !item.schedule || item.schedule.allDay)
      .map(item => item.activity)
      .sort((a, b) => a.order_position - b.order_position);
  }, [activities]);

  const nowMinutes = nowTick.getHours() * 60 + nowTick.getMinutes();

  const nowOffset = useMemo(() => {
    if (timedActivities.length === 0) return null;
    const firstMin = scheduleToMinutes(timedActivities[0].schedule!);
    const lastMin = scheduleToMinutes(timedActivities[timedActivities.length - 1].schedule!);
    if (lastMin === firstMin) return null;
    const ratio = (nowMinutes - firstMin) / (lastMin - firstMin);
    if (ratio < 0 || ratio > 1) return null;
    return ratio;
  }, [timedActivities, nowMinutes]);

  const timelineHeight = timedActivities.length * ROW_HEIGHT;

  const handleLayout = useCallback(() => {
    if (hasScrolledRef.current || nowOffset === null || !scrollRef.current) return;
    const targetY = TOP_PADDING + nowOffset * timelineHeight;
    const viewportHeight = 500;
    const scrollTo = Math.max(0, targetY - viewportHeight * 0.4);
    scrollRef.current.scrollTo({ y: scrollTo, animated: false });
    hasScrolledRef.current = true;
  }, [nowOffset, timelineHeight]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
          showsVerticalScrollIndicator={false}
          onLayout={handleLayout}
        >
          {/* HERO */}
          <ImageBackground source={COACHING_BG} style={styles.heroBg} resizeMode="cover">
            <LinearGradient colors={['rgba(5,5,5,0.55)', 'rgba(5,5,5,0.85)']} style={styles.heroOverlay}>
              <View style={[styles.heroContent, { paddingTop: 60 }]}>
                <Text style={styles.heroDay}>DAY {displayDay}</Text>
                <Text style={styles.heroPct}>{challengePct}% THROUGH THE CHALLENGE</Text>
                <Text style={styles.heroDate}>{formatDateAbbrev(new Date())}</Text>
                <View style={styles.philoContainer}>
                  <Text style={styles.philoLine}>Discipline today</Text>
                  <Text style={styles.philoLine}>compounds tomorrow.</Text>
                  <Text style={styles.philoAttribution}>— COMPOUND TO GREATNESS</Text>
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>

          {/* YOUR DAY section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>YOUR DAY</Text>
            <Text style={styles.sectionDate}>{formatDateAbbrev(new Date())}</Text>
          </View>

          {/* TIMELINE */}
          {timedActivities.length > 0 && (
            <View style={styles.timelineContainer}>
              {timedActivities.map((item, index) => {
                const isCompleted = completedActivities.includes(item.activity.id);
                const timeLabel = formatTime(item.schedule!.hour, item.schedule!.minute, item.schedule!.period);
                const isPast = scheduleToMinutes(item.schedule!) < nowMinutes;
                const showConnector = index < timedActivities.length - 1;

                return (
                  <View key={item.activity.id} style={styles.timelineRow}>
                    {/* Time column */}
                    <View style={styles.timeColumn}>
                      <Text style={[styles.timeLabel, isCompleted && styles.timeLabelCompleted, isPast && !isCompleted && styles.timeLabelPast]}>
                        {timeLabel}
                      </Text>
                    </View>

                    {/* Rail column */}
                    <View style={styles.railColumn}>
                      <View style={[styles.railNode, isCompleted && styles.railNodeCompleted, !isCompleted && isPast && styles.railNodePast, !isCompleted && !isPast && styles.railNodeFuture]} />
                      {showConnector && (
                        <View style={[styles.railConnector, isCompleted && styles.railConnectorCompleted]} />
                      )}
                    </View>

                    {/* Activity card */}
                    <TouchableOpacity
                      style={styles.activityCard}
                      onPress={() => onToggle(item.activity.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activityCardContent}>
                        {isCompleted ? (
                          <View style={styles.completedCheck}>
                            <Check size={14} color="#050505" strokeWidth={3} />
                          </View>
                        ) : (
                          <View style={styles.incompleteCircle} />
                        )}
                        <Text
                          style={[styles.activityTitle, isCompleted && styles.activityTitleCompleted]}
                          numberOfLines={2}
                        >
                          {item.activity.activity_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* NOW indicator */}
              {nowOffset !== null && (
                <View
                  style={[
                    styles.nowIndicator,
                    {
                      top: TOP_PADDING + nowOffset * timelineHeight,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={[styles.timeLabel, styles.nowTimeLabel]}>
                    NOW · {formatCurrentTime(nowTick)}
                  </Text>
                  <View style={styles.nowDotContainer}>
                    <View style={styles.nowDotOuter} />
                    <View style={styles.nowDot} />
                  </View>
                  <View style={styles.nowLine} />
                  <Text style={styles.nowActivityLabel}>
                    {nowMinutes < scheduleToMinutes(timedActivities[0].schedule!) ? 'Day hasn\'t started' :
                     nowMinutes > scheduleToMinutes(timedActivities[timedActivities.length - 1].schedule!) ? 'Day is done' :
                     'In progress'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ANYTIME TODAY */}
          {anytimeActivities.length > 0 && (
            <View style={styles.anytimeSection}>
              <Text style={styles.anytimeTitle}>ANYTIME TODAY</Text>
              <View style={styles.anytimeList}>
                {anytimeActivities.map(activity => {
                  const isCompleted = completedActivities.includes(activity.id);
                  return (
                    <TouchableOpacity
                      key={activity.id}
                      style={styles.anytimeRow}
                      onPress={() => onToggle(activity.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activityCardContent}>
                        {isCompleted ? (
                          <View style={styles.completedCheck}>
                            <Check size={14} color="#050505" strokeWidth={3} />
                          </View>
                        ) : (
                          <View style={styles.incompleteCircle} />
                        )}
                        <Text
                          style={[styles.activityTitle, isCompleted && styles.activityTitleCompleted]}
                          numberOfLines={2}
                        >
                          {activity.activity_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={22} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Hero
  heroBg: {
    width: '100%',
    height: 300,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  heroDay: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  heroPct: {
    fontSize: 12,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 1.5,
    marginTop: 8,
  },
  heroDate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8D8D8D',
    marginTop: 6,
  },
  philoContainer: {
    marginTop: 20,
  },
  philoLine: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  philoAttribution: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(204,255,0,0.4)',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 2,
  },
  sectionDate: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8D8D8D',
  },
  // Timeline
  timelineContainer: {
    paddingHorizontal: 24,
    position: 'relative',
  },
  timelineRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    alignItems: 'center',
  },
  timeColumn: {
    width: 68,
    justifyContent: 'center',
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8D8D8D',
  },
  timeLabelCompleted: {
    color: LIME,
  },
  timeLabelPast: {
    color: 'rgba(141,141,141,0.5)',
  },
  nowTimeLabel: {
    color: LIME,
    fontWeight: '800',
  },
  railColumn: {
    width: 28,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
  },
  railNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  railNodeCompleted: {
    backgroundColor: LIME,
    borderColor: LIME,
  },
  railNodeFuture: {
    backgroundColor: '#191919',
    borderColor: '#3A3A3A',
  },
  railNodePast: {
    backgroundColor: '#191919',
    borderColor: '#3A3A3A',
  },
  railConnector: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 2,
    height: ROW_HEIGHT,
    marginLeft: -1,
    marginTop: 5,
    backgroundColor: 'rgba(58,58,58,0.6)',
  },
  railConnectorCompleted: {
    backgroundColor: 'rgba(204,255,0,0.25)',
  },
  // Activity card
  activityCard: {
    flex: 1,
    backgroundColor: '#191919',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 4,
  },
  activityCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  incompleteCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3A3A3A',
    marginRight: 10,
  },
  activityTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  activityTitleCompleted: {
    color: LIME,
  },
  // NOW indicator
  nowIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nowDotContainer: {
    position: 'absolute',
    left: 68 + 9,
    top: -7,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LIME,
  },
  nowDotOuter: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(204,255,0,0.25)',
  },
  nowLine: {
    position: 'absolute',
    left: 68 + 24,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: LIME,
    opacity: 0.6,
  },
  nowActivityLabel: {
    position: 'absolute',
    left: 68 + 32,
    top: -16,
    fontSize: 10,
    fontWeight: '700',
    color: LIME,
  },
  // Anytime
  anytimeSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  anytimeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8D8D8D',
    letterSpacing: 2,
    marginBottom: 16,
  },
  anytimeList: {
    gap: 10,
  },
  anytimeRow: {
    backgroundColor: '#191919',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  // Close button
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
