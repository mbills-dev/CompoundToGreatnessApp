import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CircleAlert as AlertCircle, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

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

  const validate = useCallback(async (text: string): Promise<SpecificityResult | null> => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setResult(null);
      return null;
    }
    if (lastCheckedRef.current === trimmed && result) {
      return result;
    }
    lastCheckedRef.current = trimmed;
    setChecking(true);
    const res = await checkSpecificity(trimmed);
    setChecking(false);
    if (res && !res.specific) {
      setResult(res);
    } else {
      setResult(null);
    }
    return res;
  }, [result]);

  const dismiss = useCallback(() => setResult(null), []);

  return { result, checking, validate, dismiss };
}

/**
 * Inline banner shown below a daily-input field when the specificity
 * check returns `specific: false`. Shows the nudge text and tappable
 * example chips. Tapping an example calls `onAcceptExample` with the
 * chosen string.
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

  return (
    <View
      style={[
        nudgeStyles.container,
        {
          backgroundColor: isDark ? 'rgba(255,179,0,0.08)' : 'rgba(255,179,0,0.06)',
          borderColor: 'rgba(255,179,0,0.3)',
        },
      ]}
    >
      <View style={nudgeStyles.headerRow}>
        <AlertCircle size={16} color="#FFB300" strokeWidth={2.5} />
        <Text style={nudgeStyles.nudgeText}>{result.nudge ?? 'Try adding a number or clear done/not-done rule.'}</Text>
      </View>
      {result.examples && result.examples.length > 0 && (
        <View style={nudgeStyles.examplesRow}>
          <Text style={[nudgeStyles.examplesLabel, { color: colors.textSecondary }]}>
            Try instead:
          </Text>
          {result.examples.map((ex, i) => (
            <TouchableOpacity
              key={i}
              style={[
                nudgeStyles.exampleChip,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: colors.primary + '50',
                },
              ]}
              onPress={() => onAcceptExample(ex)}
              activeOpacity={0.7}
            >
              <Text style={[nudgeStyles.exampleText, { color: colors.text }]}>{ex}</Text>
              <ArrowRight size={13} color={colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const nudgeStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nudgeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#FFB300',
  },
  examplesRow: {
    gap: 8,
  },
  examplesLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
});
