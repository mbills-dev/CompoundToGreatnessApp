import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  Briefcase,
  Dumbbell,
  Heart,
  Star,
  Zap,
  Target,
  Check,
  Pen,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Dimension, RefineSuggestion } from './types';
import { getRefineSuggestion } from './api';

const ICON_MAP: Record<string, any> = {
  Briefcase,
  Dumbbell,
  Heart,
  Star,
  Zap,
  Target,
};

function buildFromTemplate(template: string, value: string, vague: string): string {
  const langs: Record<string, string> = {
    french: 'French', spanish: 'Spanish', german: 'German', italian: 'Italian',
    japanese: 'Japanese', chinese: 'Chinese', korean: 'Korean', portuguese: 'Portuguese',
    arabic: 'Arabic', russian: 'Russian', hindi: 'Hindi', mandarin: 'Mandarin',
  };
  let lang = '';
  const lowerVague = vague.toLowerCase();
  for (const [key, val] of Object.entries(langs)) {
    if (lowerVague.includes(key)) { lang = val; break; }
  }

  let insertValue = value;
  if (template === 'I __') {
    insertValue = value.replace(/^(my|the)\s+/i, '').trim();
    if (insertValue.length > 0) {
      insertValue = insertValue.charAt(0).toLowerCase() + insertValue.slice(1);
    }
  } else {
    insertValue = value.toLowerCase();
  }

  if (/^\$/.test(insertValue)) {
    insertValue = value;
  }

  if (/^I am\s/i.test(template)) {
    insertValue = insertValue.replace(/^(be|am|being)\s+/i, '').trim();
  }
  if (/^I am (a|an)\s/i.test(template)) {
    insertValue = insertValue.replace(/^(a|an)\s+/i, '').trim();
  }
  if (/who\s+__/.test(template)) {
    insertValue = insertValue.replace(/^(who|that)\s+/i, '').trim();
  }
  if (/^I\s+(can|do|have|earn|eat)\s/i.test(template)) {
    const match = template.match(/^I\s+(can|do|have|earn|eat)\s/i);
    if (match) {
      const verb = match[1].toLowerCase();
      const re = new RegExp('^' + verb + '\\s+', 'i');
      insertValue = insertValue.replace(re, '').trim();
    }
  }

  let result = template.replace('__', insertValue);
  if (lang) result = result.replace('{lang}', lang);
  if (!result.startsWith('I ')) result = 'I ' + result;
  return result;
}

const THIRD_PERSON_VERBS = /^I\s+(makes|takes|gives|shows|prioritizes|supports|helps|builds|lives|leads|earns|grows|runs|works|creates|brings|keeps|maintains)\s+/i;

function normalizeIdentitySentence(s: string): string {
  s = s.replace(/^I\s+am\s+someone\s+who\s+can\s+/i, 'I ');
  s = s.replace(/^I\s+am\s+someone\s+who\s+/i, 'I ');
  s = s.replace(THIRD_PERSON_VERBS, (_, verb) => 'I ' + verb.replace(/s$/i, '') + ' ');
  return s;
}

function buildIdentityText(suggestion: RefineSuggestion, value: string, vague: string): string {
  let text = value.trim();
  const looksLikeFullSentence = /^I\s/i.test(text) || text.split(/\s+/).length > 5;
  if (looksLikeFullSentence) {
    if (!text.startsWith('I ') && text.toLowerCase().startsWith('i ')) {
      text = 'I' + text.slice(1);
    }
    if (!text.toLowerCase().startsWith('i ')) text = 'I ' + text;
    return normalizeIdentitySentence(text);
  } else if (suggestion.template) {
    return normalizeIdentitySentence(buildFromTemplate(suggestion.template, text, vague));
  } else {
    if (!text.toLowerCase().startsWith('i ')) text = 'I ' + text;
    return normalizeIdentitySentence(text);
  }
}

function isAlreadySpecific(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (/\$[\d,.]+/.test(lower)) return true;
  if (/\d+k\b/.test(lower)) return true;
  if (/\d+\s*(lbs?|pounds?|kg|miles?|minutes?|hours?|days?|times?|reps?|sets?)\b/.test(lower)) return true;
  if (/\d+\/month/.test(lower)) return true;
  if (/\d+\s*(a|per)\s*(month|week|day|year)\b/.test(lower)) return true;
  if (/\d+%/.test(lower)) return true;
  if (/\d{2,}/.test(lower) && lower.split(/\s+/).length >= 2) return true;
  return false;
}

function buildSpecificFallback(dimension: Dimension): RefineSuggestion {
  const input = dimension.originalInput || dimension.vague;
  const lower = input.toLowerCase();

  if (/\$|money|earn|income|revenue|\dk/.test(lower)) {
    return {
      question: `You said "${input}" — how do you want to frame this as your identity?`,
      suggestions: [
        `I earn ${input} consistently and predictably`,
        `I earn ${input} through work I'm proud of`,
        `I earn ${input} while maintaining full balance in my life`,
      ],
      template: 'I __',
      identity: dimension.specific,
      alreadySpecific: true,
    };
  }

  if (/lbs?|pounds?|kg|weight/.test(lower)) {
    return {
      question: `You said "${input}" — how do you want to frame this?`,
      suggestions: [
        `I weigh ${input.replace(/^(weigh|get to|hit|reach)\s*/i, '')} with a lean, athletic build`,
        `I maintain ${input.replace(/^(weigh|get to|hit|reach)\s*/i, '')} with visible definition`,
        `I am at ${input.replace(/^(weigh|get to|hit|reach)\s*/i, '')} and feel incredible`,
      ],
      template: 'I __',
      identity: dimension.specific,
      alreadySpecific: true,
    };
  }

  return {
    question: `You said "${input}" — how do you want to frame this as your identity?`,
    suggestions: [
      `I ${input.charAt(0).toLowerCase() + input.slice(1)} consistently, no excuses`,
      `I ${input.charAt(0).toLowerCase() + input.slice(1)} and it's non-negotiable`,
      `I ${input.charAt(0).toLowerCase() + input.slice(1)} because that's who I am`,
    ],
    template: 'I __',
    identity: dimension.specific,
    alreadySpecific: true,
  };
}

function getLocalFallback(dimension: Dimension): RefineSuggestion {
  const originalInput = dimension.originalInput || '';
  if (originalInput && isAlreadySpecific(originalInput)) {
    return buildSpecificFallback(dimension);
  }

  const vague = dimension.vague.toLowerCase();

  if (vague.includes('french') || vague.includes('spanish') || vague.includes('german') || vague.includes('italian') || vague.includes('japanese') || vague.includes('chinese') || vague.includes('korean')) {
    return {
      question: 'What level of fluency are you aiming for?',
      suggestions: ['Conversational', 'Fully fluent', 'Read and write professionally'],
      template: 'I am __ in {lang}',
      identity: dimension.specific,
    };
  }
  if (vague.includes('money') || vague.includes('earn') || vague.includes('income')) {
    return {
      question: 'How much do you want to earn per month?',
      suggestions: ['$5,000/month', '$10,000/month', '$25,000/month'],
      template: 'I earn __ consistently',
      identity: dimension.specific,
    };
  }
  if (vague.includes('cartwheel')) {
    return {
      question: "What kind of cartwheel would mean you've achieved this?",
      suggestions: ['One-handed cartwheel', 'Running round-off', 'No-hands aerial cartwheel'],
      template: 'I can do a __ on command',
      identity: dimension.specific,
    };
  }
  if (vague.includes('flip')) {
    return {
      question: 'What kind of flip are you going for?',
      suggestions: ['Standing backflip', 'Running front flip', 'Standing back tuck'],
      template: 'I can land a __ every time',
      identity: dimension.specific,
    };
  }
  if (vague.includes('flexible') || vague.includes('flexibility')) {
    return {
      question: 'What does being flexible look like for you?',
      suggestions: ['Touch my palms to the floor', 'Full center splits', 'Grab my foot behind my head'],
      template: 'I can __ with ease',
      identity: dimension.specific,
    };
  }

  if (/\bgo on\b/.test(vague) || /\bexplore\b/.test(vague) || /\badventur/.test(vague)) {
    return {
      question: 'What does going on adventures mean for you?',
      suggestions: ['Take 1 big trip every quarter', 'Explore a new place every single weekend', 'Summit a new trail or peak each season'],
      template: 'I __',
      identity: dimension.specific,
    };
  }

  if (/\b(stop|quit)\b/.test(vague)) {
    const habit = vague.replace(/^(stop|quit)\s+/i, '').trim();
    return {
      question: `What does life look like once you've stopped ${habit}?`,
      suggestions: [`Free from ${habit} for good`, `${habit} is no longer part of my life`, `Replaced ${habit} with a habit I'm proud of`],
      template: 'I have __',
      identity: dimension.specific,
    };
  }

  if (/\b(build|create|make|start|launch)\b/.test(vague)) {
    const thing = vague.replace(/^(build|create|make|start|launch)\s+/i, '').trim();
    return {
      question: `What does successfully building ${thing || 'this'} look like?`,
      suggestions: [
        thing ? `${thing.charAt(0).toUpperCase() + thing.slice(1)} is live and generating real results` : "It's live and generating real results",
        'The foundation is done and I\'m scaling it',
        'Something I\'m genuinely proud to share with others',
      ],
      template: 'I have built __',
      identity: dimension.specific,
    };
  }

  if (/\bfeel\b/.test(vague)) {
    const feeling = vague.replace(/^(feel|feeling)\s+/i, '').trim();
    return {
      question: `What does feeling ${feeling} look like every day?`,
      suggestions: [
        `Wake up ${feeling} without effort`,
        `Consistently ${feeling} no matter the circumstances`,
        `A life that naturally creates feeling ${feeling}`,
      ],
      template: 'I __',
      identity: dimension.specific,
    };
  }

  if (/\bbe (a|an|the)\b/.test(vague) || /\bbecome (a|an|the)\b/.test(vague)) {
    const role = vague.replace(/^(be|become)\s+(a|an|the)\s+/i, '').trim();
    return {
      question: `What does being a ${role} look like for you?`,
      suggestions: [
        `Known as the go-to ${role} in my field`,
        `Recognized and respected as a ${role}`,
        `Living fully as a ${role} every single day`,
      ],
      template: 'I am a __ who delivers results',
      identity: dimension.specific,
    };
  }

  const isAction = /^(be |become |get |feel |have |make |build |create |start |stop |quit |lose |gain |improve |develop |grow |learn |master |go |run |walk |work |eat |sleep |read |write |speak |lead |train |travel |explore |connect )/.test(vague);
  if (isAction) {
    const verb = vague.split(' ')[0];
    const rest = vague.slice(verb.length).trim();
    return {
      question: `What does it look like when you truly ${dimension.vague}?`,
      suggestions: [
        `${verb.charAt(0).toUpperCase() + verb.slice(1)}${rest ? ' ' + rest : ''} consistently and with pride`,
        `${verb.charAt(0).toUpperCase() + verb.slice(1)}${rest ? ' ' + rest : ''} at a level that impresses even me`,
        `${verb.charAt(0).toUpperCase() + verb.slice(1)}${rest ? ' ' + rest : ''} without struggle — it's who I am`,
      ],
      template: 'I __',
      identity: dimension.specific,
    };
  }

  return {
    question: `What does "${dimension.vague}" look like when you've fully achieved it?`,
    suggestions: [
      `${dimension.vague} — measurable, consistent, and real`,
      `${dimension.vague} in a way I'm genuinely proud of`,
      `${dimension.vague} has become a natural part of who I am`,
    ],
    template: 'I __',
    identity: dimension.specific,
  };
}

interface Props {
  dimension: Dimension;
  currentIndex: number;
  totalDimensions: number;
  onUpdate: (specific: string) => void;
}

export default function RefineScreen({ dimension, currentIndex, totalDimensions, onUpdate }: Props) {
  const { colors, isDark } = useTheme();
  const [suggestion, setSuggestion] = useState<RefineSuggestion | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [useOriginalSelected, setUseOriginalSelected] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customConfirmed, setCustomConfirmed] = useState(false);
  const [confirmedStatement, setConfirmedStatement] = useState('');

  const confirmAnim = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const statementSlide = useSharedValue(20);
  const statementOpacity = useSharedValue(0);

  const Icon = ICON_MAP[dimension.icon] || Target;

  useEffect(() => {
    setSuggestion(null);
    setSelectedSuggestion(null);
    setUseOriginalSelected(false);
    setCustomMode(false);
    setCustomText('');
    setCustomConfirmed(false);
    setConfirmedStatement('');
    confirmAnim.value = 0;
    checkScale.value = 0;
    statementSlide.value = 20;
    statementOpacity.value = 0;
    loadSuggestion();
  }, [dimension.category, dimension.vague, currentIndex]);

  const loadSuggestion = async () => {
    try {
      const data = await getRefineSuggestion(dimension);
      setSuggestion(data);
    } catch {
      setSuggestion(getLocalFallback(dimension));
    }
  };

  useEffect(() => {
    if (!suggestion) return;
    if (suggestion.alreadySpecific && !selectedSuggestion && !customConfirmed) {
      const input = dimension.originalInput || dimension.vague;
      const statement = buildIdentityText(suggestion, input, dimension.vague);
      onUpdate(statement);
      setUseOriginalSelected(true);
    }
  }, [suggestion]);

  useEffect(() => {
    if (!suggestion) return;
    if (customConfirmed) return;
    if (selectedSuggestion) {
      if (suggestion.alreadySpecific) {
        onUpdate(selectedSuggestion);
      } else if (dimension.originalInput && selectedSuggestion === dimension.originalInput) {
        const statement = buildIdentityText(suggestion, selectedSuggestion, dimension.vague);
        onUpdate(statement);
      } else if (suggestion.template) {
        onUpdate(buildFromTemplate(suggestion.template, selectedSuggestion, dimension.vague));
      }
    } else if (suggestion.alreadySpecific) {
      const input = dimension.originalInput || dimension.vague;
      const statement = buildIdentityText(suggestion, input, dimension.vague);
      onUpdate(statement);
    }
  }, [selectedSuggestion, suggestion]);

  const handleConfirmCustom = useCallback(() => {
    if (!suggestion || customText.trim().length < 3) return;

    const statement = buildIdentityText(suggestion, customText, dimension.vague);
    setConfirmedStatement(statement);
    setCustomConfirmed(true);
    onUpdate(statement);

    confirmAnim.value = withTiming(1, { duration: 400, easing: Easing.bezierFn(0.4, 0, 0.2, 1) });
    checkScale.value = withSequence(
      withTiming(1.3, { duration: 250, easing: Easing.bezierFn(0.34, 1.56, 0.64, 1) }),
      withTiming(1, { duration: 150 })
    );
    statementSlide.value = withDelay(200, withTiming(0, { duration: 400, easing: Easing.bezierFn(0, 0, 0.2, 1) }));
    statementOpacity.value = withDelay(200, withTiming(1, { duration: 350 }));
  }, [suggestion, customText, dimension.vague, onUpdate]);

  const handleEditCustom = useCallback(() => {
    setCustomConfirmed(false);
    setConfirmedStatement('');
    confirmAnim.value = 0;
    checkScale.value = 0;
    statementSlide.value = 20;
    statementOpacity.value = 0;
  }, []);

  const inputFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(confirmAnim.value, [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(confirmAnim.value, [0, 1], [0, -10]) }],
  }));

  const confirmCardStyle = useAnimatedStyle(() => ({
    opacity: confirmAnim.value,
    transform: [{ scale: interpolate(confirmAnim.value, [0, 0.5, 1], [0.95, 1.02, 1]) }],
  }));

  const checkIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const statementStyle = useAnimatedStyle(() => ({
    opacity: statementOpacity.value,
    transform: [{ translateY: statementSlide.value }],
  }));

  const displayQuestion = suggestion?.question || 'What does success look like for you here?';
  const displaySuggestions = suggestion?.suggestions || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBadge}
        >
          <Icon size={24} color="#000000" strokeWidth={2.5} />
        </LinearGradient>
        <View style={styles.headerText}>
          <Text style={[styles.dimLabel, { color: colors.textTertiary }]}>
            {currentIndex + 1} of {totalDimensions}
          </Text>
          <Text style={[styles.dimCategory, { color: colors.text }]}>
            {dimension.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {suggestion?.alreadySpecific ? "That's Already\nSpecific" : "Let's Get\nSpecific"}
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          const input = dimension.originalInput || dimension.vague;
          setSelectedSuggestion(null);
          setCustomMode(false);
          setCustomConfirmed(false);
          if (suggestion) {
            const statement = buildIdentityText(suggestion, input, dimension.vague);
            onUpdate(statement);
          }
          setUseOriginalSelected(true);
        }}
        style={[styles.vagueBox, {
          backgroundColor: useOriginalSelected
            ? 'transparent'
            : isDark ? colors.backgroundTertiary : 'rgba(245, 245, 245, 0.6)',
          borderColor: useOriginalSelected
            ? colors.primary
            : isDark ? colors.border : '#E0E0E0',
          borderWidth: useOriginalSelected ? 2 : 1,
        }]}
      >
        <View style={styles.vagueBoxHeader}>
          <Text style={[styles.vagueLabel, { color: colors.textTertiary }]}>You said:</Text>
          {useOriginalSelected ? (
            <View style={[styles.useThisBadge, { backgroundColor: colors.primary }]}>
              <Check size={12} color="#000000" strokeWidth={3} />
              <Text style={styles.useThisBadgeText}>Selected</Text>
            </View>
          ) : (
            <Text style={[styles.tapToUseText, { color: colors.primary }]}>Tap to use this</Text>
          )}
        </View>
        <Text style={[styles.vagueText, { color: useOriginalSelected ? colors.text : colors.text }]}>
          "{dimension.originalInput || dimension.vague}"
        </Text>
      </TouchableOpacity>

      {suggestion && (
        <View style={styles.suggestionSection}>
          <Text style={[styles.questionText, { color: colors.textSecondary }]}>
            {useOriginalSelected
              ? 'Your original input will be used. Or pick a version below instead.'
              : suggestion.alreadySpecific
                ? 'Choose a version below, or tap your input above to use it as-is.'
                : displayQuestion}
          </Text>

          {!customMode ? (
            <>
              <View style={styles.suggestionList}>
                {displaySuggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.suggestionChip, {
                      backgroundColor: selectedSuggestion === s
                        ? 'transparent'
                        : isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)',
                      borderColor: selectedSuggestion === s
                        ? colors.primary
                        : isDark ? colors.border : '#E0E0E0',
                      borderWidth: selectedSuggestion === s ? 2 : 1.5,
                    }]}
                    onPress={() => { setSelectedSuggestion(s); setUseOriginalSelected(false); }}
                  >
                    <Text style={[styles.suggestionText, {
                      color: selectedSuggestion === s ? colors.primary : colors.text,
                    }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.customLink}
                onPress={() => { setCustomMode(true); setSelectedSuggestion(null); setUseOriginalSelected(false); }}
              >
                <Text style={[styles.customLinkText, { color: colors.primary }]}>Write my own</Text>
              </TouchableOpacity>
            </>
          ) : !customConfirmed ? (
            <>
              <Animated.View style={inputFadeStyle}>
                <TextInput
                  style={[styles.customInput, {
                    color: colors.text,
                    borderColor: colors.primary,
                    backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)',
                  }]}
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder="Type your answer..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.useThisButton, {
                    backgroundColor: customText.trim().length >= 3 ? colors.primary : (isDark ? colors.backgroundSecondary : '#D0D0D0'),
                  }]}
                  onPress={handleConfirmCustom}
                  disabled={customText.trim().length < 3}
                  activeOpacity={0.85}
                >
                  <Check
                    size={18}
                    color={customText.trim().length >= 3 ? '#000000' : colors.textTertiary}
                    strokeWidth={3}
                  />
                  <Text style={[styles.useThisText, {
                    color: customText.trim().length >= 3 ? '#000000' : colors.textTertiary,
                  }]}>
                    Use This
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.customLink}
                onPress={() => { setCustomMode(false); setCustomText(''); }}
              >
                <Text style={[styles.customLinkText, { color: colors.primary }]}>Use suggestions instead</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Animated.View style={confirmCardStyle}>
              <View style={[styles.confirmedCard, {
                borderColor: colors.primary,
                backgroundColor: isDark ? colors.backgroundSecondary : 'rgba(245, 245, 245, 0.8)',
              }]}>
                <View style={styles.confirmedHeader}>
                  <Animated.View style={[styles.confirmedCheck, { backgroundColor: colors.primary }, checkIconStyle]}>
                    <Check size={14} color="#000000" strokeWidth={3} />
                  </Animated.View>
                  <Text style={[styles.confirmedLabel, { color: colors.primary }]}>Your identity statement</Text>
                </View>
                <Animated.View style={statementStyle}>
                  <Text style={[styles.confirmedText, { color: colors.text }]}>
                    {confirmedStatement}
                  </Text>
                </Animated.View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEditCustom}
                  activeOpacity={0.7}
                >
                  <Pen size={14} color={colors.textTertiary} strokeWidth={2} />
                  <Text style={[styles.editButtonText, { color: colors.textTertiary }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  dimLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dimCategory: {
    fontSize: 18,
    fontWeight: '800',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  vagueBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  vagueBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vagueLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tapToUseText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  useThisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  useThisBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
  vagueText: {
    fontSize: 17,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  suggestionSection: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 16,
  },
  suggestionList: {
    gap: 10,
  },
  suggestionChip: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  originalChip: {
    paddingTop: 12,
    paddingBottom: 14,
  },
  originalChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  customLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  customLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  customInput: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 80,
    lineHeight: 24,
  },
  useThisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  useThisText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  confirmedCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
  },
  confirmedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  confirmedCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  confirmedText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingTop: 14,
    paddingHorizontal: 4,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
