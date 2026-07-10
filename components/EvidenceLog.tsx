import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Sparkles, Send, Pencil } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { EvidenceLog as EvidenceLogType } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';

interface EvidenceLogProps {
  goalId: string;
  date: string;
  readOnly?: boolean;
  challengeDay?: number;
  onLockedInteraction?: () => void;
}

export default function EvidenceLogSection({ goalId, date, readOnly = false, challengeDay, onLockedInteraction }: EvidenceLogProps) {
  const { colors, isDark } = useTheme();
  const [log, setLog] = useState<EvidenceLogType | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadLog();
  }, [goalId, date]);

  const loadLog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('evidence_logs')
        .select('*')
        .eq('goal_id', goalId)
        .eq('completion_date', date)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLog(data);
        setContent(data.content);
      } else {
        setLog(null);
        setContent('');
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error loading evidence log:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLog = async () => {
    if (onLockedInteraction) { onLockedInteraction(); return; }
    if (!content.trim()) return;

    setSaving(true);
    try {
      if (log) {
        const { error } = await supabase
          .from('evidence_logs')
          .update({ content: content.trim(), updated_at: new Date().toISOString() })
          .eq('id', log.id);

        if (error) throw error;
        setLog({ ...log, content: content.trim() });
      } else {
        const { data, error } = await supabase
          .from('evidence_logs')
          .insert({
            goal_id: goalId,
            completion_date: date,
            content: content.trim(),
          })
          .select()
          .single();

        if (error) throw error;
        setLog(data);
      }
      setIsEditing(false);
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error saving evidence log:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const hasContent = log && log.content.trim().length > 0;
  const showInput = !readOnly && (isEditing || !hasContent);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles size={18} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.title, { color: colors.text }]}>Evidence Log</Text>
        </View>
        {challengeDay && (
          <Text style={[styles.dayLabel, { color: colors.textTertiary }]}>Day {challengeDay}</Text>
        )}
      </View>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Notice a micro-win today? Write it down.
      </Text>

      {showInput ? (
        <View style={styles.inputSection}>
          <View style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
            },
          ]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.text }]}
              placeholder={'"I noticed something different today..."'}
              placeholderTextColor={colors.textTertiary}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              autoFocus={isEditing}
            />
          </View>
          <View style={styles.inputActions}>
            {hasContent && (
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setContent(log?.content || '');
                  setIsEditing(false);
                  Keyboard.dismiss();
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                (!content.trim() || saving) && styles.saveButtonDisabled,
              ]}
              onPress={saveLog}
              disabled={!content.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Send size={16} color="#000000" strokeWidth={2.5} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : hasContent ? (
        <TouchableOpacity
          style={[
            styles.logCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(189,253,0,0.15)' : colors.border,
            },
          ]}
          onPress={readOnly ? undefined : () => { if (onLockedInteraction) { onLockedInteraction(); return; } setIsEditing(true); }}
          activeOpacity={readOnly ? 1 : 0.7}
          disabled={readOnly}
        >
          <Text style={[styles.logContent, { color: isDark ? 'rgba(255,255,255,0.9)' : colors.text }]}>
            "{log!.content}"
          </Text>
          {!readOnly && (
            <View style={styles.editHint}>
              <Pencil size={14} color={colors.textTertiary} strokeWidth={2} />
              <Text style={[styles.editHintText, { color: colors.textTertiary }]}>Tap to edit</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : readOnly ? (
        <View style={[
          styles.emptyState,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' },
        ]}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No entry for this day</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputSection: {
    gap: 12,
  },
  inputContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    padding: 16,
    minHeight: 100,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  logCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  logContent: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  editHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
