import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Zap, Check, X, Send, ExternalLink } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChallengeWall from './ChallengeWall';
import MonthWall from './MonthWall';
import { getDateForChallengeDay, getTodayDateString, toLocalDateString } from '@/lib/dateHelpers';
import { computeCurrentStreak } from '@/lib/streakHelpers';

interface Activity {
  id: string;
  activity_name: string;
  order_position: number;
}

interface JourneyData {
  userId: string;
  goalId: string;
  displayName: string;
  currentDay: number;
  identityStatement: string;
  goalTitle: string;
  lastCompletionDate: string | null;
  challengeStartDate: string | null;
  activities: Activity[];
  todayCompletedIds: string[];
  completionDates: string[];
  realStreak: number;
  challengePhase: string;
  shareFullJourney: boolean;
  photoUrl: string | null;
}

interface Props {
  username: string;
}

export default function PublicJourneyPage({ username }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEncourageModal, setShowEncourageModal] = useState(false);

  useEffect(() => {
    loadJourney();
  }, [username]);

  const loadJourney = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, username, photo_url')
        .ilike('username', username)
        .maybeSingle();

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: settings } = await supabase
        .from('user_settings')
        .select('first_name, last_name')
        .eq('user_id', profile.id)
        .maybeSingle();

      const { data: goal } = await supabase
        .from('goals')
        .select('id, title, identity_statement, current_challenge_day, last_completion_date, challenge_start_date, challenge_phase, share_full_journey')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      let activities: Activity[] = [];
      let todayCompletedIds: string[] = [];
      let completionDates: string[] = [];

      if (goal?.id) {
        const today = getTodayDateString();
        const [actsRes, todayCompletionRes, allCompletionsRes] = await Promise.all([
          supabase
            .from('daily_activities')
            .select('id, activity_name, order_position')
            .eq('goal_id', goal.id)
            .order('order_position', { ascending: true }),
          supabase
            .from('daily_completions')
            .select('activities_completed')
            .eq('goal_id', goal.id)
            .eq('completion_date', today)
            .maybeSingle(),
          supabase
            .from('daily_completions')
            .select('completion_date')
            .eq('goal_id', goal.id)
            .not('completed_at', 'is', null)
            .order('completion_date', { ascending: false })
            .limit(100),
        ]);

        activities = actsRes.data || [];

        if (todayCompletionRes.data?.activities_completed) {
          todayCompletedIds = Array.isArray(todayCompletionRes.data.activities_completed)
            ? todayCompletionRes.data.activities_completed
            : [];
        }

        completionDates = (allCompletionsRes.data || []).map((c) => c.completion_date);
      }

      let realStreak = 0;
      if (goal?.id) {
        realStreak = await computeCurrentStreak(goal.id);
      }

      const displayName = settings
        ? `${settings.first_name || ''} ${settings.last_name || ''}`.trim()
        : profile.display_name;

      setJourney({
        userId: profile.id,
        goalId: goal?.id || '',
        displayName: displayName || profile.display_name || 'This person',
        currentDay: goal?.current_challenge_day || 0,
        identityStatement: goal?.identity_statement || '',
        goalTitle: goal?.title || 'their 77-day journey',
        lastCompletionDate: goal?.last_completion_date || null,
        challengeStartDate: goal?.challenge_start_date || null,
        activities,
        todayCompletedIds,
        completionDates,
        realStreak,
        challengePhase: goal?.challenge_phase || 'challenge',
        shareFullJourney: goal?.share_full_journey ?? true,
        photoUrl: profile.photo_url || null,
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const getLastActiveInfo = (): { label: string; isActive: boolean } => {
    if (!journey?.lastCompletionDate) {
      return { label: 'Just getting started', isActive: false };
    }
    const today = getTodayDateString();
    const yesterday = toLocalDateString(new Date(Date.now() - 86400000));
    if (journey.lastCompletionDate === today) {
      return { label: 'Active today ✓', isActive: true };
    }
    if (journey.lastCompletionDate === yesterday) {
      return { label: 'Active yesterday', isActive: false };
    }
    const diffMs = new Date(today).getTime() - new Date(journey.lastCompletionDate).getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    return { label: `Last active ${diffDays} days ago`, isActive: false };
  };

  const isDayCompleted = (day: number): boolean => {
    if (!journey?.completionDates || journey.completionDates.length === 0) return false;
    if (!journey.goalId) return false;
    const dateForDay = getDateForChallengeDay(journey.challengeStartDate, day);
    return journey.completionDates.includes(dateForDay);
  };

  const bg = isDark ? '#000000' : colors.background;
  const cardBg = isDark ? '#0A0A0A' : colors.card;
  const secondaryBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const textPrimary = isDark ? '#FFFFFF' : colors.text;
  const textSecondary = isDark ? '#555' : colors.textSecondary;
  const textTertiary = isDark ? '#444' : colors.textTertiary;
  const borderColor = isDark ? '#1A1A1A' : colors.border;

  if (loading) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#ccff00" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: bg }]}>
        <Text style={[styles.notFoundTitle, { color: textPrimary }]}>Journey not found</Text>
        <Text style={[styles.notFoundSub, { color: textSecondary }]}>
          This link may have expired or the username doesn't exist.
        </Text>
        <TouchableOpacity
          style={styles.startOwnButton}
          onPress={() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.open('https://apps.apple.com/app/your-app-id', '_blank');
            }
          }}
        >
          <LinearGradient colors={['#ccff00', '#aed900']} style={styles.startOwnGradient}>
            <Zap size={20} color="#000" strokeWidth={2.5} />
            <Text style={styles.startOwnText}>Start My 77-Day Journey</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const firstName = journey?.displayName.split(' ')[0] || 'They';
  const lastActiveInfo = getLastActiveInfo();

  return (
    <View style={[styles.outerContainer, { backgroundColor: bg }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBadge}>
          <Eye size={14} color="#ccff00" strokeWidth={2.5} />
          <Text style={styles.topBadgeText}>LIVE JOURNEY</Text>
        </View>

        <View style={styles.heroSection}>
          {journey?.photoUrl ? (
            <Image source={{ uri: journey.photoUrl }} style={styles.avatarCircle} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {journey?.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.heroName, { color: textPrimary }]}>{journey?.displayName}</Text>
          <View style={styles.activeTag}>
            <View style={[styles.activeDot, lastActiveInfo.isActive && styles.activeDotLive, !lastActiveInfo.isActive && { backgroundColor: isDark ? '#444' : colors.border }]} />
            <Text style={[styles.activeTagText, { color: textSecondary }, lastActiveInfo.isActive && styles.activeTagTextLive]}>
              {lastActiveInfo.label}
            </Text>
          </View>
        </View>

        <View style={[styles.dayCard, { borderColor: 'rgba(204, 255, 0, 0.2)' }]}>
          <LinearGradient
            colors={['rgba(204, 255, 0, 0.1)', 'rgba(204, 255, 0, 0.03)']}
            style={styles.dayCardInner}
          >
            <View style={styles.streakHeroRow}>
              <Zap size={40} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
              <Text style={[styles.streakNumber, { color: textPrimary }]}>
                {journey?.realStreak ?? 0}
              </Text>
            </View>
            <Text style={[styles.streakLabel, { color: textSecondary }]}>DAY STREAK</Text>
          </LinearGradient>
        </View>

        {journey?.shareFullJourney && journey?.identityStatement ? (
          <View style={styles.identitySection}>
            <Text style={styles.becomingLabel}>BECOMING</Text>
            <Text style={[styles.identityText, { color: textPrimary }]}>"{journey.identityStatement}"</Text>
          </View>
        ) : null}

        {journey?.shareFullJourney && journey && journey.activities.length > 0 ? (
          <View style={[styles.stackCard, { backgroundColor: cardBg, borderColor }]}>
            <Text style={styles.stackLabel}>DAILY SUCCESS STACK</Text>
            {journey.activities.map((activity) => {
              const completed = journey.todayCompletedIds.includes(activity.id);
              return (
                <View key={activity.id} style={styles.stackRow}>
                  <Text style={[styles.stackActivityName, { color: textTertiary }, completed && { color: textPrimary }]}>
                    {activity.activity_name}
                  </Text>
                  <View style={styles.checkmarkContainer}>
                    {completed ? (
                      <View style={styles.checkmarkCircleInner}>
                        <Check size={24} color="#000000" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={[styles.uncheckedCircleInner, { borderColor }]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {journey?.challengePhase === 'keep_going' ? (
          <MonthWall goalId={journey.goalId} isLight={!isDark} />
        ) : (
          <ChallengeWall
            currentDay={journey?.currentDay || 0}
            isDayCompleted={isDayCompleted}
            isLight={!isDark}
          />
        )}

        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.encourageButton}
            onPress={() => setShowEncourageModal(true)}
          >
            <LinearGradient colors={['#ccff00', '#aed900']} style={styles.encourageGradient}>
              <Send size={20} color="#000000" strokeWidth={2.5} />
              <Text style={styles.encourageText}>Send Encouragement</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
            <Text style={[styles.dividerText, { color: textTertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: borderColor }]} />
          </View>

          <TouchableOpacity
            style={[styles.startOwnOutline, { borderColor }]}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open('https://apps.apple.com/app/your-app-id', '_blank');
              }
            }}
          >
            <Zap size={20} color="#ccff00" strokeWidth={2.5} />
            <Text style={[styles.startOwnOutlineText, { color: textPrimary }]}>Start My Own 77-Day Journey</Text>
            <ExternalLink size={16} color={textTertiary} strokeWidth={2} />
          </TouchableOpacity>

          <Text style={[styles.footerNote, { color: textTertiary }]}>
            {firstName} is building who they're becoming — one day at a time. Inspired? Start your own 77-day journey.
          </Text>
        </View>
      </ScrollView>

      <EncourageModal
        visible={showEncourageModal}
        onClose={() => setShowEncourageModal(false)}
        watchedUserId={journey?.userId || ''}
        watchedName={firstName}
      />
    </View>
  );
}

interface EncourageModalProps {
  visible: boolean;
  onClose: () => void;
  watchedUserId: string;
  watchedName: string;
}

function EncourageModal({ visible, onClose, watchedUserId, watchedName }: EncourageModalProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
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
      await supabase.from('journey_leads').insert({
        watched_user_id: watchedUserId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim() || null,
      });
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setMessage('');
    setError('');
    setDone(false);
    onClose();
  };

  const sheetBg = isDark ? '#0A0A0A' : colors.card;
  const borderColor = isDark ? '#1A1A1A' : colors.border;
  const textPrimary = isDark ? '#FFFFFF' : colors.text;
  const textSecondary = isDark ? '#555' : colors.textSecondary;
  const textTertiary = isDark ? '#444' : colors.textTertiary;
  const inputBg = isDark ? '#111' : colors.backgroundSecondary;
  const dragBg = isDark ? '#2A2A2A' : colors.border;
  const closeBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const doneCloseBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheet, { backgroundColor: sheetBg, borderColor }]}>
          <View style={[styles.dragHandle, { backgroundColor: dragBg }]} />

          <View style={styles.modalTopRow}>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>
              {done ? 'Sent!' : `Encourage ${watchedName}`}
            </Text>
            <TouchableOpacity onPress={handleClose} style={[styles.modalClose, { backgroundColor: closeBg }]}>
              <X size={20} color={textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {done ? (
            <View style={styles.doneState}>
              <View style={styles.doneCircle}>
                <Check size={36} color="#ccff00" strokeWidth={2.5} />
              </View>
              <Text style={[styles.doneTitle, { color: textPrimary }]}>Encouragement Sent!</Text>
              <Text style={[styles.doneSub, { color: textSecondary }]}>
                {watchedName} will see your support. Every bit of accountability matters.
              </Text>
              <TouchableOpacity style={[styles.doneCloseButton, { backgroundColor: doneCloseBg }]} onPress={handleClose}>
                <Text style={[styles.doneCloseText, { color: textPrimary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.modalSub, { color: textSecondary }]}>
                Leave your name and email to send {watchedName} a boost — and we'll keep you
                updated on their progress.
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>YOUR NAME</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  placeholder="First and last name"
                  placeholderTextColor={textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>EMAIL ADDRESS</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  placeholder="you@example.com"
                  placeholderTextColor={textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>MESSAGE (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: inputBg, borderColor, color: textPrimary }]}
                  placeholder={`"Keep going, ${watchedName}! You've got this."`}
                  placeholderTextColor={textTertiary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <LinearGradient colors={['#ccff00', '#aed900']} style={styles.submitGradient}>
                  {submitting ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Send size={18} color="#000" strokeWidth={2.5} />
                      <Text style={styles.submitText}>Send Encouragement</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.legalText, { color: textTertiary }]}>No spam, ever. Just updates on this journey.</Text>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  fullCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  notFoundTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    textAlign: 'center',
    marginBottom: 12,
  },
  notFoundSub: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 64,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 32,
  },
  topBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 2,
    color: '#ccff00',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#ccff00',
  },
  heroName: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    textAlign: 'center',
    marginBottom: 8,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  activeDotLive: {
    backgroundColor: '#ccff00',
  },
  activeTagText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  activeTagTextLive: {
    color: '#ccff00',
  },
  dayCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 20,
  },
  dayCardInner: { padding: 22, alignItems: 'center' },
  streakHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  streakNumber: {
    fontSize: 80,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: -2,
    textAlign: 'center',
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    marginTop: 2,
    marginBottom: 4,
  },
  identitySection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  becomingLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 2,
    color: '#ccff00',
    marginBottom: 10,
  },
  identityText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  stackCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  stackLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 2,
    color: '#ccff00',
    marginBottom: 16,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    minHeight: 72,
  },
  checkmarkContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmarkCircleInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ccff00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckedCircleInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  stackActivityName: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    flex: 1,
    paddingRight: 12,
  },
  ctaSection: { gap: 0 },
  encourageButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  encourageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  encourageText: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  startOwnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  startOwnOutlineText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    textAlign: 'center',
  },
  startOwnButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  startOwnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
  },
  startOwnText: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
  },
  footerNote: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
    borderTopWidth: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSub: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    lineHeight: 22,
    marginBottom: 24,
  },
  formGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 14,
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
  },
  disabledButton: { opacity: 0.6 },
  legalText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  doneState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  doneCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(204, 255, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  doneSub: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneCloseButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneCloseText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
});
