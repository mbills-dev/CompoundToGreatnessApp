import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X, AtSign, ArrowRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onComplete: () => void;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function UsernamePicker({ onComplete }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAvailability = useCallback(
    async (value: string) => {
      if (!USERNAME_REGEX.test(value)) {
        setAvailability('invalid');
        return;
      }
      if (!user?.id) return;

      setAvailability('checking');
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', value)
          .neq('id', user.id)
          .limit(1);

        setAvailability(data && data.length > 0 ? 'taken' : 'available');
      } catch {
        setAvailability('idle');
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!username) {
      setAvailability('idle');
      return;
    }

    debounceRef.current = setTimeout(() => {
      checkAvailability(username);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkAvailability]);

  const canSubmit = USERNAME_REGEX.test(username) && availability === 'available' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;

    setSubmitting(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: username, username_set: true })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message || 'Failed to set username. Please try again.');
        return;
      }

      onComplete();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFeedback = () => {
    if (availability === 'idle' || availability === 'invalid') return null;

    if (availability === 'checking') {
      return (
        <View style={styles.feedbackRow}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
          <Text style={[styles.feedbackText, { color: colors.textTertiary }]}>Checking…</Text>
        </View>
      );
    }

    if (availability === 'available') {
      return (
        <View style={styles.feedbackRow}>
          <View style={[styles.feedbackIcon, { backgroundColor: 'rgba(204,255,0,0.15)' }]}>
            <Check size={14} color="#ccff00" strokeWidth={3} />
          </View>
          <Text style={[styles.feedbackText, { color: '#ccff00' }]}>Available</Text>
        </View>
      );
    }

    if (availability === 'taken') {
      return (
        <View style={styles.feedbackRow}>
          <View style={[styles.feedbackIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
            <X size={14} color="#EF4444" strokeWidth={3} />
          </View>
          <Text style={[styles.feedbackText, { color: '#EF4444' }]}>Already taken</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={isDarkGradient(colors) ? ['#000000', '#0A0A0A', '#000000'] : ['#F5F5F0', '#EBEBE6', '#F5F5F0']}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.iconCircle, { borderColor: 'rgba(204,255,0,0.3)' }]}>
            <AtSign size={32} color="#ccff00" strokeWidth={2} />
          </View>

          <Text style={[styles.eyebrow, { color: '#ccff00' }]}>CLAIM YOUR HANDLE</Text>
          <Text style={[styles.headline, { color: colors.text }]}>Pick your username</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This is how you'll be known across the app. You can change it later in settings.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>USERNAME</Text>

            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.atPrefix, { color: colors.textTertiary }]}>@</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="your_name"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {renderFeedback()}

            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              3–20 characters · lowercase letters, numbers, underscores
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={canSubmit ? ['#ccff00', '#aed900'] : ['rgba(204,255,0,0.2)', 'rgba(174,217,0,0.2)']}
              style={styles.buttonGradient}
            >
              {submitting ? (
                <ActivityIndicator color={canSubmit ? '#000000' : colors.textTertiary} />
              ) : (
                <>
                  <Text style={[styles.buttonText, { color: canSubmit ? '#000000' : colors.textTertiary }]}>
                    Claim it
                  </Text>
                  <ArrowRight size={20} color={canSubmit ? '#000000' : colors.textTertiary} strokeWidth={2.5} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function isDarkGradient(colors: { background: string }) {
  return colors.background === '#000000';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 28, paddingTop: 80, paddingBottom: 60 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(204,255,0,0.12)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 10,
  },
  headline: {
    fontFamily: 'Inter-Black',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 12,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  atPrefix: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  feedbackIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '900',
  },
});
