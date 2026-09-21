import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  StyleSheet,
  InteractionManager,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, Zap, Image as ImageIcon, RotateCw, Plus, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { logEdgeFunctionCall } from '@/lib/edgeFunctionLogger';
import { FlowGoal, DecodePath } from './types';
import { GoalBadge, formatGoalLabel } from './AnchorScreens';
import { OverlapGroup, fetchOverlappingGoals, OverlapBanner, MergeEditor, VagueFlag, fetchVagueGoals, VagueGoalBanner, GoalCountNudge, TrimModal } from './AiDailyInputsScreen';
import styles from './styles';
import KeyboardStepWrapper, { KEYBOARD_DONE_ACCESSORY_ID } from './KeyboardStepWrapper';
import { useInputSpecificity, SpecificityNudgeBanner, logInputFeedback, InputSource } from './InputValidation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIGIT_COMMA_PLACEHOLDER = '\x00DC\x00';

let _goalIdSeq = 100;

function normalizeMoneyInLabel(label: string): string {
  const hasMoneyContext =
    /\$|earn|make|revenue|income|profit|save|salary|sales/i.test(label);
  if (!hasMoneyContext) return label;
  return label.replace(
    /(\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*([kKmM])\b/g,
    (_, _dollar, num, suf) => `$${num}${suf.toUpperCase()}`,
  );
}

export function parseGoalsFromText(text: string): FlowGoal[] {
  const protected_ = text.replace(/(\d),(\d)/g, `$1${DIGIT_COMMA_PLACEHOLDER}$2`);
  const parts = protected_
    .split(',')
    .map(s => s.trim().replace(new RegExp(DIGIT_COMMA_PLACEHOLDER, 'g'), ','))
    .filter(s => s.length > 0);
  if (parts.length === 0) return [];
  return parts.map(rawLabel => ({
    id: _goalIdSeq++,
    label: normalizeMoneyInLabel(rawLabel),
    category: 'General',
    deadline: 'ongoing',
    defaultPath: 'starting' as DecodePath,
  }));
}

function goalHasNumber(s: string): boolean {
  return /\d/.test(s) || /\b(lbs?|steps?|hrs?|hours?|minutes?|min|miles?|km)\b/i.test(s);
}

// ─── Spark pool ───────────────────────────────────────────────────────────────

type SparkCategory = 'Health' | 'Money' | 'Career' | 'Growth' | 'Relationships' | 'Faith' | 'Lifestyle';

interface SparkGoal {
  text: string;
  category: SparkCategory;
}

const SPARK_POOL: SparkGoal[] = [
  { text: 'Lose 20 lbs', category: 'Health' },
  { text: 'Make $10K/month', category: 'Money' },
  { text: 'Read 12 books', category: 'Growth' },
  { text: 'Run a 5K', category: 'Health' },
  { text: 'Speak conversational French', category: 'Growth' },
  { text: 'Grow closer to God', category: 'Faith' },
  { text: 'Save $10,000', category: 'Money' },
  { text: 'Write a book', category: 'Growth' },
  { text: 'Pay off $20K in debt', category: 'Money' },
  { text: 'Build 10 lbs of muscle', category: 'Health' },
  { text: 'Walk 10,000 steps/day', category: 'Health' },
  { text: 'Exercise 4x/week', category: 'Health' },
  { text: 'Get 8 hours of sleep', category: 'Health' },
  { text: 'Cut out added sugar', category: 'Health' },
  { text: 'Track my macros every day', category: 'Health' },
  { text: 'Drink 100 oz of water/day', category: 'Health' },
  { text: 'Start a business', category: 'Career' },
  { text: 'Get promoted', category: 'Career' },
  { text: 'Land a new job', category: 'Career' },
  { text: 'Grow my business to $1M', category: 'Career' },
  { text: 'Build a 6-month emergency fund', category: 'Money' },
  { text: 'Read the Bible every day', category: 'Faith' },
  { text: 'Pray every morning', category: 'Faith' },
  { text: 'Journal every day', category: 'Growth' },
  { text: 'Wake up at 5:30 AM', category: 'Lifestyle' },
  { text: 'Reduce screen time', category: 'Lifestyle' },
  { text: 'Declutter my house', category: 'Lifestyle' },
  { text: 'Travel to 3 new places', category: 'Lifestyle' },
  { text: 'Learn a new skill', category: 'Growth' },
  { text: 'Strengthen my marriage', category: 'Relationships' },
  { text: 'Spend more quality time with my kids', category: 'Relationships' },
];

const SPARK_CATEGORIES: ('All' | SparkCategory)[] = ['All', 'Health', 'Money', 'Career', 'Growth', 'Relationships', 'Faith', 'Lifestyle'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeGoal(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ─── GoalsEntryScreen ─────────────────────────────────────────────────────────

export function GoalsEntryScreen({ onContinue, onBack }: { onContinue: (goals: FlowGoal[], isAiSourced?: boolean) => void; onBack: () => void }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [goals, setGoals] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showSparkSheet, setShowSparkSheet] = useState(false);
  const [sparkFilter, setSparkFilter] = useState<'All' | SparkCategory>('All');
  const inputRef = useRef<TextInput>(null);
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const usedNormalized = useMemo(() => new Set(goals.map(normalizeGoal)), [goals]);

  const visibleSparks = useMemo(() => {
    return SPARK_POOL.filter(s => !usedNormalized.has(normalizeGoal(s.text))).slice(0, 6);
  }, [usedNormalized]);

  const canContinue = goals.length > 0 || draft.trim().length > 0;

  const addGoal = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const norm = normalizeGoal(trimmed);
    if (usedNormalized.has(norm)) return;
    setGoals(prev => [...prev, trimmed]);
  };

  const removeGoal = (idx: number) => {
    setGoals(prev => prev.filter((_, i) => i !== idx));
  };

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const parts = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
    parts.forEach(p => {
      const norm = normalizeGoal(p);
      setGoals(prev => {
        if (prev.map(normalizeGoal).includes(norm)) return prev;
        return [...prev, p];
      });
    });
    setDraft('');
  };

  const handleDraftChange = (text: string) => {
    if (text.includes(',')) {
      const parts = text.split(',');
      const completed = parts.slice(0, -1).map(s => s.trim()).filter(s => s.length > 0);
      completed.forEach(p => {
        const norm = normalizeGoal(p);
        setGoals(prev => {
          if (prev.map(normalizeGoal).includes(norm)) return prev;
          return [...prev, p];
        });
      });
      setDraft(parts[parts.length - 1]);
    } else {
      setDraft(text);
    }
  };

  const handleDraftSubmit = () => {
    commitDraft();
    Keyboard.dismiss();
  };

  const handleSparkTap = (sparkText: string) => {
    addGoal(sparkText);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    let finalGoals = [...goals];
    const draftTrimmed = draft.trim();
    if (draftTrimmed) {
      const draftNorm = normalizeGoal(draftTrimmed);
      if (!finalGoals.map(normalizeGoal).includes(draftNorm)) {
        finalGoals.push(draftTrimmed);
      }
    }
    if (finalGoals.length === 0) return;
    const serialized = finalGoals.join(', ');
    onContinue(parseGoalsFromText(serialized));
  };

  const uploadAndExtract = async (uri: string) => {
    setPhotoError(null);
    setPhotoLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = uri.split('.').pop() ?? 'jpg';
      const fileName = `goal-photo-${Date.now()}.${ext}`;
      const path = `${user.id}/${fileName}`;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from('goal-photos')
        .upload(path, arrayBuffer, { contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from('goal-photos')
        .createSignedUrl(path, 300);

      if (signedError || !signedData?.signedUrl) {
        throw signedError ?? new Error('Failed to generate signed URL');
      }

      logEdgeFunctionCall('extract-goals-from-photo');
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/extract-goals-from-photo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ imageUrl: signedData.signedUrl }),
        },
      );

      if (!response.ok) throw new Error('Extraction failed');
      const result = await response.json();

      if (result.success && Array.isArray(result.goals) && result.goals.length > 0) {
        const extracted: string[] = result.goals.map((rawLabel: string) => normalizeMoneyInLabel(rawLabel));
        setGoals(prev => {
          const existing = new Set(prev.map(normalizeGoal));
          const fresh = extracted.filter(g => !existing.has(normalizeGoal(g)));
          return [...prev, ...fresh];
        });
        return;
      }

      setPhotoError("Couldn't find goals in that photo — try another or type them in");
    } catch {
      setPhotoError("Couldn't find goals in that photo — try another or type them in");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePickFromLibrary = async () => {
    setPhotoError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndExtract(result.assets[0].uri);
  };

  const handleTakePhoto = async () => {
    setPhotoError(null);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndExtract(result.assets[0].uri);
  };

  const handleUploadPhoto = () => {
    if (Platform.OS === 'web') {
      handlePickFromLibrary();
      return;
    }
    Alert.alert(
      'Add a photo',
      'Take a photo of your goals or pick one from your library.',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const goalCount = goals.length;
  const sparkHelperCopy = goalCount >= 5
    ? "You can add more — or continue when you're ready."
    : 'Tap a goal to add it to your list.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={fadeStyle}>
            <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 12 }]}>
              <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
            </TouchableOpacity>

            <Text style={[geStyles.headline, { color: colors.text }]}>
              {'WHAT DO YOU\nWANT\nTO '}
              <Text style={{ color: colors.primary }}>ACHIEVE?</Text>
            </Text>
            <Text style={[geStyles.subhead, { color: colors.textSecondary }]}>
              Start where you are. We'll help you make it actionable.
            </Text>

            <Text style={[geStyles.sectionLabel, { color: colors.textSecondary }]}>
              YOUR GOALS
            </Text>

            <View style={[
              geStyles.composer,
              {
                borderColor: goals.length > 0 || draft.trim() ? colors.primary + '50' : '#2A2A2A',
                backgroundColor: '#0F0F0F',
              },
            ]}>
              <View style={geStyles.pillWrap}>
                {goals.map((g, i) => (
                  <View key={i} style={geStyles.pill}>
                    <Text style={geStyles.pillText}>{g}</Text>
                    <TouchableOpacity
                      onPress={() => removeGoal(i)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      activeOpacity={0.6}
                    >
                      <X size={13} color="#888" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TextInput
                  ref={inputRef}
                  style={[geStyles.draftInput, { color: colors.text }]}
                  value={draft}
                  onChangeText={handleDraftChange}
                  placeholder={goals.length === 0 ? 'e.g. Lose 20 lbs, make $10K/month, read 12 books' : 'Add another goal...'}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  autoCapitalize="sentences"
                  onSubmitEditing={handleDraftSubmit}
                  inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                />
              </View>
            </View>

            {goalCount > 0 && (
              <View style={geStyles.recognizedRow}>
                <Check size={12} color={colors.primary} strokeWidth={3} />
                <Text style={[geStyles.recognizedText, { color: colors.textSecondary }]}>
                  {goalCount} goal{goalCount !== 1 ? 's' : ''} recognized
                </Text>
              </View>
            )}

            <Text style={[geStyles.helperCopy, { color: colors.textTertiary }]}>
              {goalCount > 0 ? 'Have more than one? Add a comma, press return, or choose a suggestion below.' : ''}
            </Text>

            <View style={geStyles.sparkSection}>
              <View style={geStyles.sparkHeader}>
                <Text style={[geStyles.sparkHeading, { color: colors.text }]}>
                  NEED A SPARK?
                </Text>
                <TouchableOpacity onPress={() => setShowSparkSheet(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[geStyles.sparkMoreLink, { color: colors.primary }]}>
                    SEE MORE →
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[geStyles.sparkHelper, { color: colors.textSecondary }]}>
                {sparkHelperCopy}
              </Text>
              <View style={geStyles.sparkGrid}>
                {visibleSparks.map((spark, i) => {
                  const isLong = spark.text.length > 24;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[geStyles.sparkChip, isLong && geStyles.sparkChipFull]}
                      onPress={() => handleSparkTap(spark.text)}
                      activeOpacity={0.7}
                    >
                      <Text style={[geStyles.sparkChipText, { color: colors.text }]} numberOfLines={1}>{spark.text}</Text>
                      <Plus size={13} color={colors.primary} strokeWidth={2.5} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[geStyles.photoRow, { opacity: photoLoading ? 0.6 : 1 }]}
              onPress={handleUploadPhoto}
              activeOpacity={0.8}
              disabled={photoLoading}
            >
              {photoLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <ImageIcon size={16} color={colors.primary} strokeWidth={2.5} />
                  <View style={geStyles.photoRowText}>
                    <Text style={[geStyles.photoRowTitle, { color: colors.text }]}>
                      Have your goals written down?
                    </Text>
                    <Text style={[geStyles.photoRowSub, { color: colors.textTertiary }]}>
                      We'll pull them in automatically.
                    </Text>
                  </View>
                  <Text style={[geStyles.photoRowLink, { color: colors.primary }]}>
                    Upload →
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {photoError && (
              <View style={[geStyles.errorCard, { borderColor: 'rgba(255,68,0,0.3)' }]}>
                <Text style={geStyles.errorText}>{photoError}</Text>
                <TouchableOpacity style={geStyles.retryBtn} onPress={handleUploadPhoto} activeOpacity={0.7}>
                  <RotateCw size={13} color={colors.primary} strokeWidth={2.5} />
                  <Text style={[geStyles.retryText, { color: colors.primary }]}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={geStyles.bottomBar}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: canContinue ? colors.primary : colors.border, opacity: canContinue ? 1 : 0.45 }]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canContinue}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showSparkSheet && (
        <SparkSheet
          filter={sparkFilter}
          onFilterChange={setSparkFilter}
          onAdd={(text) => { addGoal(text); }}
          usedNormalized={usedNormalized}
          onClose={() => setShowSparkSheet(false)}
        />
      )}
    </View>
  );
}

// ─── Spark sheet ──────────────────────────────────────────────────────────────

function SparkSheet({
  filter,
  onFilterChange,
  onAdd,
  usedNormalized,
  onClose,
}: {
  filter: 'All' | SparkCategory;
  onFilterChange: (f: 'All' | SparkCategory) => void;
  onAdd: (text: string) => void;
  usedNormalized: Set<string>;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  const allInCategory = useMemo(() => {
    return filter === 'All' ? SPARK_POOL : SPARK_POOL.filter(s => s.category === filter);
  }, [filter]);

  return (
    <View style={geStyles.sheetOverlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <View style={[geStyles.sheetCard, { backgroundColor: '#0A0A0A', borderColor: '#222' }]}>
        <View style={geStyles.sheetHeader}>
          <TouchableOpacity onPress={onClose} style={geStyles.sheetCloseBtn} activeOpacity={0.6}>
            <X size={20} color="#888" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[geStyles.sheetTitle, { color: colors.text }]}>NEED A SPARK?</Text>
          <View style={geStyles.sheetCloseBtn} />
        </View>
        <Text style={[geStyles.sheetSubtitle, { color: colors.textSecondary }]}>
          Choose anything you'd like to achieve.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={geStyles.sheetFilters}>
          {SPARK_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                geStyles.sheetFilterChip,
                {
                  backgroundColor: filter === cat ? colors.primary : 'transparent',
                  borderColor: filter === cat ? colors.primary : '#333',
                },
              ]}
              onPress={() => onFilterChange(cat)}
              activeOpacity={0.7}
            >
              <Text style={[
                geStyles.sheetFilterText,
                { color: filter === cat ? '#000' : colors.textSecondary },
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={geStyles.sheetScroll} showsVerticalScrollIndicator={false}>
          {allInCategory.map((spark, i) => {
            const isAdded = usedNormalized.has(normalizeGoal(spark.text));
            return (
              <View key={i} style={[geStyles.sheetItem, { borderColor: isAdded ? colors.primary + '30' : '#222' }]}>
                <Text style={[geStyles.sheetItemText, { color: isAdded ? colors.textTertiary : colors.text }]}>
                  {spark.text}
                </Text>
                {isAdded ? (
                  <View style={geStyles.sheetAddedTag}>
                    <Check size={13} color={colors.primary} strokeWidth={3} />
                    <Text style={[geStyles.sheetAddedText, { color: colors.primary }]}>Added</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => onAdd(spark.text)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}>
                    <Plus size={16} color={colors.primary} strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── GoalsEntry styles ────────────────────────────────────────────────────────

const geStyles = StyleSheet.create({
  headline: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 40,
    marginBottom: 8,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  composer: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 76,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  draftInput: {
    fontSize: 15,
    fontWeight: '500',
    minWidth: 100,
    flex: 1,
    paddingVertical: 6,
  },
  recognizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  recognizedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helperCopy: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 4,
    minHeight: 17,
  },
  sparkSection: {
    marginTop: 20,
  },
  sparkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sparkHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sparkMoreLink: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sparkHelper: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 10,
  },
  sparkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sparkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#111111',
    width: '48%',
  },
  sparkChipFull: {
    width: '100%',
  },
  sparkChipText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    backgroundColor: '#0D0D0D',
    minHeight: 64,
  },
  photoRowText: {
    flex: 1,
    gap: 1,
  },
  photoRowTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoRowSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  photoRowLink: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    marginTop: 10,
    backgroundColor: 'rgba(255,68,0,0.06)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: '#FF4400',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  // Spark sheet
  sheetOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    height: '72%',
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sheetFilters: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    maxHeight: 44,
  },
  sheetFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  sheetFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetScroll: {
    paddingHorizontal: 20,
    flex: 1,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    backgroundColor: '#111111',
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  sheetAddedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  sheetAddedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetEmpty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 24,
  },
});

// ─── GoalFuelRedirectScreen ───────────────────────────────────────────────────

export function GoalFuelRedirectScreen({
  practiceText,
  goalLabel,
  initialText,
  onSkipAsStandard,
  onContinue,
  onBack,
  onStateChange,
}: {
  practiceText: string;
  goalLabel: string;
  initialText?: string;
  onSkipAsStandard: (actionText: string) => void;
  onContinue: (redirectText: string) => void;
  onBack: () => void;
  onStateChange: (text: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const [actionText, setActionText] = useState(practiceText);
  const [fuelText, setFuelText] = useState(initialText ?? '');
  const [showFuelMode, setShowFuelMode] = useState(false);
  const specificity = useInputSpecificity();
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const canLock = actionText.trim().length > 0;
  const canFuel = fuelText.trim().length > 0;

  return (
    <KeyboardStepWrapper contentContainerStyle={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 16 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.heroTitle, { color: colors.text, fontSize: 32, marginBottom: 8 }]}>
            {'This '}
            <Text style={{ color: colors.primary, fontStyle: 'italic' }}>is</Text>
            {' the\ndaily action.'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
            Edit it if needed, then lock it in.
          </Text>

          <TextInput
            style={[
              styles.doneLooksInput,
              {
                color: colors.text,
                borderColor: actionText.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={actionText}
            onChangeText={setActionText}
            multiline
            returnKeyType="done"
            blurOnSubmit={true}
            autoCapitalize="sentences"
            textAlignVertical="top"
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            onBlur={() => specificity.validate(actionText)}
          />

          {specificity.result && !showFuelMode && (
            <SpecificityNudgeBanner
              result={specificity.result}
              onAcceptExample={(ex) => { setActionText(ex); specificity.dismiss(); }}
              onDismiss={specificity.dismiss}
            />
          )}

          {showFuelMode && (
            <View style={{ marginTop: 20 }}>
              <View style={[styles.fuelRedirectCard, { backgroundColor: isDark ? colors.backgroundSecondary : '#F5F5F5', borderColor: colors.border }]}>
                <Text style={[styles.fuelRedirectIf, { color: colors.textTertiary }]}>
                  That's fuel. What's it fuel for?
                </Text>
                <Text style={[styles.fuelRedirectAction, { color: colors.text }]}>
                  {actionText.trim().length >= 3 ? (
                    <>
                      {'If I '}
                      <Text style={{ color: colors.primary }}>"{actionText.trim()}"</Text>
                      {' every day, it would get me...'}
                    </>
                  ) : (
                    'If I do this every day, it would get me...'
                  )}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.goalsEntryInput,
                  {
                    marginTop: 16,
                    color: colors.text,
                    borderColor: fuelText.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  },
                ]}
                value={fuelText}
                onChangeText={v => { setFuelText(v); onStateChange(v); }}
                placeholder="e.g. better health, more energy, weight loss"
                placeholderTextColor={colors.textTertiary}
                multiline
                returnKeyType="done"
                blurOnSubmit={true}
                textAlignVertical="top"
                inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                autoFocus
              />
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          {!showFuelMode ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: canLock ? colors.primary : colors.border, opacity: canLock ? 1 : 0.45 }]}
                onPress={() => {
                  if (!canLock) return;
                  const finalText = actionText.trim();
                  const source: InputSource = (practiceText.trim().length > 0 && finalText === practiceText.trim())
                    ? 'ai_suggested'
                    : (practiceText.trim().length > 0 ? 'ai_edited' : 'user_written');
                  logInputFeedback({
                    goalText: goalLabel,
                    source,
                    finalInputText: finalText,
                    specificityFlagTriggered: !!specificity.result,
                  });
                  onSkipAsStandard(finalText);
                }}
                disabled={!canLock}
                activeOpacity={0.85}
              >
                <Check size={18} color="#000" strokeWidth={3} />
                <Text style={styles.primaryButtonText}>Lock it in as my standard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fuelSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => setShowFuelMode(true)}
                activeOpacity={0.75}
              >
                <Text style={[styles.fuelSecondaryText, { color: colors.textSecondary }]}>
                  It fuels a bigger goal →
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: canFuel ? colors.primary : colors.border, opacity: canFuel ? 1 : 0.45 }]}
              onPress={() => canFuel && onContinue(fuelText.trim())}
              disabled={!canFuel}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
              <ArrowRight size={20} color="#000" strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </KeyboardStepWrapper>
  );
}

// ─── GoalDoneLooksScreen ──────────────────────────────────────────────────────

export function GoalDoneLooksScreen({
  goal,
  goalIdx,
  total,
  chosenPath,
  initialText,
  onContinue,
  onBack,
  onStateChange,
}: {
  goal: FlowGoal;
  goalIdx: number;
  total: number;
  chosenPath: DecodePath;
  initialText?: string;
  onContinue: (doneLooksText: string) => void;
  onBack: () => void;
  onStateChange: (text: string) => void;
}) {
  const { colors, isDark } = useTheme();

  const isPostureA = goalHasNumber(goal.label);

  const defaultText = initialText ?? (isPostureA ? goal.label : '');
  const [text, setText] = useState(defaultText);

  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, [goalIdx]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const canContinue = text.trim().length > 0;

  const handleChange = (v: string) => {
    setText(v);
    onStateChange(v);
  };

  return (
    <KeyboardStepWrapper contentContainerStyle={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <View style={[styles.decodeHeader, { paddingHorizontal: 0, paddingTop: 0, marginBottom: 8 }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <GoalBadge goal={goal} n={goalIdx + 1} resolvedLabel={goal.label} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {isPostureA ? (
            <>
              <Text style={[styles.doneLooksEyebrow, { color: colors.primary }]}>
                YOUR FINISH LINE:
              </Text>
              <Text style={[styles.heroTitle, { color: colors.text, marginBottom: 8 }]}>
                Confirm it.
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
                Sharpen it or keep it — then break it down.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.heroTitle, { color: colors.text, marginBottom: 8 }]}>
                Done looks like...
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary, marginBottom: 24 }]}>
                Describe the finish line clearly. Be specific.
              </Text>
            </>
          )}

          <TextInput
            style={[
              styles.doneLooksInput,
              {
                color: colors.text,
                borderColor: text.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={text}
            onChangeText={handleChange}
            placeholder="e.g. I weigh 175 lbs and feel strong every day"
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="done"
            blurOnSubmit={true}
            autoCapitalize="sentences"
            textAlignVertical="top"
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            autoFocus={!isPostureA}
          />

          {isPostureA && (
            <Text style={[styles.doneLooksHint, { color: colors.textTertiary }]}>
              Sharper = better — add a number or timeframe. e.g. "earn $100K/month"
            </Text>
          )}

          {!isPostureA && text.trim().length === 0 && (
            <>
              <Text style={[styles.doneLooksHint, { color: colors.textTertiary }]}>
                Weak: "get healthier" · Strong: "run a 5K in under 30 min"
              </Text>
              <TouchableOpacity
                style={[
                  styles.doneLooksUseChip,
                  {
                    backgroundColor: isDark
                      ? colors.backgroundSecondary
                      : '#F0F0F0',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleChange(goal.label)}
                activeOpacity={0.75}
              >
                <Check size={13} color={colors.primary} strokeWidth={3} />
                <Text style={[styles.doneLooksUseChipText, { color: colors.textSecondary }]}>
                  Use: "{goal.label}"
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: canContinue ? colors.primary : colors.border, opacity: canContinue ? 1 : 0.45 }]}
            onPress={() => canContinue && onContinue(text.trim())}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Break it down</Text>
            <ArrowRight size={20} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardStepWrapper>
  );
}

// ─── IntroScreen ──────────────────────────────────────────────────────────────

export function IntroScreen({
  goals,
  onNext,
  onBack,
  goalLabelOverrides,
  onMergeGoals,
  onRemoveGoals,
}: {
  goals: FlowGoal[];
  onNext: () => void;
  onBack: () => void;
  goalLabelOverrides: Record<number, string>;
  onMergeGoals: (keepIndex: number, newLabel: string, removeIndices: number[]) => void;
  onRemoveGoals: (removeIndices: number[]) => void;
}) {
  const { colors } = useTheme();
  const [overlapGroups, setOverlapGroups] = useState<OverlapGroup[]>([]);
  const [dismissedGroups, setDismissedGroups] = useState<Set<number>>(new Set());
  const [mergeGroupIdx, setMergeGroupIdx] = useState<number | null>(null);
  const [vagueFlags, setVagueFlags] = useState<VagueFlag[]>([]);
  const [dismissedVague, setDismissedVague] = useState<Set<number>>(new Set());
  const [goalCountResolved, setGoalCountResolved] = useState(goals.length <= 10);
  const [vagueChecksResolved, setVagueChecksResolved] = useState(false);
  const [showTrimModal, setShowTrimModal] = useState(false);
  const [trimChecked, setTrimChecked] = useState<Set<number>>(new Set());
  const overlapFetchedRef = useRef(false);
  const vagueFetchedRef = useRef(false);

  useEffect(() => {
    if (overlapFetchedRef.current) return;
    overlapFetchedRef.current = true;
    if (goals.length < 2) return;
    fetchOverlappingGoals(goals.map(g => g.label)).then(groups => {
      InteractionManager.runAfterInteractions(() => {
        setOverlapGroups(groups);
      });
    });
  }, []);

  useEffect(() => {
    if (vagueFetchedRef.current) return;
    vagueFetchedRef.current = true;
    fetchVagueGoals(goals.map(g => g.label)).then(flags => {
      InteractionManager.runAfterInteractions(() => {
        setVagueFlags(flags);
        setVagueChecksResolved(true);
      });
    });
  }, []);

  const handleConfirmMerge = (groupIdx: number, newLabel: string) => {
    const group = overlapGroups[groupIdx];
    if (!group || group.indices.length < 2) return;
    const keepIndex = group.indices[0];
    const removeIndices = group.indices.slice(1);
    setOverlapGroups([]);
    setDismissedGroups(new Set());
    setMergeGroupIdx(null);
    onMergeGoals(keepIndex, newLabel, removeIndices);
  };

  const handleConfirmTrim = () => {
    const removeIndices = goals
      .map((_, i) => i)
      .filter(i => !trimChecked.has(i));

    if (removeIndices.length === 0) {
      setGoalCountResolved(true);
      setShowTrimModal(false);
      return;
    }

    if (removeIndices.length >= goals.length) return;

    setGoalCountResolved(true);
    setShowTrimModal(false);
    onRemoveGoals(removeIndices);
  };

  return (
    <KeyboardStepWrapper contentContainerStyle={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 20 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View
          style={[
            styles.stepPill,
            {
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
              marginBottom: 24,
            },
          ]}
        >
          <Zap size={13} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.stepPillText, { color: colors.textSecondary }]}>
            REVERSE ENGINEER
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Let's reverse{'\n'}engineer each{'\n'}goal.
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Every goal becomes a single daily number — the exact action you
          repeat until the outcome is inevitable.
        </Text>

        <View style={{ gap: 12, marginTop: 32 }}>
          {goals.map((g, i) => {
            const activeGroups = overlapGroups
              .map((grp, gi) => ({ group: grp, groupIdx: gi }))
              .filter(({ group }) =>
                group.indices.includes(i) &&
                group.indices[0] === i &&
                !dismissedGroups.has(group.indices[0]) &&
                mergeGroupIdx === null,
              );

            return (
              <View key={g.id}>
                <GoalBadge
                  goal={g}
                  n={i + 1}
                  resolvedLabel={formatGoalLabel(g, goalLabelOverrides)}
                />
                {activeGroups.map(({ group, groupIdx }) =>
                  mergeGroupIdx === groupIdx ? (
                    <MergeEditor
                      key={`merge-${groupIdx}`}
                      defaultLabel={`${goals[group.indices[0]]?.label ?? ''} (includes ${group.indices.slice(1).map(idx => goals[idx]?.label ?? '').join(', ')})`}
                      onConfirm={(label) => handleConfirmMerge(groupIdx, label)}
                      onCancel={() => setMergeGroupIdx(null)}
                    />
                  ) : (
                    <OverlapBanner
                      key={`overlap-${groupIdx}`}
                      reason={group.reason}
                      onKeepSeparate={() => setDismissedGroups(prev => new Set(prev).add(group.indices[0]))}
                      onCombine={() => setMergeGroupIdx(groupIdx)}
                    />
                  ),
                )}
                {vagueFlags
                  .filter(f => f.index === i && !dismissedVague.has(f.index))
                  .map(f => (
                    <VagueGoalBanner
                      key={`vague-${f.index}`}
                      reason={f.reason}
                      suggestions={f.suggestions}
                      onConfirm={(newLabel) => {
                        setDismissedVague(prev => new Set(prev).add(f.index));
                        onMergeGoals(i, newLabel, []);
                      }}
                      onDismiss={() => setDismissedVague(prev => new Set(prev).add(f.index))}
                    />
                  ))}
              </View>
            );
          })}
        </View>
      </View>

      {(() => {
        const hasUnresolvedVague = vagueFlags.some(f => !dismissedVague.has(f.index));
        const canAdvance = goalCountResolved && vagueChecksResolved && !hasUnresolvedVague;
        return (
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: canAdvance ? colors.primary : colors.border, opacity: canAdvance ? 1 : 0.45 }]}
          onPress={onNext}
          activeOpacity={0.85}
          disabled={!canAdvance}
        >
          <Text style={styles.primaryButtonText}>Reverse engineer goal 1</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>
        );
      })()}

      {!goalCountResolved && (
        <GoalCountNudge
          count={goals.length}
          onTrim={() => {
            setTrimChecked(new Set(goals.map((_, i) => i)));
            setShowTrimModal(true);
          }}
          onKeepAll={() => setGoalCountResolved(true)}
        />
      )}

      {showTrimModal && (
        <TrimModal
          goals={goals}
          checked={trimChecked}
          onToggle={(idx) => setTrimChecked(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
          })}
          onConfirm={handleConfirmTrim}
          onCancel={() => setShowTrimModal(false)}
        />
      )}
    </KeyboardStepWrapper>
  );
}
