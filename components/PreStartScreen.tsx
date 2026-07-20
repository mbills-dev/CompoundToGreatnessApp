import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Plus, Zap } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Goal, DailyActivity } from '@/types/database';
import { parseLocalDate } from '@/lib/dateHelpers';
import { resyncAllReminders } from '@/lib/notifications';

const LIME = '#CCFF00';

interface PreStartScreenProps {
  goal: Goal;
  activities: DailyActivity[];
  onStartNow: () => void;
  onChangeDate: () => void;
  onActivitiesChanged: () => void;
}

type EditRow = { id: string | null; name: string; isNew: boolean };

export default function PreStartScreen({
  goal,
  activities,
  onStartNow,
  onChangeDate,
  onActivitiesChanged,
}: PreStartScreenProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [editMode, setEditMode] = useState(false);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);

  const startDate = parseLocalDate(goal.scheduled_start_date!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.round(
    (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const countdownLabel =
    daysUntil === 1 ? 'DAY 1 STARTS TOMORROW' : `DAY 1 IN ${daysUntil} DAYS`;
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const cardBg = isDark ? colors.backgroundSecondary : '#1A1A1A';
  const cardBorder = isDark ? colors.border : '#1A1A1A';
  const rowBg = isDark ? '#111111' : '#0A0A0A';
  const muted = 'rgba(255,255,255,0.5)';

  const orderedActivities = [...activities].sort(
    (a, b) => a.order_position - b.order_position
  );

  const enterEdit = () => {
    setEditRows(
      activities.map((a) => ({ id: a.id, name: a.activity_name, isNew: false }))
    );
    setEditMode(true);
  };

  const updateRowName = (index: number, name: string) => {
    setEditRows((prev) => prev.map((r, i) => (i === index ? { ...r, name } : r)));
  };

  const deleteRow = (index: number) => {
    setEditRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setEditRows((prev) => [...prev, { id: null, name: '', isNew: true }]);
  };

  const saveEdits = async () => {
    setSaving(true);
    try {
      const kept = editRows
        .map((r) => ({ ...r, name: r.name.trim() }))
        .filter((r) => r.name.length > 0);

      const keptIds = kept.filter((r) => r.id).map((r) => r.id as string);
      const removed = activities.filter((a) => !keptIds.includes(a.id));
      for (const a of removed) {
        const { error } = await supabase
          .from('daily_activities')
          .delete()
          .eq('id', a.id);
        if (error) throw error;
      }

      for (let i = 0; i < kept.length; i++) {
        const r = kept[i];
        const order_position = i + 1;
        if (r.id) {
          const { error } = await supabase
            .from('daily_activities')
            .update({ activity_name: r.name, order_position })
            .eq('id', r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('daily_activities').insert({
            goal_id: goal.id,
            activity_name: r.name,
            activity_type: 'custom',
            target_count: 1,
            order_position,
          });
          if (error) throw error;
        }
      }

      setEditMode(false);
      onActivitiesChanged();
      if (goal.user_id) await resyncAllReminders(goal.user_id);
    } catch (e) {
      console.error('PreStartScreen saveEdits failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={
            isDark
              ? ['#000000', '#111111', '#000000']
              : ['#F5F5F0', '#F0F0EB', '#F5F5F0']
          }
          style={styles.gradient}
        >
          <View style={styles.heroSection}>
            <View
              style={[
                styles.heroBadge,
                { backgroundColor: isDark ? 'rgba(204,255,0,0.12)' : '#1A1A1A' },
              ]}
            >
              <Zap size={16} color={LIME} strokeWidth={2.5} fill={LIME} />
              <Text style={styles.heroBadgeText}>COUNTDOWN</Text>
            </View>
            <Text style={[styles.countdownText, { color: colors.text }]}>
              {countdownLabel}
            </Text>
            <Text style={[styles.formattedDate, { color: colors.textSecondary }]}>
              {formattedDate}
            </Text>
          </View>

          {goal.identity_statement && (
            <View
              style={[
                styles.identityChip,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
            >
              <Text style={styles.identityChipLabel}>MY IDENTITY</Text>
              <Text style={styles.identityChipText} numberOfLines={6}>
                {goal.identity_statement}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.stackCard,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>YOUR DAILY INPUTS</Text>
                <Text style={[styles.sectionSubtitle, { color: muted }]}>
                  preview your success stack
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.editButton,
                  { backgroundColor: isDark ? '#1A1A1A' : '#0A0A0A' },
                  editMode && styles.editButtonActive,
                ]}
                onPress={() => {
                  if (editMode) {
                    saveEdits();
                  } else {
                    enterEdit();
                  }
                }}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text
                    style={[
                      styles.editButtonText,
                      editMode && styles.editButtonTextActive,
                    ]}
                  >
                    {editMode ? 'DONE' : 'EDIT'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {!editMode && (
              <View style={styles.rowsList}>
                {orderedActivities.length === 0 && (
                  <Text style={[styles.emptyText, { color: muted }]}>
                    No inputs yet. Tap EDIT to add your daily actions.
                  </Text>
                )}
                {orderedActivities.map((a) => (
                  <View
                    key={a.id}
                    style={[styles.previewRow, { backgroundColor: rowBg }]}
                  >
                    <Text style={styles.previewRowText} numberOfLines={2}>
                      {a.activity_name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {editMode && (
              <View style={styles.rowsList}>
                {editRows.map((row, index) => (
                  <View
                    key={row.id ?? `new-${index}`}
                    style={[styles.editRow, { backgroundColor: rowBg }]}
                  >
                    <TextInput
                      style={styles.editInput}
                      value={row.name}
                      onChangeText={(t) => updateRowName(index, t)}
                      placeholder="Name this input"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteRow(index)}
                    >
                      <View style={styles.deleteButtonInner}>
                        <X size={12} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addRow} onPress={addRow}>
                  <Plus size={18} color={LIME} strokeWidth={2.5} />
                  <Text style={styles.addRowText}>Add input</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.startNowButton}
            onPress={onStartNow}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[LIME, '#aed900']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startNowGradient}
            >
              <Text style={styles.startNowText}>START NOW INSTEAD</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeDateButton}
            onPress={onChangeDate}
            activeOpacity={0.6}
          >
            <Text style={[styles.changeDateText, { color: colors.textSecondary }]}>
              Change my start date
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { minHeight: '100%', paddingHorizontal: 24 },
  heroSection: { paddingVertical: 32, alignItems: 'center', gap: 12 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: LIME,
  },
  countdownText: {
    fontFamily: 'Inter-Black',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 46,
  },
  formattedDate: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  identityChip: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 4,
  },
  identityChipLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: LIME,
  },
  identityChipText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  stackCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 24,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
  },
  sectionHeaderLeft: { flex: 1 },
  sectionTitle: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    fontWeight: '700',
  },
  editButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  editButtonActive: { backgroundColor: LIME, borderColor: LIME },
  editButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 1,
  },
  editButtonTextActive: { color: '#1A1A1A' },
  rowsList: { gap: 12 },
  emptyText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  previewRow: {
    borderRadius: 16,
    padding: 20,
    minHeight: 64,
    justifyContent: 'center',
  },
  previewRowText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    minHeight: 64,
    gap: 12,
  },
  editInput: {
    flex: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    padding: 0,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(204,255,0,0.3)',
  },
  addRowText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    fontWeight: '700',
    color: LIME,
  },
  startNowButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  startNowGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  startNowText: {
    fontFamily: 'Inter-Black',
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  changeDateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  changeDateText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    fontWeight: '700',
  },
});
