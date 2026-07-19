import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { X, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const DAYS = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
  { key: 'Sun', label: 'S' },
];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PERIODS = ['AM', 'PM'] as const;

export interface WhenPickerValue {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  days: string[];
  reminder: boolean;
  allDay?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (value: WhenPickerValue) => void;
  initialValue?: WhenPickerValue;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

function NumberScroller({
  items,
  selectedIndex,
  onSelect,
  formatItem,
  colors,
  isDark,
}: {
  items: number[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem: (item: number) => string;
  colors: any;
  isDark: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  const handleScrollEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  };

  return (
    <View style={scrollerStyles.container}>
      <View style={[scrollerStyles.highlight, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        borderColor: colors.primary + '30',
      }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT,
        }}
        style={scrollerStyles.scroll}
      >
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              style={scrollerStyles.item}
              onPress={() => {
                onSelect(i);
                scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                scrollerStyles.itemText,
                {
                  color: isSelected ? colors.text : colors.textTertiary,
                  fontWeight: isSelected ? '800' : '500',
                  fontSize: isSelected ? 28 : 20,
                  opacity: isSelected ? 1 : 0.4,
                },
              ]}>
                {formatItem(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const scrollerStyles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 0,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    textAlign: 'center',
  },
});

export default function WhenPickerModal({ visible, onClose, onConfirm, initialValue }: Props) {
  const { colors, isDark } = useTheme();

  const [hour, setHour] = useState(initialValue?.hour ?? 7);
  const [minute, setMinute] = useState(initialValue?.minute ?? 0);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialValue?.period ?? 'AM');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    initialValue?.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  );
  const [reminder, setReminder] = useState(initialValue?.reminder ?? false);
  const [allDay, setAllDay] = useState(initialValue?.allDay ?? false);

  const backdropOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(400);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250 });
      sheetTranslate.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      sheetTranslate.value = withTiming(400, { duration: 250 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }));

  const toggleDay = (day: string) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== day);
      }
      return [...prev, day];
    });
  };

  const selectAllDays = () => {
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  };

  const selectWeekdays = () => {
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  };

  const hourIndex = HOURS.indexOf(hour);
  const minuteIndex = MINUTES.indexOf(minute);

  const allSelected = selectedDays.length === 7;
  const weekdaysSelected =
    selectedDays.length === 5 &&
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d => selectedDays.includes(d));

  const handleConfirm = () => {
    onConfirm({ hour, minute, period, days: selectedDays, reminder, allDay });
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={modalStyles.wrapper}>
        <Animated.View style={[modalStyles.backdrop, backdropStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View style={[modalStyles.sheet, sheetStyle, {
          backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
        }]}>
          <View style={modalStyles.handle}>
            <View style={[modalStyles.handleBar, {
              backgroundColor: isDark ? colors.border : '#D0D0D0',
            }]} />
          </View>

          <View style={modalStyles.headerRow}>
            <Text style={[modalStyles.title, { color: colors.text }]}>Set Your Schedule</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={modalStyles.closeBtn}>
              <X size={20} color={colors.textTertiary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <Text style={[modalStyles.sectionLabel, { color: colors.textTertiary }]}>TIME</Text>

          {/* All Day toggle */}
          <TouchableOpacity
            style={[modalStyles.allDayRow, {
              backgroundColor: allDay
                ? (isDark ? 'rgba(204,255,0,0.08)' : 'rgba(204,255,0,0.10)')
                : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
              borderColor: allDay ? colors.primary + '60' : 'transparent',
            }]}
            onPress={() => setAllDay(!allDay)}
            activeOpacity={0.8}
          >
            <Text style={[modalStyles.allDayLabel, { color: allDay ? colors.primary : colors.text }]}>
              All day
            </Text>
            <View style={[modalStyles.reminderToggle, {
              backgroundColor: allDay ? colors.primary : (isDark ? colors.border : '#D0D0D0'),
            }]}>
              <View style={[modalStyles.reminderToggleKnob, {
                alignSelf: allDay ? 'flex-end' : 'flex-start',
                backgroundColor: allDay ? '#000000' : '#FFFFFF',
              }]} />
            </View>
          </TouchableOpacity>

          {/* Time scrollers — dimmed when All Day is on */}
          <View style={[modalStyles.timeRow, { opacity: allDay ? 0.25 : 1 }]}
            pointerEvents={allDay ? 'none' : 'auto'}>
            <View style={modalStyles.scrollerWrapper}>
              <NumberScroller
                items={HOURS}
                selectedIndex={hourIndex >= 0 ? hourIndex : 0}
                onSelect={(i) => setHour(HOURS[i])}
                formatItem={(h) => String(h)}
                colors={colors}
                isDark={isDark}
              />
            </View>

            <Text style={[modalStyles.timeSeparator, { color: colors.text }]}>:</Text>

            <View style={modalStyles.scrollerWrapper}>
              <NumberScroller
                items={MINUTES}
                selectedIndex={minuteIndex >= 0 ? minuteIndex : 0}
                onSelect={(i) => setMinute(MINUTES[i])}
                formatItem={(m) => String(m).padStart(2, '0')}
                colors={colors}
                isDark={isDark}
              />
            </View>

            <View style={modalStyles.periodColumn}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[modalStyles.periodBtn, {
                    backgroundColor: period === p
                      ? colors.primary
                      : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[modalStyles.periodText, {
                    color: period === p ? '#000000' : colors.textTertiary,
                    fontWeight: period === p ? '800' : '600',
                  }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={[modalStyles.sectionLabel, { color: colors.textTertiary }]}>DAYS</Text>

          <View style={modalStyles.quickSelectRow}>
            <TouchableOpacity
              style={[modalStyles.quickSelectBtn, {
                backgroundColor: allSelected
                  ? colors.primary + '20'
                  : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: allSelected ? colors.primary : 'transparent',
              }]}
              onPress={selectAllDays}
              activeOpacity={0.8}
            >
              <Text style={[modalStyles.quickSelectText, {
                color: allSelected ? colors.primary : colors.textSecondary,
              }]}>Every day</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.quickSelectBtn, {
                backgroundColor: weekdaysSelected
                  ? colors.primary + '20'
                  : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: weekdaysSelected ? colors.primary : 'transparent',
              }]}
              onPress={selectWeekdays}
              activeOpacity={0.8}
            >
              <Text style={[modalStyles.quickSelectText, {
                color: weekdaysSelected ? colors.primary : colors.textSecondary,
              }]}>Weekdays</Text>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.daysRow}>
            {DAYS.map((day, i) => {
              const isActive = selectedDays.includes(day.key);
              return (
                <TouchableOpacity
                  key={day.key}
                  style={[modalStyles.dayBtn, {
                    backgroundColor: isActive
                      ? colors.primary
                      : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  }]}
                  onPress={() => toggleDay(day.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[modalStyles.dayBtnText, {
                    color: isActive ? '#000000' : colors.textTertiary,
                    fontWeight: isActive ? '800' : '600',
                  }]}>{day.label}</Text>
                  <Text style={[modalStyles.dayBtnSubtext, {
                    color: isActive ? 'rgba(0,0,0,0.5)' : colors.textTertiary,
                  }]}>{day.key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[modalStyles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={modalStyles.confirmBtnText}>Set Schedule</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 24 : 40,
    maxHeight: '90%',
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  allDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  allDayLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  scrollerWrapper: {
    width: 72,
  },
  timeSeparator: {
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: 2,
  },
  periodColumn: {
    gap: 6,
    marginLeft: 12,
  },
  periodBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
  quickSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  quickSelectBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickSelectText: {
    fontSize: 13,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 20,
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 2,
  },
  dayBtnText: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
  dayBtnSubtext: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTextCol: {
    flex: 1,
    gap: 2,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reminderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  reminderToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  reminderToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  confirmBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.2,
  },
});
