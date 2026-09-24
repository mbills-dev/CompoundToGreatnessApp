import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowRight, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { logEdgeFunctionCall } from '@/lib/edgeFunctionLogger';

export interface SpecificityResult {
  specific: boolean;
  nudge: string | null;
  examples: string[] | null;
}

export type InputSource = 'ai_suggested' | 'ai_edited' | 'user_written';

/**
 * Calls the validate-input-specificity edge function.
 * Returns null on any error (network, parse, non-2xx) so callers can silently skip.
 */
export async function checkSpecificity(input: string): Promise<SpecificityResult | null> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return null;
  try {
    logEdgeFunctionCall('validate-input-specificity');
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/validate-input-specificity`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ input: trimmed }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (
      data &&
      typeof data.specific === 'boolean' &&
      (data.nudge === null || typeof data.nudge === 'string') &&
      (data.examples === null || Array.isArray(data.examples))
    ) {
      return {
        specific: data.specific,
        nudge: data.nudge,
        examples: data.examples,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Inserts a row into daily_input_feedback for analytics.
 * Silently swallows errors — this is fire-and-forget telemetry.
 */
export async function logInputFeedback(params: {
  goalText: string;
  source: InputSource;
  finalInputText: string;
  specificityFlagTriggered: boolean;
}): Promise<void> {
  try {
    await supabase.from('daily_input_feedback').insert({
      goal_text: params.goalText,
      source: params.source,
      final_input_text: params.finalInputText,
      specificity_flag_triggered: params.specificityFlagTriggered,
    });
  } catch {
    // telemetry — swallow
  }
}

/**
 * Hook that manages specificity-check state for a single TextInput.
 * Call `validate(text)` on blur/submit. While the check is in-flight,
 * `checking` is true. If the result is non-specific, `result` is populated
 * and the banner can be shown. Call `dismiss()` when the user accepts an
 * example or re-edits.
 */
export function useInputSpecificity() {
  const [result, setResult] = useState<SpecificityResult | null>(null);
  const [checking, setChecking] = useState(false);
  const lastCheckedRef = useRef('');
  const inFlightRef = useRef(false);

  const validate = useCallback(async (text: string): Promise<SpecificityResult | null> => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setResult(null);
      return null;
    }
    if (lastCheckedRef.current === trimmed && (inFlightRef.current || result)) {
      return result;
    }
    lastCheckedRef.current = trimmed;
    inFlightRef.current = true;
    setChecking(true);
    const res = await checkSpecificity(trimmed);
    inFlightRef.current = false;
    setChecking(false);
    if (res && !res.specific) {
      setResult(res);
    } else {
      setResult(null);
    }
    return res;
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => setResult(null), []);

  return { result, checking, validate, dismiss };
}

/**
 * Inline refinement panel shown below a daily-input field when the specificity
 * check returns `specific: false`. Presented as helpful refinement in the CTG
 * design system — dark cards, lime accent, no orange warning.
 */
export function SpecificityNudgeBanner({
  result,
  onAcceptExample,
  onDismiss,
}: {
  result: SpecificityResult;
  onAcceptExample: (example: string) => void;
  onDismiss: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const examples = result.examples ?? [];

  const handleCustomConfirm = () => {
    const trimmed = customText.trim();
    if (trimmed.length > 0) {
      onAcceptExample(trimmed);
      setCustomMode(false);
      setCustomText('');
    }
  };

  return (
    <View style={[
      nudgeStyles.container,
      {
        backgroundColor: isDark ? '#0F0F0F' : '#F5F5F5',
        borderColor: isDark ? '#1F1F1F' : '#E0E0E0',
      },
    ]}>
      <Text style={nudgeStyles.eyebrow}>MAKE IT MEASURABLE</Text>
      <Text style={[nudgeStyles.headline, { color: isDark ? '#FFF' : '#000' }]}>
        Could you tell if you{'\n'}completed this today?
      </Text>
      <Text style={[nudgeStyles.support, { color: isDark ? '#888' : '#777' }]}>
        {result.nudge ?? 'Try adding a number or a clear yes/no rule.'}
      </Text>

      {examples.length > 0 && !customMode && (
        <View style={nudgeStyles.examplesCol}>
          <Text style={nudgeStyles.tryLabel}>Try one of these:</Text>
          {examples.map((ex, i) => (
            <TouchableOpacity
              key={i}
              style={[
                nudgeStyles.exampleCard,
                {
                  backgroundColor: isDark ? '#161616' : '#FAFAFA',
                  borderColor: isDark ? '#222' : '#E8E8E8',
                },
              ]}
              onPress={() => onAcceptExample(ex)}
              activeOpacity={0.7}
            >
              <Text style={[nudgeStyles.exampleText, { color: isDark ? '#FFF' : '#000' }]}>
                {ex}
              </Text>
              <ArrowRight size={14} color="#CCFF00" strokeWidth={2.5} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {customMode ? (
        <View style={nudgeStyles.customRow}>
          <TextInput
            style={[
              nudgeStyles.customInput,
              {
                color: isDark ? '#FFF' : '#000',
                borderColor: '#CCFF00' + '80',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              },
            ]}
            value={customText}
            onChangeText={setCustomText}
            autoFocus
            placeholder="Type your measurable input..."
            placeholderTextColor={isDark ? '#555' : '#999'}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handleCustomConfirm}
          />
          <TouchableOpacity style={nudgeStyles.customConfirmBtn} onPress={handleCustomConfirm} activeOpacity={0.85}>
            <Check size={16} color="#000" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={nudgeStyles.writeOwnBtn} onPress={() => setCustomMode(true)} activeOpacity={0.7}>
          <Text style={nudgeStyles.writeOwnText}>Write my own →</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={nudgeStyles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
        <Text style={nudgeStyles.dismissText}>Keep as-is</Text>
      </TouchableOpacity>
    </View>
  );
}

const nudgeStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    marginTop: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#CCFF00',
  },
  headline: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  support: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  examplesCol: {
    gap: 8,
    marginTop: 4,
  },
  tryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.3,
  },
  exampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  writeOwnBtn: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  writeOwnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  customInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  customConfirmBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dismissBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
});
