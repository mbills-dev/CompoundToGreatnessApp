import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, Zap, Camera, Image as ImageIcon, RotateCw } from 'lucide-react-native';
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

// ─── GoalsEntryScreen ─────────────────────────────────────────────────────────

export function GoalsEntryScreen({ onContinue, onBack }: { onContinue: (goals: FlowGoal[], isAiSourced?: boolean) => void; onBack: () => void }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 400 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const canContinue = text.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(parseGoalsFromText(text));
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
        const flowGoals: FlowGoal[] = result.goals.map((rawLabel: string) => ({
          id: _goalIdSeq++,
          label: normalizeMoneyInLabel(rawLabel),
          category: 'General',
          deadline: 'ongoing',
          defaultPath: 'starting' as DecodePath,
        }));
        onContinue(flowGoals, true);
        return;
      }

      if (result.success === false && result.reason === 'not_goals') {
        setPhotoError("Couldn't find goals in that photo — try another or type them in");
      } else {
        setPhotoError("Couldn't find goals in that photo — try another or type them in");
      }
    } catch (err) {
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

  return (
    <KeyboardStepWrapper contentContainerStyle={[styles.screen, { backgroundColor: colors.background }]}>
      <Animated.View style={[fadeStyle, { flex: 1 }]}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginBottom: 20 }]}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            What do you{'\n'}want to achieve?
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.primary, marginBottom: 28 }]}>
            Separate multiple goals with commas.
          </Text>

          <TextInput
            style={[
              styles.goalsEntryInput,
              {
                color: colors.text,
                borderColor: text.trim() ? colors.primary + '80' : isDark ? '#333' : '#D8D8D8',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="e.g. earn $100k, lose 20 lbs, read more books"
            placeholderTextColor={colors.textTertiary}
            multiline
            returnKeyType="done"
            blurOnSubmit={true}
            autoCapitalize="sentences"
            textAlignVertical="top"
            inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
          />

          <TouchableOpacity
            style={[photoStyles.uploadBtn, { borderColor: colors.primary, opacity: photoLoading ? 0.6 : 1, marginTop: 12 }]}
            onPress={handleUploadPhoto}
            activeOpacity={0.8}
            disabled={photoLoading}
          >
            {photoLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <ImageIcon size={18} color={colors.primary} strokeWidth={2.5} />
                <Text style={[photoStyles.uploadBtnText, { color: colors.primary }]}>
                  Upload a photo instead
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {photoError && (
          <View style={[photoStyles.errorCard, { backgroundColor: isDark ? 'rgba(255,68,0,0.08)' : 'rgba(255,68,0,0.06)', borderColor: 'rgba(255,68,0,0.3)' }]}>
            <Text style={photoStyles.errorText}>{photoError}</Text>
            <TouchableOpacity style={photoStyles.retryBtn} onPress={handleUploadPhoto} activeOpacity={0.7}>
              <RotateCw size={14} color={colors.primary} strokeWidth={2.5} />
              <Text style={[photoStyles.retryText, { color: colors.primary }]}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSection}>
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
      </Animated.View>
    </KeyboardStepWrapper>
  );
}

const photoStyles = StyleSheet.create({
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: '#FF4400',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
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

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: goalCountResolved && vagueChecksResolved ? colors.primary : colors.border, opacity: goalCountResolved && vagueChecksResolved ? 1 : 0.45 }]}
          onPress={onNext}
          activeOpacity={0.85}
          disabled={!(goalCountResolved && vagueChecksResolved)}
        >
          <Text style={styles.primaryButtonText}>Reverse engineer goal 1</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>
      </View>

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
