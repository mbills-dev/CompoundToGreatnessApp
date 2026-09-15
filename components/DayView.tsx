import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ImageBackground,
  Platform,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Goal, DailyActivity } from '@/types/database';
import { toLocalDateString, getDayNumberFromChallengeStart } from '@/lib/dateHelpers';

const LIME = '#CCFF00';
const TOTAL_CHALLENGE_DAYS = 77;
const ROW_HEIGHT = 64;
const NOW_ROW_HEIGHT = 40;
const TOP_PADDING = 16;

// Layout column widths (must match styles below)
const TIME_COL_W = 68;
const RAIL_COL_W = 28;
const RAIL_CENTER_X = TIME_COL_W + RAIL_COL_W / 2; // 82

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
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [nowTick, setNowTick] = useState(new Date());
  const hasScrolledRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animation values
  const backdropOpacity = useSharedValue(0);
  const sheetOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(28);
  const heroOpacity = useSharedValue(1);

  // Reduced motion
  useEffect(() => {
    if (Platform.OS === 'web') return;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // NOW tick — updates every 30s while visible
  useEffect(() => {
    if (!visible) {
      hasScrolledRef.current = false;
      return;
    }
    const interval = setInterval(() => setNowTick(new Date()), 30000);
    return () => clearInterval(interval);
  }, [visible]);

  // Enter / reset animation
  useEffect(() => {
    if (!visible) {
      setIsClosing(false);
      hasScrolledRef.current = false;
      if (reduceMotion) {
        backdropOpacity.value = 0;
        sheetOpacity.value = 0;
        sheetTranslateY.value = 0;
        heroOpacity.value = 1;
      } else {
        backdropOpacity.value = 0;
        sheetOpacity.value = 0;
        sheetTranslateY.value = 28;
        heroOpacity.value = 0.8;
      }
      return;
    }

    const easing = Easing.out(Easing.cubic);

    if (reduceMotion) {
      backdropOpacity.value = withTiming(0.5, { duration: 200 });
      sheetOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = 0;
      heroOpacity.value = 1;
    } else {
      backdropOpacity.value = withTiming(0.5, { duration: 250, easing });
      sheetOpacity.value = withTiming(1, { duration: 350, easing });
      sheetTranslateY.value = withTiming(0, { duration: 350, easing });
      heroOpacity.value = withDelay(60, withTiming(1, { duration: 300, easing }));
    }
  }, [visible, reduceMotion]);

  // Close handler — plays exit animation, then calls onClose
  const handleCloseComplete = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    const easing = Easing.in(Easing.cubic);

    if (reduceMotion) {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      sheetOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(handleCloseComplete)();
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 240, easing });
      sheetTranslateY.value = withTiming(22, { duration: 240, easing });
      sheetOpacity.value = withTiming(0, { duration: 240, easing }, (finished) => {
        if (finished) runOnJS(handleCloseComplete)();
      });
      heroOpacity.value = withTiming(0.8, { duration: 200, easing });
    }
  }, [isClosing, reduceMotion, handleCloseComplete]);

  // Derived data
  const today = toLocalDateString(new Date());
  const isToday = today === toLocalDateString(new Date());
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

  // Where NOW belongs — the index of the first activity that hasn't happened yet.
  // NOW renders as a real row inserted at this index, so normal layout pushes
  // everything else apart automatically. It can never overlap a scheduled activity.
  const nowInsertIndex = useMemo(() => {
    if (timedActivities.length === 0) return 0;
    for (let i = 0; i < timedActivities.length; i++) {
      if (scheduleToMinutes(timedActivities[i].schedule!) > nowMinutes) {
        return i;
      }
    }
    return timedActivities.length;
  }, [timedActivities, nowMinutes]);

  const showNow = isToday && timedActivities.length > 0;

  // Row-center Y helper for the decorative rail line only — accounts for the
  // inserted NOW slot's height shifting everything after it down.
  const rowCenterY = (index: number) => {
    const slotOffset = index >= nowInsertIndex ? NOW_ROW_HEIGHT : 0;
    return TOP_PADDING + index * ROW_HEIGHT + slotOffset + ROW_HEIGHT / 2;
  };
  const nowRowTop = TOP_PADDING + nowInsertIndex * ROW_HEIGHT;
  const nowRowCenter = nowRowTop + NOW_ROW_HEIGHT / 2;
  const firstRowCenter = timedActivities.length > 0 ? rowCenterY(0) : 0;
  const lastRowCenter = timedActivities.length > 0 ? rowCenterY(timedActivities.length - 1) : 0;

  // Auto-scroll: position NOW roughly in the upper-middle of the viewport
  useEffect(() => {
    if (!visible || !showNow) return;
    const timer = setTimeout(() => {
      if (!scrollRef.current || hasScrolledRef.current) return;
      const viewportH = windowHeight - insets.top - insets.bottom;
      const scrollTo = Math.max(0, nowRowCenter - viewportH * 0.38);
      scrollRef.current.scrollTo({ y: scrollTo, animated: false });
      hasScrolledRef.current = true;
    }, 50);
    return () => clearTimeout(timer);
  }, [visible, showNow, nowRowCenter, windowHeight, insets.top, insets.bottom]);

  // Animated styles
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const sheetAnimStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const heroAnimStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop — dims the Today screen underneath */}
        <Animated.View style={[styles.backdrop, backdropAnimStyle]} />

        {/* Sheet — the Day View content */}
        <Animated.View style={[styles.sheet, sheetAnimStyle]}>
          <View style={styles.container}>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
              showsVerticalScrollIndicator={false}
            >
              {/* HERO with subtle secondary fade */}
              <Animated.View style={heroAnimStyle}>
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
              </Animated.View>

              {/* YOUR DAY section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>YOUR DAY</Text>
                <Text style={styles.sectionDate}>{formatDateAbbrev(new Date())}</Text>
              </View>

              {/* TIMELINE — one continuous rail system */}
              {timedActivities.length > 0 && (
                <View style={styles.timelineContainer}>
                  {/* Continuous rail: past portion (lime tint, first task → NOW) */}
                  {showNow && nowInsertIndex > 0 && (
                    <View
                      style={[
                        styles.continuousRail,
                        {
                          top: firstRowCenter,
                          height: nowRowCenter - firstRowCenter,
                          backgroundColor: 'rgba(204,255,0,0.22)',
                        },
                      ]}
                    />
                  )}
                  {/* Continuous rail: future portion (dark gray, NOW → last task) */}
                  {showNow && nowInsertIndex < timedActivities.length && (
                    <View
                      style={[
                        styles.continuousRail,
                        {
                          top: nowRowCenter,
                          height: lastRowCenter - nowRowCenter,
                          backgroundColor: 'rgba(58,58,58,0.6)',
                        },
                      ]}
                    />
                  )}
                  {/* Continuous rail: default when NOW is not shown */}
                  {!showNow && (
                    <View
                      style={[
                        styles.continuousRail,
                        {
                          top: firstRowCenter,
                          height: lastRowCenter - firstRowCenter,
                          backgroundColor: 'rgba(58,58,58,0.6)',
                        },
                      ]}
                    />
                  )}

                  {/* Task rows, with a real NOW row inserted at nowInsertIndex */}
                  {(() => {
                    const rows: React.ReactNode[] = [];
                    const renderNowRow = () => (
                      <View key="now-row" style={styles.nowRow}>
                        <View style={styles.timeColumn} />
                        <View style={styles.railColumn}>
                          <View style={styles.nowDotWrap}>
                            <View style={styles.nowDotOuterLocal} />
                            <View style={styles.nowDotLocal} />
                          </View>
                        </View>
                        <View style={styles.nowLabelRow}>
                          <View style={styles.nowRuleLine} />
                          <Text style={styles.nowTimeTextStatic} numberOfLines={1}>
                            NOW · {formatCurrentTime(nowTick)}
                          </Text>
                        </View>
                      </View>
                    );

                    timedActivities.forEach((item, index) => {
                      if (showNow && index === nowInsertIndex) {
                        rows.push(renderNowRow());
                      }
                      const isCompleted = completedActivities.includes(item.activity.id);
                      const timeLabel = formatTime(item.schedule!.hour, item.schedule!.minute, item.schedule!.period);
                      const isPast = scheduleToMinutes(item.schedule!) < nowMinutes;
                      rows.push(
                        <View key={item.activity.id} style={styles.timelineRow}>
                          <View style={styles.timeColumn}>
                            <Text style={[styles.timeLabel, isCompleted && styles.timeLabelCompleted, isPast && !isCompleted && styles.timeLabelPast]}>
                              {timeLabel}
                            </Text>
                          </View>
                          <View style={styles.railColumn}>
                            <View style={[styles.railNode, isCompleted && styles.railNodeCompleted, !isCompleted && isPast && styles.railNodePast, !isCompleted && !isPast && styles.railNodeFuture]} />
                          </View>
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
                    });

                    if (showNow && nowInsertIndex === timedActivities.length) {
                      rows.push(renderNowRow());
                    }

                    return rows;
                  })()}
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
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Animation containers
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#050505',
  },
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
    width: TIME_COL_W,
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
  railColumn: {
    width: RAIL_COL_W,
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
  continuousRail: {
    position: 'absolute',
    left: RAIL_CENTER_X - 1,
    width: 2,
    borderRadius: 1,
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
  // NOW indicator (legacy styles kept for reference — replaced by nowRow)
  nowIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    zIndex: 10,
    elevation: 10,
  },
  nowTimeText: {
    position: 'absolute',
    left: RAIL_CENTER_X + 44,
    top: -7,
    fontSize: 11,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 0.3,
  },
  nowDotContainer: {
    position: 'absolute',
    left: RAIL_CENTER_X - 10,
    top: -10,
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
    left: RAIL_CENTER_X + 10,
    width: 30,
    top: -1,
    height: 2,
    backgroundColor: LIME,
    opacity: 0.6,
  },
  // NOW row — inserted as a real row in the timeline
  nowRow: {
    flexDirection: 'row',
    height: NOW_ROW_HEIGHT,
    alignItems: 'center',
  },
  nowDotWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowDotOuterLocal: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(204,255,0,0.25)',
  },
  nowDotLocal: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LIME,
  },
  nowLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nowRuleLine: {
    width: 20,
    height: 2,
    backgroundColor: LIME,
    opacity: 0.6,
    borderRadius: 1,
  },
  nowTimeTextStatic: {
    fontSize: 11,
    fontWeight: '800',
    color: LIME,
    letterSpacing: 0.3,
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
