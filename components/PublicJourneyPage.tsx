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
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Zap, Check, X, Send, ExternalLink } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChallengeWall from './ChallengeWall';
import { responsiveStyle } from '@/components/ResponsiveContainer';
import MonthWall from './MonthWall';
import { getDateForChallengeDay, getTodayDateString, toLocalDateString, parseLocalDate, getDayNumberFromChallengeStart } from '@/lib/dateHelpers';
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
  scheduledStartDate: string | null;
  activities: Activity[];
  todayCompletedIds: string[];
  completionDates: string[];
  realStreak: number;
  challengePhase: string;
  shareFullJourney: boolean;
  allowPublicEncouragements: boolean;
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
  const [showAllIdentity, setShowAllIdentity] = useState(false);

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
        .select('first_name, last_name, allow_public_encouragements')
        .eq('user_id', profile.id)
        .maybeSingle();

      const { data: goal } = await supabase
        .from('goals')
        .select('id, title, identity_statement, current_challenge_day, last_completion_date, challenge_start_date, challenge_phase, share_full_journey, scheduled_start_date')
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
        currentDay: getDayNumberFromChallengeStart(goal?.challenge_start_date ?? null, getTodayDateString()),
        identityStatement: goal?.identity_statement || '',
        goalTitle: goal?.title || 'their 77-day journey',
        lastCompletionDate: goal?.last_completion_date || null,
        challengeStartDate: goal?.challenge_start_date || null,
        scheduledStartDate: goal?.scheduled_start_date || null,
        activities,
        todayCompletedIds,
        completionDates,
        realStreak,
        challengePhase: goal?.challenge_phase || 'challenge',
        shareFullJourney: goal?.share_full_journey ?? true,
        allowPublicEncouragements: settings?.allow_public_encouragements ?? true,
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
              window.open('https://compoundtogreatness.com', '_blank');
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

  const isPreStart = !!journey?.scheduledStartDate && journey.scheduledStartDate > getTodayDateString();
  const preStartDaysUntil = (() => {
    if (!journey?.scheduledStartDate) return 0;
    const startDate = parseLocalDate(journey.scheduledStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const firstName = journey?.displayName.split(' ')[0] || 'They';
  const lastActiveInfo = getLastActiveInfo();

  const completedCount = journey?.todayCompletedIds.length || 0;
  const totalActivities = journey?.activities.length || 0;
  const identityLines = (journey?.identityStatement || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const visibleIdentityLines = showAllIdentity ? identityLines : identityLines.slice(0, 6);
  const hasMoreIdentityLines = identityLines.length > 6;

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandLockup}>
            <Image source={require('../assets/images/logo-mark-trimmed.png')} style={styles.brandMark} resizeMode="contain" />
            <View>
              <Text style={styles.brandName}>COMPOUND</Text>
              <Text style={styles.brandName}>TO GREATNESS</Text>
            </View>
          </View>
          <View style={styles.topBadge}>
            <Eye size={13} color="#CCFF00" strokeWidth={2.5} />
            <Text style={styles.topBadgeText}>LIVE JOURNEY</Text>
          </View>
        </View>

        <ImageBackground
          source={require('../assets/images/CleanCinematicMountainSunrise.png')}
          style={styles.heroCard}
          imageStyle={styles.heroCardImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.96)']}
            locations={[0, 0.58, 1]}
            style={styles.heroOverlay}
          >
            <View style={styles.heroProfileRow}>
              {journey?.photoUrl ? (
                <Image source={{ uri: journey.photoUrl }} style={styles.avatarCircle} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{journey?.displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.heroProfileCopy}>
                <Text style={styles.heroName}>{journey?.displayName}</Text>
                <View style={styles.activeTag}>
                  <View style={[styles.activeDot, lastActiveInfo.isActive && styles.activeDotLive]} />
                  <Text style={[styles.activeTagText, lastActiveInfo.isActive && styles.activeTagTextLive]}>
                    {lastActiveInfo.label}
                  </Text>
                </View>
              </View>
            </View>

            {isPreStart ? (
              <View style={styles.preStartPanel}>
                <Zap size={26} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
                <View>
                  <Text style={styles.preStartTitle}>STARTS IN {preStartDaysUntil} {preStartDaysUntil === 1 ? 'DAY' : 'DAYS'}</Text>
                  {journey?.scheduledStartDate ? (
                    <Text style={styles.preStartDate}>
                      {parseLocalDate(journey.scheduledStartDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.heroStatsCard}>
                <View style={styles.heroStatHalf}>
                  <View style={styles.statValueRow}>
                    <Zap size={28} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
                    <Text style={styles.statValue}>{journey?.realStreak ?? 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>CONSECUTIVE DAYS</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.heroStatHalf}>
                  <Text style={styles.dayValue}>DAY {journey?.currentDay || 0}</Text>
                  <Text style={styles.statLabel}>CURRENT CHALLENGE DAY · OF 77</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </ImageBackground>

        {journey?.shareFullJourney && journey?.identityStatement ? (
          <View style={styles.identitySection}>
            <Text style={styles.sectionEyebrow}>THIS IS WHO I AM</Text>
            <Text style={styles.identityHeadline}>BECOMING.</Text>
            <View style={styles.identityQuoteBlock}>
              <View style={styles.identityAccent} />
              <View style={styles.identityCopy}>
                {(visibleIdentityLines.length ? visibleIdentityLines : [journey.identityStatement]).map((line, index) => (
                  <Text key={`${line}-${index}`} style={styles.identityText}>{line}</Text>
                ))}
                {hasMoreIdentityLines ? (
                  <TouchableOpacity
                    onPress={() => setShowAllIdentity((value) => !value)}
                    activeOpacity={0.72}
                    style={styles.identityToggle}
                  >
                    <Text style={styles.identityToggleText}>{showAllIdentity ? 'SHOW LESS ↑' : `VIEW ALL ${identityLines.length} →`}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {!isPreStart && journey?.shareFullJourney && journey && journey.activities.length > 0 ? (
          <View style={styles.proofSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionEyebrow}>TODAY'S PROOF</Text>
              <Text style={styles.sectionMeta}>{completedCount} OF {totalActivities} COMPLETE</Text>
            </View>
            <View style={styles.stackCard}>
              {journey.activities.map((activity, index) => {
                const completed = journey.todayCompletedIds.includes(activity.id);
                return (
                  <View key={activity.id} style={[styles.stackRow, index < journey.activities.length - 1 && styles.stackRowBorder]}>
                    <View style={[styles.proofStatus, completed && styles.proofStatusDone]}>
                      {completed ? <Check size={16} color="#050505" strokeWidth={3} /> : null}
                    </View>
                    <Text style={[styles.stackActivityName, !completed && styles.stackActivityIncomplete]}>
                      {activity.activity_name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {!isPreStart && (
          <View style={styles.journeySection}>
            <Text style={styles.sectionEyebrow}>THE JOURNEY</Text>
            <Text style={styles.journeyHeadline}>
              {Math.max(journey?.realStreak ?? 0, 0)} DAYS{`\n`}<Text style={styles.limeText}>OF PROOF.</Text>
            </Text>
            <View style={styles.wallCard}>
              {journey?.challengePhase === 'keep_going' ? (
                <MonthWall goalId={journey.goalId} isLight={false} />
              ) : (
                <ChallengeWall
                  currentDay={journey?.currentDay || 0}
                  isDayCompleted={isDayCompleted}
                  isLight={false}
                />
              )}
            </View>
          </View>
        )}

        {journey?.allowPublicEncouragements && (
          <View style={styles.encouragementCard}>
            <View style={styles.encouragementIcon}>
              <Send size={20} color="#CCFF00" strokeWidth={2.5} />
            </View>
            <Text style={styles.encouragementHeadline}>THEY'VE KEPT THE PROMISE{`\n`}FOR {journey?.realStreak ?? 0} STRAIGHT DAYS.</Text>
            <Text style={styles.encouragementSub}>Give them a push to keep going.</Text>
            <TouchableOpacity style={styles.encourageButton} onPress={() => setShowEncourageModal(true)} activeOpacity={0.86}>
              <LinearGradient colors={['#CCFF00', '#B8E600']} style={styles.encourageGradient}>
                <Send size={19} color="#050505" strokeWidth={2.5} />
                <Text style={styles.encourageText}>Send Encouragement</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <ImageBackground
          source={require('../assets/images/CleanCinematicMountainSunriseCard.png')}
          style={styles.startCard}
          imageStyle={styles.startCardImage}
          resizeMode="cover"
        >
          <LinearGradient colors={['rgba(5,5,5,0.98)', 'rgba(5,5,5,0.84)', 'rgba(5,5,5,0.38)']} style={styles.startCardOverlay}>
            <Text style={styles.startCardEyebrow}>YOUR TURN</Text>
            <Text style={styles.startCardHeadline}>WHAT COULD{`\n`}CHANGE IN YOUR{`\n`}<Text style={styles.limeText}>NEXT 77 DAYS?</Text></Text>
            <Text style={styles.startCardBody}>Choose who you're becoming. Define the daily inputs. Then prove it one day at a time.</Text>
            <TouchableOpacity
              style={styles.startOwnOutline}
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.open('https://compoundtogreatness.com', '_blank');
                }
              }}
              activeOpacity={0.86}
            >
              <Zap size={18} color="#CCFF00" fill="#CCFF00" strokeWidth={2} />
              <Text style={styles.startOwnOutlineText}>Start My 77-Day Journey</Text>
              <ExternalLink size={15} color="#777" strokeWidth={2} />
            </TouchableOpacity>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.footerBrand}>
          <Text style={styles.footerBrandName}>COMPOUND TO GREATNESS</Text>
          <Text style={styles.footerTagline}>SMALL INPUTS. EXPONENTIAL LIFE.</Text>
        </View>
      </ScrollView>

      {journey?.allowPublicEncouragements && (
        <EncourageModal
          visible={showEncourageModal}
          onClose={() => setShowEncourageModal(false)}
          watchedUserId={journey?.userId || ''}
          watchedName={firstName}
        />
      )}
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

      supabase.functions
        .invoke('tag-journey-lead', {
          body: { email: email.trim().toLowerCase(), name: name.trim() },
        })
        .catch(() => {});

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
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      transparent
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheet, responsiveStyle.sheet, { backgroundColor: sheetBg, borderColor }]}>
          {Platform.OS !== 'web' && (
            <View style={[styles.dragHandle, { backgroundColor: dragBg }]} />
          )}

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
                  returnKeyType="done"
                  blurOnSubmit={true}
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
  outerContainer: { flex: 1, backgroundColor: '#050505' },
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notFoundTitle: { fontSize: 28, fontWeight: '900', fontFamily: 'Inter-Black', textAlign: 'center', marginBottom: 12 },
  notFoundSub: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter-Bold', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 72, maxWidth: 560, alignSelf: 'center', width: '100%' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 26, height: 34 },
  brandName: { color: '#FFFFFF', fontFamily: 'Inter-Black', fontWeight: '900', fontSize: 10, lineHeight: 11, letterSpacing: 1.2 },
  topBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(204,255,0,0.08)', borderWidth: 1, borderColor: 'rgba(204,255,0,0.35)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  topBadgeText: { fontSize: 10, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 1.7, color: '#CCFF00' },
  heroCard: { minHeight: 390, borderRadius: 28, overflow: 'hidden', marginBottom: 44, backgroundColor: '#111' },
  heroCardImage: { borderRadius: 28 },
  heroOverlay: { flex: 1, padding: 24, justifyContent: 'flex-end' },
  heroProfileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  heroProfileCopy: { flex: 1, marginLeft: 14 },
  avatarCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#111', borderWidth: 2, borderColor: '#CCFF00', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 28, fontWeight: '900', fontFamily: 'Inter-Black', color: '#CCFF00' },
  heroName: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', fontFamily: 'Inter-Black', marginBottom: 6 },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#555' },
  activeDotLive: { backgroundColor: '#CCFF00' },
  activeTagText: { color: '#777', fontSize: 12, fontWeight: '700', fontFamily: 'Inter-Bold' },
  activeTagTextLive: { color: '#CCFF00' },
  heroStatsCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(204,255,0,0.20)', backgroundColor: 'rgba(5,5,5,0.78)', overflow: 'hidden' },
  heroStatHalf: { flex: 1, minHeight: 118, alignItems: 'center', justifyContent: 'center', padding: 16 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { color: '#FFFFFF', fontSize: 52, lineHeight: 56, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: -1.5 },
  dayValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', fontFamily: 'Inter-Black' },
  statLabel: { color: '#6E6E6E', fontSize: 10, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 1.5, marginTop: 4 },
  statDivider: { width: 1, marginVertical: 20, backgroundColor: 'rgba(255,255,255,0.10)' },
  preStartPanel: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(204,255,0,0.2)', backgroundColor: 'rgba(5,5,5,0.8)', padding: 20 },
  preStartTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', fontFamily: 'Inter-Black' },
  preStartDate: { color: '#777', fontSize: 12, fontWeight: '700', fontFamily: 'Inter-Bold', marginTop: 4 },
  identitySection: { marginBottom: 48, paddingHorizontal: 4 },
  sectionEyebrow: { color: '#CCFF00', fontSize: 10, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 2.1 },
  identityHeadline: { color: '#CCFF00', fontSize: 46, lineHeight: 48, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: -1, marginTop: 8, marginBottom: 24 },
  identityQuoteBlock: { flexDirection: 'row' },
  identityAccent: { width: 3, borderRadius: 2, backgroundColor: '#CCFF00', marginRight: 16 },
  identityCopy: { flex: 1, gap: 8 },
  identityToggle: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6, paddingRight: 12 },
  identityToggleText: { color: '#CCFF00', fontSize: 10, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 1.4 },
  identityText: { color: '#F4F4F4', fontSize: 17, lineHeight: 25, fontWeight: '700', fontFamily: 'Inter-Bold', fontStyle: 'italic' },
  proofSection: { marginBottom: 52 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionMeta: { color: '#777', fontSize: 10, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 1 },
  stackCard: { borderRadius: 24, paddingHorizontal: 18, borderWidth: 1, borderColor: '#202020', backgroundColor: '#0B0B0B', overflow: 'hidden' },
  stackRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingVertical: 13 },
  stackRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1C1C1C' },
  proofStatus: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#414141', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  proofStatusDone: { backgroundColor: '#CCFF00', borderColor: '#CCFF00' },
  stackActivityName: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, fontWeight: '800', fontFamily: 'Inter-Bold', flex: 1 },
  stackActivityIncomplete: { color: '#686868' },
  journeySection: { marginBottom: 42 },
  journeyHeadline: { color: '#FFFFFF', fontSize: 48, lineHeight: 47, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: -1.2, marginTop: 10, marginBottom: 24 },
  limeText: { color: '#CCFF00' },
  wallCard: { borderRadius: 26, borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#0A0A0A', paddingVertical: 24, paddingHorizontal: 0, overflow: 'visible' },
  encouragementCard: { borderRadius: 26, borderWidth: 1, borderColor: '#1E1E1E', backgroundColor: '#0B0B0B', padding: 24, alignItems: 'center', marginBottom: 24 },
  encouragementIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(204,255,0,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  encouragementHeadline: { color: '#FFFFFF', fontSize: 26, lineHeight: 29, fontWeight: '900', fontFamily: 'Inter-Black', textAlign: 'center', letterSpacing: -0.4 },
  encouragementSub: { color: '#777', fontSize: 14, fontWeight: '600', fontFamily: 'Inter-Bold', marginTop: 8, marginBottom: 20, textAlign: 'center' },
  encourageButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  encourageGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 18 },
  encourageText: { fontSize: 16, fontWeight: '900', fontFamily: 'Inter-Black', color: '#050505' },
  startCard: { minHeight: 390, borderRadius: 28, overflow: 'hidden', marginBottom: 40, backgroundColor: '#111' },
  startCardImage: { borderRadius: 28 },
  startCardOverlay: { flex: 1, justifyContent: 'center', padding: 26 },
  startCardEyebrow: { color: '#CCFF00', fontSize: 10, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 2, marginBottom: 12 },
  startCardHeadline: { color: '#FFFFFF', fontSize: 37, lineHeight: 38, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: -0.8 },
  startCardBody: { color: '#A0A0A0', fontSize: 14, lineHeight: 21, fontWeight: '600', fontFamily: 'Inter-Bold', maxWidth: 330, marginTop: 16, marginBottom: 22 },
  startOwnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#333', backgroundColor: 'rgba(0,0,0,0.72)' },
  startOwnOutlineText: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '900', fontFamily: 'Inter-Black', textAlign: 'center' },
  startOwnButton: { borderRadius: 16, overflow: 'hidden' },
  startOwnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  startOwnText: { fontSize: 17, fontWeight: '900', fontFamily: 'Inter-Black', color: '#000000' },
  footerBrand: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  footerBrandName: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', fontFamily: 'Inter-Black', letterSpacing: 1.8 },
  footerTagline: { color: '#444', fontSize: 9, fontWeight: '800', fontFamily: 'Inter-Black', letterSpacing: 1.6, marginTop: 7 },
  modalOverlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', backgroundColor: 'rgba(0,0,0,0.78)', paddingHorizontal: Platform.OS === 'web' ? 20 : 0 },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: Platform.OS === 'web' ? 28 : 0, borderBottomRightRadius: Platform.OS === 'web' ? 28 : 0, padding: 28, paddingBottom: Platform.OS === 'web' ? 28 : 48, borderWidth: Platform.OS === 'web' ? 1 : 0, borderTopWidth: 1 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 24, fontWeight: '900', fontFamily: 'Inter-Black' },
  modalClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalSub: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter-Bold', lineHeight: 22, marginBottom: 24 },
  formGroup: { marginBottom: 18 },
  fieldLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter-Black', letterSpacing: 1.5, marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 16, fontSize: 15, fontWeight: '600', fontFamily: 'Inter-Bold' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter-Bold', color: '#EF4444', textAlign: 'center', marginBottom: 14 },
  submitButton: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  submitText: { fontSize: 16, fontWeight: '900', fontFamily: 'Inter-Black', color: '#000000' },
  disabledButton: { opacity: 0.6 },
  legalText: { fontSize: 12, fontWeight: '500', fontFamily: 'Inter-Bold', textAlign: 'center' },
  doneState: { alignItems: 'center', paddingVertical: 20, gap: 16 },
  doneCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(204,255,0,0.1)', borderWidth: 2, borderColor: 'rgba(204,255,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 28, fontWeight: '900', fontFamily: 'Inter-Black' },
  doneSub: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter-Bold', textAlign: 'center', lineHeight: 22 },
  doneCloseButton: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  doneCloseText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter-Bold' },
});
