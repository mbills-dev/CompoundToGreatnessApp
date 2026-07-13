import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, ArrowRight, Zap } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

interface InviterInfo {
  displayName: string;
  currentDay: number;
  identityStatement: string;
  goalTitle: string;
  streak: number;
  inviterId: string;
}

interface Props {
  inviteCode: string;
  onWatcherReady: (userId: string, inviterId: string) => void;
  onStartOwn: () => void;
}

export default function WatcherSignupScreen({ inviteCode, onWatcherReady, onStartOwn }: Props) {
  const { colors, isDark } = useTheme();
  const bg = isDark ? '#000000' : colors.background;
  const cardBg = isDark ? '#0A0A0A' : colors.card;
  const secondaryBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const textPrimary = isDark ? '#FFFFFF' : colors.text;
  const textSecondary = isDark ? '#808080' : colors.textSecondary;
  const textTertiary = isDark ? '#555' : colors.textTertiary;
  const textMuted = isDark ? '#444' : colors.textTertiary;
  const borderColor = isDark ? '#1A1A1A' : colors.border;
  const rootGradientPreview: [string, string, string] = isDark ? ['#000000', '#0A0A0A', '#000000'] : [colors.background, colors.background, colors.background];
  const rootGradientSignup: [string, string] = isDark ? ['#000000', '#0A0A0A'] : [colors.background, colors.background];
  const [inviter, setInviter] = useState<InviterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'preview' | 'signup'>('preview');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadInvite();
  }, [inviteCode]);

  const loadInvite = async () => {
    try {
      const { data: invite } = await supabase
        .from('watcher_invitations')
        .select('inviter_id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (!invite) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: settings } = await supabase
        .from('user_settings')
        .select('first_name, last_name')
        .eq('user_id', invite.inviter_id)
        .maybeSingle();

      const { data: goal } = await supabase
        .from('goals')
        .select('title, identity_statement, current_challenge_day, last_completion_date')
        .eq('user_id', invite.inviter_id)
        .eq('is_active', true)
        .maybeSingle();

      const displayName = settings
        ? `${settings.first_name || ''} ${settings.last_name || ''}`.trim()
        : 'Someone';

      setInviter({
        displayName: displayName || 'Someone',
        currentDay: goal?.current_challenge_day || 1,
        identityStatement: goal?.identity_statement || '',
        goalTitle: goal?.title || 'their journey',
        streak: goal?.current_challenge_day || 1,
        inviterId: invite.inviter_id,
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchFree = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        options: {
          data: { first_name: firstName, last_name: lastName },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('This email already has an account. Please sign in instead.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId || !inviter) return;

      await supabase.from('profiles').upsert({
        id: userId,
        display_name: name.trim(),
        username: email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.floor(Math.random() * 999),
        is_watcher: true,
        invited_by: inviter.inviterId,
      });

      await supabase.from('user_settings').upsert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email: email.trim().toLowerCase(),
      });

      await supabase.from('watchers').upsert({
        watcher_id: userId,
        watched_id: inviter.inviterId,
      });

      await supabase
        .from('watcher_invitations')
        .update({ accepted_by: userId, accepted_at: new Date().toISOString() })
        .eq('invite_code', inviteCode);

      await AsyncStorage.setItem(`@onboarding_completed_${userId}`, 'true');

      onWatcherReady(userId, inviter.inviterId);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#ccff00" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.notFoundTitle, { color: textPrimary }]}>Invite Not Found</Text>
        <Text style={[styles.notFoundSub, { color: textSecondary }]}>This invite link may have expired or is invalid.</Text>
        <TouchableOpacity style={styles.startOwnButton} onPress={onStartOwn}>
          <Text style={styles.startOwnButtonText}>Start My Own Journey</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'preview') {
    return (
      <LinearGradient colors={rootGradientPreview} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.eyeHeader}>
            <View style={styles.eyeCircle}>
              <Eye size={36} color="#ccff00" strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.inviteLabel}>YOU'VE BEEN INVITED</Text>
          <Text style={[styles.inviteHeadline, { color: textPrimary }]}>
            Watch {inviter?.displayName.split(' ')[0]}'s Journey
          </Text>

          <View style={[styles.journeyCard, { backgroundColor: secondaryBg }]}>
            <View style={styles.journeyCardHeader}>
              <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#1A1A1A' : colors.backgroundSecondary }]}>
                <Text style={styles.avatarLetter}>
                  {inviter?.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.journeyCardInfo}>
                <Text style={[styles.journeyName, { color: textPrimary }]}>{inviter?.displayName}</Text>
                <Text style={[styles.journeyGoal, { color: textSecondary }]} numberOfLines={1}>{inviter?.goalTitle}</Text>
              </View>
              <View style={[styles.dayBadge, { backgroundColor: isDark ? '#000000' : colors.background, borderColor }]}>
                <Text style={[styles.dayNumber, { color: textPrimary }]}>{inviter?.currentDay}</Text>
                <Text style={styles.dayLabel}>DAY</Text>
              </View>
            </View>

            {inviter?.identityStatement ? (
              <View style={styles.identityBox}>
                <Text style={[styles.identityQuote, { color: textPrimary }]}>"{inviter.identityStatement}"</Text>
              </View>
            ) : null}

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: borderColor }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(((inviter?.currentDay || 1) / 77) * 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressLabel, { color: textTertiary }]}>
                {inviter?.currentDay} of 77 days
              </Text>
            </View>
          </View>

          <Text style={[styles.watchDescription, { color: textSecondary }]}>
            Watch their progress for free. See their daily streaks, identity, and milestones as they happen.
          </Text>

          <TouchableOpacity style={styles.watchFreeButton} onPress={() => setStep('signup')}>
            <LinearGradient colors={['#ccff00', '#aed900']} style={styles.watchFreeGradient}>
              <Eye size={22} color="#000000" strokeWidth={2.5} />
              <Text style={styles.watchFreeText}>Watch {inviter?.displayName.split(' ')[0]} for Free</Text>
              <ArrowRight size={22} color="#000000" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
            <Text style={[styles.dividerText, { color: textTertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
          </View>

          <TouchableOpacity style={[styles.startOwnOutlineButton, { borderColor }]} onPress={onStartOwn}>
            <Zap size={20} color="#ccff00" strokeWidth={2.5} />
            <Text style={[styles.startOwnOutlineText, { color: textPrimary }]}>Start My Own 77-Day Journey</Text>
          </TouchableOpacity>

          <Text style={[styles.footer, { color: textMuted }]}>
            Inspired by what you see? You can always upgrade and start your own challenge later.
          </Text>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={rootGradientSignup} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setStep('preview')} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: textSecondary }]}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.eyeCircle}>
            <Eye size={32} color="#ccff00" strokeWidth={2} />
          </View>

          <Text style={[styles.signupTitle, { color: textPrimary }]}>Create Your Watcher Account</Text>
          <Text style={[styles.signupSubtitle, { color: textSecondary }]}>
            Just your name and email — no subscription needed to watch.
          </Text>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: textTertiary }]}>YOUR NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: cardBg, borderColor, color: textPrimary }]}
              placeholder="First and last name"
              placeholderTextColor={textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: textTertiary }]}>EMAIL ADDRESS</Text>
            <TextInput
              style={[styles.input, { backgroundColor: cardBg, borderColor, color: textPrimary }]}
              placeholder="you@example.com"
              placeholderTextColor={textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.watchFreeButton, submitting && styles.disabledButton]}
            onPress={handleWatchFree}
            disabled={submitting}
          >
            <LinearGradient colors={['#ccff00', '#aed900']} style={styles.watchFreeGradient}>
              {submitting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <>
                  <Eye size={20} color="#000000" strokeWidth={2.5} />
                  <Text style={styles.watchFreeText}>Start Watching for Free</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.legalText, { color: textMuted }]}>
            By continuing, you agree to receive updates about this journey. No spam, ever.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scrollContent: { padding: 28, paddingTop: 72, paddingBottom: 60 },
  eyeHeader: { alignItems: 'center', marginBottom: 28 },
  eyeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(204, 255, 0, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(204, 255, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 28,
  },
  inviteLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#ccff00',
    marginBottom: 10,
    textAlign: 'center',
  },
  inviteHeadline: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 32,
  },
  journeyCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 28,
  },
  journeyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '900', color: '#ccff00' },
  journeyCardInfo: { flex: 1 },
  journeyName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  journeyGoal: { fontSize: 13, fontWeight: '600', color: '#808080' },
  dayBadge: {
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dayNumber: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  dayLabel: { fontSize: 10, fontWeight: '800', color: '#ccff00', letterSpacing: 1 },
  identityBox: {
    backgroundColor: 'rgba(204, 255, 0, 0.06)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#ccff00',
    marginBottom: 20,
  },
  identityQuote: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  progressBarContainer: { gap: 8 },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ccff00',
    borderRadius: 3,
  },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#555', textAlign: 'right' },
  watchDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#808080',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  watchFreeButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  watchFreeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  watchFreeText: { fontSize: 17, fontWeight: '900', color: '#000000' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1A1A1A' },
  dividerText: { fontSize: 14, fontWeight: '600', color: '#555' },
  startOwnOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    marginBottom: 28,
  },
  startOwnOutlineText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  footer: {
    fontSize: 13,
    fontWeight: '500',
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: { marginBottom: 24 },
  backButtonText: { fontSize: 16, fontWeight: '700', color: '#808080' },
  signupTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  signupSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#808080',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  formGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#555',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    borderRadius: 14,
    padding: 18,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  disabledButton: { opacity: 0.6 },
  legalText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  notFoundTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  notFoundSub: {
    fontSize: 16,
    fontWeight: '600',
    color: '#808080',
    textAlign: 'center',
    marginBottom: 32,
  },
  startOwnButton: {
    backgroundColor: '#ccff00',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 14,
  },
  startOwnButtonText: { fontSize: 16, fontWeight: '900', color: '#000000' },
});
