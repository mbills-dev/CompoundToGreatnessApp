import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock, Target, ChevronRight, Check, Bell } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Dimension } from './types';
import WhenPickerModal, { WhenPickerValue } from './WhenPickerModal';
import { requestNotificationPermissions } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

interface InputEntry {
  dimensionLabel: string;
  what: string;
  when: string;
  where: string;
  schedule?: WhenPickerValue | null;
}

interface Props {
  dimensions: Dimension[];
  inputs: string[];
  currentDimensionIndex: number;
  onConfirmEntry: (statement: string, isLast: boolean, raw: { what: string; when_time: string; where_location: string; schedule: WhenPickerValue | null }) => void;
}

function formatDaysList(days: string[]): string {
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

function formatScheduleText(schedule: WhenPickerValue): string {
  const time = `${schedule.hour}:${String(schedule.minute).padStart(2, '0')} ${schedule.period}`;
  const days = formatDaysList(schedule.days);
  return `${time}, ${days}`;
}

function buildInputStatement(entry: InputEntry): string {
  const what = entry.what.trim();
  const where = entry.where.trim();

  if (!what) return '';

  let statement = what.replace(/^I\s+/i, '');
  const firstChar = statement.charAt(0).toUpperCase();
  statement = firstChar + statement.slice(1);

  if (entry.schedule) {
    statement += ', ' + formatScheduleText(entry.schedule);
  } else if (entry.when.trim()) {
    statement += ', ' + entry.when.trim();
  }

  if (where) {
    const w = where.toLowerCase();
    let prep = 'at';
    if (/^(in |on |at )/.test(w)) {
      prep = '';
    } else if (/^(my |the )?(phone|iphone|android|laptop|computer|pc|mac|macbook|ipad|tablet|device|screen|tv|television|kindle|e-reader|smartwatch|watch|airpods|headphones|headset)\b/.test(w)) {
      prep = 'on';
    } else if (/^(my |the )?(bed|bedroom|bathroom|kitchen|living room|car|bus|train|subway|garage|basement|attic|closet|shower|bathtub|pool|backyard|front yard|garden|apartment|condo|dorm|studio|room)\b/.test(w)) {
      prep = 'in';
    } else if (/^(my |the )?[a-z]+ (room|office|space|area|place|spot|corner|studio)\b/.test(w)) {
      prep = 'in';
    } else if (/^(my |the )?(gym|office|school|park|beach|library|store|church|hospital|home|house|work|desk|table|counter|lab|shop|cafe|restaurant|hotel|airport|station)\b/.test(w)) {
      prep = 'at';
    } else if (/^(my |the )?(walk|run|commute|drive|ride|jog|hike|workout|morning|evening|night|afternoon|lunch|dinner|break)\b/.test(w)) {
      prep = 'on';
    } else if (/^(my |the )?[a-z]+ (walk|run|commute|drive|ride|jog|hike|session|trip|break|lunch|morning|evening|night|workout)\b/.test(w)) {
      prep = 'on';
    }
    statement += prep ? `, ${prep} ${where}` : `, ${where}`;
  }
  if (!statement.endsWith('.')) statement += '.';
  return statement;
}

async function scheduleTaskReminder(schedule: WhenPickerValue, taskLabel: string) {
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  let hour24 = schedule.hour;
  if (schedule.period === 'PM' && schedule.hour !== 12) hour24 += 12;
  if (schedule.period === 'AM' && schedule.hour === 12) hour24 = 0;

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
        hour: hour24,
        minute: schedule.minute,
        repeats: true,
      } as any,
    });
  }
}

interface DimensionPromptProps {
  dimension: Dimension;
  index: number;
  total: number;
  what: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
  onChangeWhat: (v: string) => void;
  onChangeWhen: (v: string) => void;
  onChangeWhere: (v: string) => void;
  onChangeSchedule: (v: WhenPickerValue | null) => void;
  onConfirm: (entry: InputEntry) => void;
}

function DimensionPrompt({ dimension, index, total, what, when, where, schedule, onChangeWhat, onChangeWhen, onChangeWhere, onChangeSchedule, onConfirm }: DimensionPromptProps) {
  const { colors, isDark } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);

  const preview = buildInputStatement({
    dimensionLabel: dimension.label,
    what,
    when,
    where,
    schedule,
  });

  const canConfirm = what.trim().length > 2;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ dimensionLabel: dimension.label, what, when, where, schedule });
  };

  const handlePickerConfirm = (value: WhenPickerValue) => {
    onChangeSchedule(value);
    onChangeWhen(formatScheduleText(value));
    setPickerVisible(false);

    if (value.reminder) {
      const taskText = what.trim() || dimension.label;
      scheduleTaskReminder(value, taskText);
    }
  };

  return (
    <View style={styles.promptContainer}>
      <View style={styles.promptHeader}>
        <Text style={[styles.promptCounter, { color: colors.textTertiary }]}>
          {index + 1} of {total}
        </Text>
        <Text style={[styles.promptDimensionLabel, { color: colors.primary }]}>
          {dimension.label}
        </Text>
      </View>

      <View style={[styles.identityQuote, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        borderColor: isDark ? '#2A2A2A' : '#E0E0E0',
      }]}>
        <Text style={[styles.identityQuoteText, { color: colors.text }]}>
          "{dimension.specific}"
        </Text>
      </View>

      <Text style={[styles.promptTitle, { color: colors.text }]}>
        What's the daily input{'\n'}that creates this?
      </Text>

      {preview ? (
        <View style={[styles.previewBox, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          borderColor: colors.primary + '40',
        }]}>
          <Text style={[styles.previewLabel, { color: colors.primary }]}>YOUR INPUT</Text>
          <Text style={[styles.previewText, { color: colors.text }]}>{preview}</Text>
        </View>
      ) : null}

      <View style={styles.fields}>
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Target size={14} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.fieldLabelText, { color: colors.textSecondary }]}>What will you do?</Text>
          </View>
          <TextInput
            style={[styles.fieldInput, {
              color: colors.text,
              backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245,245,245,0.8)',
              borderColor: what.trim() ? colors.primary + '60' : (isDark ? '#2A2A2A' : '#E0E0E0'),
            }]}
            value={what}
            onChangeText={onChangeWhat}
            placeholder="e.g. work out for 45 minutes"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Clock size={14} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.fieldLabelText, { color: colors.textSecondary }]}>When?</Text>
          </View>
          <TouchableOpacity
            style={[styles.fieldInput, styles.whenField, {
              backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245,245,245,0.8)',
              borderColor: schedule ? colors.primary + '60' : (isDark ? '#2A2A2A' : '#E0E0E0'),
            }]}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.8}
          >
            {schedule ? (
              <View style={styles.whenValueRow}>
                <View style={styles.whenValueContent}>
                  <Text style={[styles.whenTimeText, { color: colors.text }]}>
                    {schedule.hour}:{String(schedule.minute).padStart(2, '0')} {schedule.period}
                  </Text>
                  <Text style={[styles.whenDaysText, { color: colors.textSecondary }]}>
                    {formatDaysList(schedule.days)}
                  </Text>
                </View>
                {schedule.reminder && (
                  <View style={[styles.reminderBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Bell size={11} color={colors.primary} strokeWidth={2.5} />
                  </View>
                )}
              </View>
            ) : (
              <Text style={[styles.whenPlaceholder, { color: colors.textTertiary }]}>
                Tap to set time & days
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <WhenPickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onConfirm={handlePickerConfirm}
          initialValue={schedule ?? undefined}
        />

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <MapPin size={14} color={colors.primary} strokeWidth={2.5} />
            <Text style={[styles.fieldLabelText, { color: colors.textSecondary }]}>Where?</Text>
          </View>
          <TextInput
            style={[styles.fieldInput, {
              color: colors.text,
              backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245,245,245,0.8)',
              borderColor: where.trim() ? colors.primary + '60' : (isDark ? '#2A2A2A' : '#E0E0E0'),
            }]}
            value={where}
            onChangeText={onChangeWhere}
            placeholder="e.g. the gym on Main St"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
        onPress={handleConfirm}
        disabled={!canConfirm}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={canConfirm ? [colors.primary, colors.primaryDark] : [colors.backgroundSecondary, colors.backgroundTertiary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmBtnGradient}
        >
          <Text style={[styles.confirmBtnText, { color: canConfirm ? '#000000' : colors.textTertiary }]}>
            {index < total - 1 ? 'Next Input' : 'Done'}
          </Text>
          {index < total - 1
            ? <ChevronRight size={18} color={canConfirm ? '#000000' : colors.textTertiary} strokeWidth={2.5} />
            : <Check size={18} color={canConfirm ? '#000000' : colors.textTertiary} strokeWidth={2.5} />
          }
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}


interface FieldState {
  what: string;
  when: string;
  where: string;
  schedule: WhenPickerValue | null;
}

const DEFAULT_FIELD: FieldState = { what: '', when: '', where: '', schedule: null };

export default function TasksScreen({ dimensions, inputs, currentDimensionIndex, onConfirmEntry }: Props) {
  const [fieldData, setFieldData] = useState<Record<number, FieldState>>({});

  const current = fieldData[currentDimensionIndex] || DEFAULT_FIELD;

  const updateField = (field: keyof FieldState, value: any) => {
    setFieldData(prev => ({
      ...prev,
      [currentDimensionIndex]: { ...(prev[currentDimensionIndex] || DEFAULT_FIELD), [field]: value },
    }));
  };

  const handleConfirm = (entry: InputEntry) => {
    const statement = buildInputStatement(entry);
    const isLast = currentDimensionIndex >= dimensions.length - 1;
    onConfirmEntry(statement, isLast, {
      what: entry.what,
      when_time: entry.when,
      where_location: entry.where,
      schedule: entry.schedule ?? null,
    });
  };

  const currentDim = dimensions[currentDimensionIndex];
  if (!currentDim) return null;

  return (
    <DimensionPrompt
      key={currentDimensionIndex}
      dimension={currentDim}
      index={currentDimensionIndex}
      total={dimensions.length}
      what={current.what}
      when={current.when}
      where={current.where}
      schedule={current.schedule}
      onChangeWhat={(v) => updateField('what', v)}
      onChangeWhen={(v) => updateField('when', v)}
      onChangeWhere={(v) => updateField('where', v)}
      onChangeSchedule={(v) => updateField('schedule', v)}
      onConfirm={handleConfirm}
    />
  );
}

const styles = StyleSheet.create({
  promptContainer: {
    flex: 1,
    gap: 20,
  },
  promptHeader: {
    gap: 4,
  },
  promptCounter: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  promptDimensionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  identityQuote: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  identityQuoteText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    fontStyle: 'italic',
  },
  promptTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  fields: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  whenField: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whenValueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whenValueContent: {
    flex: 1,
    gap: 2,
  },
  whenTimeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  whenDaysText: {
    fontSize: 12,
    fontWeight: '600',
  },
  whenPlaceholder: {
    fontSize: 15,
    fontWeight: '500',
  },
  reminderBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  previewBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  previewText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  confirmBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  summaryContainer: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  summarySubtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 20,
  },
  inputList: {
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  inputNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  inputNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
