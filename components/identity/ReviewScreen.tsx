import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  Check,
  Pencil,
  Lock,
  Plus,
  Briefcase,
  Dumbbell,
  Heart,
  Star,
  Zap,
  Target,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Dimension, ADDITIONAL_DIMENSIONS } from './types';

const ICON_MAP: Record<string, any> = {
  Briefcase,
  Dumbbell,
  Heart,
  Star,
  Zap,
  Target,
};

interface Props {
  identityStatement: string;
  currentDimensions: Dimension[];
  onEditStatement: (newStatement: string) => void;
  onAddDimension: (category: string) => void;
}

export default function ReviewScreen({ identityStatement, currentDimensions, onEditStatement, onAddDimension }: Props) {
  const { colors, isDark } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(identityStatement);
  const inputRef = useRef<TextInput>(null);

  const existingCategories = currentDimensions.map(d => d.category);
  const availableDimensions = ADDITIONAL_DIMENSIONS.filter(
    d => !existingCategories.includes(d.category)
  );

  useEffect(() => {
    setEditText(identityStatement);
  }, [identityStatement]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [editing]);

  const handleStartEdit = () => {
    setEditText(identityStatement);
    setEditing(true);
  };

  const handleLockIn = () => {
    const trimmed = editText.trim();
    if (trimmed.length > 3) {
      onEditStatement(trimmed);
    }
    setEditing(false);
  };

  const sentences = identityStatement
    .split(/\.\s*/)
    .filter(s => s.trim().length > 0)
    .map(s => s.trim().endsWith('.') ? s.trim() : s.trim() + '.');

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        This Is Who{'\n'}You're Becoming
      </Text>

      {!editing ? (
        <View style={[styles.identityCard, { borderColor: colors.primary }]}>
          <View style={styles.identityInner}>
            {sentences.map((sentence, i) => (
              <Text key={i} style={[styles.identitySentence, { color: colors.text }]}>
                {sentence}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.editCard, { borderColor: colors.primary }]}>
          <View style={styles.editInner}>
            <TextInput
              ref={inputRef}
              style={[styles.editInput, { color: colors.text }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              selectionColor={colors.primary}
            />
            <TouchableOpacity
              style={[styles.lockButton, { backgroundColor: colors.primary }]}
              onPress={handleLockIn}
              activeOpacity={0.8}
            >
              <Lock size={16} color="#000000" strokeWidth={2.5} />
              <Text style={styles.lockButtonText}>Lock it in</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!editing && (
        <TouchableOpacity style={styles.editLink} onPress={handleStartEdit}>
          <Pencil size={14} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.editLinkText, { color: colors.primary }]}>Edit my identity</Text>
        </TouchableOpacity>
      )}

      <View style={styles.whySection}>
        {[
          { text: 'Clear and specific' },
          { text: 'Identity-focused (not "I want to")' },
          { text: 'Measurable and concrete' },
          { text: 'Concise (easy to remember)' },
        ].map((item, i) => (
          <View key={i} style={styles.whyRow}>
            <View style={[styles.checkBadge, { backgroundColor: colors.primary + '20' }]}>
              <Check size={14} color={colors.primary} strokeWidth={3} />
            </View>
            <Text style={[styles.whyText, { color: colors.textSecondary }]}>{item.text}</Text>
          </View>
        ))}
      </View>

      {availableDimensions.length > 0 && (
        <View style={styles.addMoreSection}>
          <View style={[styles.divider, { backgroundColor: isDark ? colors.border : '#E0E0E0' }]} />
          <Text style={[styles.addMoreLabel, { color: colors.textSecondary }]}>
            Want to add other parts of your life?
          </Text>
          <View style={styles.dimensionList}>
            {availableDimensions.map((dim) => {
              const Icon = ICON_MAP[dim.icon] || Target;
              return (
                <TouchableOpacity
                  key={dim.category}
                  style={[styles.dimensionCard, {
                    backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)',
                    borderColor: isDark ? colors.border : '#E0E0E0',
                  }]}
                  onPress={() => onAddDimension(dim.category)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dimIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Icon size={20} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <View style={styles.dimText}>
                    <Text style={[styles.dimTitle, { color: colors.text }]}>{dim.label}</Text>
                    <Text style={[styles.dimPrompt, { color: colors.textTertiary }]}>{dim.prompt}</Text>
                  </View>
                  <Plus size={18} color={colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  identityCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  identityInner: {
    padding: 28,
    gap: 12,
  },
  identitySentence: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 30,
  },
  editCard: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  editInner: {
    padding: 20,
    gap: 16,
  },
  editInput: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
    minHeight: 120,
    textAlignVertical: 'top',
    outlineStyle: 'none',
    borderWidth: 0,
    padding: 0,
  } as any,
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  lockButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 24,
  },
  editLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  whySection: {
    gap: 12,
    marginBottom: 24,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  addMoreSection: {
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  addMoreLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 22,
  },
  dimensionList: {
    gap: 10,
  },
  dimensionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  dimIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimText: {
    flex: 1,
  },
  dimTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  dimPrompt: {
    fontSize: 13,
    fontWeight: '500',
  },
});
