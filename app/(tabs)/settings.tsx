import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Platform,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sun,
  Moon,
  Bell,
  BellOff,
  ImagePlus,
  LogOut,
  Share2,
  Play,
  RefreshCw,
  Sparkles,
  Archive,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import SignupSplashScreen from '@/components/SignupSplashScreen';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { UserSettings, Goal } from '@/types/database';
import { archiveCurrentChallenge } from '@/lib/archiveHelpers';
import { resetChallenge } from '@/lib/resetHelpers';
import {
  ProfilePhotoSection,
  ProfileInput,
  GlassPanel,
  ToggleRow,
  DayEndTimePicker,
  ActionRow,
} from '@/components/SettingsComponents';
import GracePeriodModal from '@/components/GracePeriodModal';
import {
  requestNotificationPermissions,
  scheduleDailyReminders,
} from '@/lib/notifications';
import { CHALLENGE_RULES } from '@/constants/challengeRules';
import { BookOpen } from 'lucide-react-native';

const ONBOARDING_KEY = '@onboarding_completed';

export default function SettingsScreen() {
  const { theme, toggleTheme, colors, isDark } = useTheme();
  const { user, signOut: authSignOut } = useAuth();
  const router = useRouter();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dayEndTime, setDayEndTime] = useState('12:00 AM');
  const [morningNotifications, setMorningNotifications] = useState(true);
  const [eveningNotifications, setEveningNotifications] = useState(true);
  const [saveProgressPhotos, setSaveProgressPhotos] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [challengeActionLoading, setChallengeActionLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadActiveGoal();
  }, []);

  const loadSettings = async () => {
    if (!user) return;
    try {
      // Load persisted profile photo
      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.photo_url) {
        setProfilePhoto(profile.photo_url);
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettingsId(data.id);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setEmail(data.email || user.email || '');
        setDayEndTime(data.day_end_time || '12:00 AM');
        setMorningNotifications(data.morning_notifications);
        setEveningNotifications(data.evening_notifications);
        setSaveProgressPhotos(data.save_progress_photos);
      } else {
        const metadata = user.user_metadata || {};
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            first_name: metadata.first_name || '',
            last_name: metadata.last_name || '',
            email: user.email || '',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newSettings) {
          setSettingsId(newSettings.id);
          setFirstName(newSettings.first_name || '');
          setLastName(newSettings.last_name || '');
          setEmail(newSettings.email || user.email || '');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadActiveGoal = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      setActiveGoal(data);
    } catch {}
  };

  const handleRunItAgain = () => {
    if (!activeGoal) return;
    const confirmAction = async () => {
      setChallengeActionLoading(true);
      try {
        await resetChallenge(activeGoal, supabase, 'restarted');
        // Also clear challenge_phase + celebration_seen which resetChallenge doesn't touch.
        await supabase
          .from('goals')
          .update({
            challenge_phase: 'challenge',
            celebration_seen: false,
            grace_period_prompted_date: null,
          })
          .eq('id', activeGoal.id);
        await loadActiveGoal();
      } catch (err) {
        console.error('Error running again:', err);
      } finally {
        setChallengeActionLoading(false);
      }
    };

    if (Platform.OS !== 'web') {
      Alert.alert(
        'Run It Again',
        'This will archive your current progress and restart the 77-day challenge from Day 1. Your identity, compass, and daily activities stay the same.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restart', onPress: confirmAction },
        ]
      );
    } else {
      confirmAction();
    }
  };

  const handleStartFresh = () => {
    if (!activeGoal || !user) return;
    const confirmAction = async () => {
      setChallengeActionLoading(true);
      try {
        await archiveCurrentChallenge(activeGoal, supabase, 'started_fresh');
        await supabase
          .from('goals')
          .update({ is_active: false })
          .eq('id', activeGoal.id);
        await AsyncStorage.removeItem(`${ONBOARDING_KEY}_${user.id}`);
        setActiveGoal(null);
      } catch (err) {
        console.error('Error starting fresh:', err);
      } finally {
        setChallengeActionLoading(false);
      }
    };

    if (Platform.OS !== 'web') {
      Alert.alert(
        'Start Fresh',
        'This will archive your current challenge and take you back through the full identity builder to start over from scratch. Your archived challenge history will be preserved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Fresh', style: 'destructive', onPress: confirmAction },
        ]
      );
    } else {
      confirmAction();
    }
  };

  const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!settingsId) return;
    try {
      await supabase
        .from('user_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', settingsId);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settingsId]);

  const handleFirstNameChange = (value: string) => {
    setFirstName(value);
    saveSettings({ first_name: value });
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);
    saveSettings({ last_name: value });
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    saveSettings({ email: value });
  };

  const handleDayEndTimeSelect = (time: string) => {
    setDayEndTime(time);
    setShowTimePicker(false);
    saveSettings({ day_end_time: time });
  };

  const handleMorningNotificationsToggle = async (value: boolean) => {
    setMorningNotifications(value);
    saveSettings({ morning_notifications: value });
    const granted = await requestNotificationPermissions();
    if (granted) {
      await scheduleDailyReminders(value, eveningNotifications);
    }
  };

  const handleEveningNotificationsToggle = async (value: boolean) => {
    setEveningNotifications(value);
    saveSettings({ evening_notifications: value });
    const granted = await requestNotificationPermissions();
    if (granted) {
      await scheduleDailyReminders(morningNotifications, value);
    }
  };

  const handleSaveProgressPhotosToggle = (value: boolean) => {
    setSaveProgressPhotos(value);
    saveSettings({ save_progress_photos: value });
  };

  const uploadProfilePhoto = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    setPhotoError(null);
    try {
      const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, photo_url: publicUrl }, { onConflict: 'id' });

      if (upsertError) throw upsertError;

      setProfilePhoto(publicUrl);
    } catch (err: any) {
      setPhotoError(err?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    setShowPhotoOptions(false);
    if (Platform.OS !== 'web') {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setPhotoError('Permission to access photo library is required.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    setShowPhotoOptions(false);
    if (Platform.OS === 'web') {
      // Camera capture not available on web — fall back to file picker
      await pickImage();
      return;
    }
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      setPhotoError('Permission to access camera is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0].uri);
    }
  };

  const handlePhotoOptions = () => {
    setPhotoError(null);
    setShowPhotoOptions(true);
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: Platform.OS === 'ios'
          ? 'Check out Compound to Greatness - a 77-day challenge app that helps you build unstoppable habits!'
          : 'Check out Compound to Greatness - a 77-day challenge app that helps you build unstoppable habits! Download it now.',
        title: 'Compound to Greatness',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [showSplashPreview, setShowSplashPreview] = useState(false);
  const [showGracePeriodPreview, setShowGracePeriodPreview] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const handleSignOut = () => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                await authSignOut();
              } catch (error) {
                console.error('Error signing out:', error);
              }
            },
          },
        ]
      );
    } else {
      setConfirmingSignOut(true);
    }
  };

  const handleConfirmSignOut = async () => {
    setConfirmingSignOut(false);
    try {
      await authSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
    {showSplashPreview && (
      <SignupSplashScreen onComplete={() => setShowSplashPreview(false)} />
    )}
    <GracePeriodModal
      visible={showGracePeriodPreview}
      daysMissed={2}
      onKeepGoing={() => setShowGracePeriodPreview(false)}
      onStartOver={() => setShowGracePeriodPreview(false)}
    />
    <Modal visible={showRulesModal} transparent animationType="fade" statusBarTranslucent>
      <View style={rulesModalStyles.overlay}>
        <View style={[rulesModalStyles.card, { backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF', borderColor: isDark ? colors.border : '#E0E0DB' }]}>
          <Text style={[rulesModalStyles.eyebrow, { color: colors.primary }]}>THE RULES</Text>
          <Text style={[rulesModalStyles.title, { color: colors.text }]}>Challenge Rules</Text>
          <View style={rulesModalStyles.rulesList}>
            {CHALLENGE_RULES.map((rule, i) => (
              <View key={i} style={rulesModalStyles.ruleRow}>
                <Text style={[rulesModalStyles.ruleNum, { color: colors.primary }]}>{i + 1}.</Text>
                <Text style={[rulesModalStyles.ruleText, { color: colors.textSecondary }]}>{rule}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[rulesModalStyles.closeBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowRulesModal(false)}
            activeOpacity={0.85}
          >
            <Text style={rulesModalStyles.closeBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>

        <View style={styles.content}>
          <ProfilePhotoSection
            profilePhoto={profilePhoto}
            uploading={uploading}
            onPress={handlePhotoOptions}
            colors={colors}
          />

          {showPhotoOptions && (
            <View style={[styles.photoOptionsPanel, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              {Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.photoOption} onPress={takePhoto} activeOpacity={0.7}>
                  <Text style={[styles.photoOptionText, { color: colors.primary }]}>Take Photo</Text>
                </TouchableOpacity>
              )}
              {Platform.OS !== 'web' && (
                <View style={[styles.photoOptionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
              )}
              <TouchableOpacity style={styles.photoOption} onPress={pickImage} activeOpacity={0.7}>
                <Text style={[styles.photoOptionText, { color: colors.primary }]}>Choose from Library</Text>
              </TouchableOpacity>
              <View style={[styles.photoOptionDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
              <TouchableOpacity style={styles.photoOption} onPress={() => setShowPhotoOptions(false)} activeOpacity={0.7}>
                <Text style={[styles.photoOptionText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {photoError && (
            <Text style={[styles.photoError, { color: colors.error }]}>{photoError}</Text>
          )}

          <Text style={[styles.profileName, { color: colors.text }]}>
            {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Your Name'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textTertiary }]}>
            {email || 'Add your email'}
          </Text>

          <GlassPanel isDark={isDark} colors={colors}>
            <ProfileInput label="First" value={firstName} onChangeText={handleFirstNameChange} placeholder="First name" colors={colors} isDark={isDark} isFirst isLast={false} />
            <ProfileInput label="Last" value={lastName} onChangeText={handleLastNameChange} placeholder="Last name" colors={colors} isDark={isDark} isLast={false} />
            <ProfileInput label="Email" value={email} onChangeText={handleEmailChange} placeholder="email@example.com" colors={colors} isDark={isDark} keyboardType="email-address" autoCapitalize="none" isLast />
          </GlassPanel>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SCHEDULE</Text>
          <GlassPanel isDark={isDark} colors={colors}>
            <DayEndTimePicker
              selectedTime={dayEndTime}
              onSelect={handleDayEndTimeSelect}
              showPicker={showTimePicker}
              onTogglePicker={() => setShowTimePicker(!showTimePicker)}
              colors={colors}
              isDark={isDark}
            />
          </GlassPanel>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>NOTIFICATIONS</Text>
          <GlassPanel isDark={isDark} colors={colors}>
            <ToggleRow
              icon={<Bell size={18} color={colors.primary} strokeWidth={2} />}
              title="Morning Reminder"
              description="Daily push at 8:00 AM"
              value={morningNotifications}
              onValueChange={handleMorningNotificationsToggle}
              colors={colors}
              isDark={isDark}
              isFirst
            />
            <ToggleRow
              icon={<BellOff size={18} color={colors.primary} strokeWidth={2} />}
              title="Evening Reminder"
              description="Daily push at 8:00 PM"
              value={eveningNotifications}
              onValueChange={handleEveningNotificationsToggle}
              colors={colors}
              isDark={isDark}
              isLast
            />
          </GlassPanel>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PREFERENCES</Text>
          <GlassPanel isDark={isDark} colors={colors}>
            <ToggleRow
              icon={isDark
                ? <Moon size={18} color={colors.primary} strokeWidth={2} />
                : <Sun size={18} color={colors.primary} strokeWidth={2} />
              }
              title={isDark ? 'Dark Mode' : 'Light Mode'}
              value={isDark}
              onValueChange={toggleTheme}
              colors={colors}
              isDark={isDark}
              isFirst
            />
            <ToggleRow
              icon={<ImagePlus size={18} color={colors.primary} strokeWidth={2} />}
              title="Save Progress Photos"
              description="Save to camera roll automatically"
              value={saveProgressPhotos}
              onValueChange={handleSaveProgressPhotosToggle}
              colors={colors}
              isDark={isDark}
              isLast
            />
          </GlassPanel>

          <GlassPanel isDark={isDark} colors={colors}>
            <ActionRow
              icon={<Share2 size={18} color={colors.primary} strokeWidth={2} />}
              title="Share with a Friend"
              onPress={handleShareApp}
              colors={colors}
              isDark={isDark}
              isFirst
            />
            <ActionRow
              icon={<Play size={18} color={colors.primary} strokeWidth={2} />}
              title="Preview Splash Screen"
              onPress={() => setShowSplashPreview(true)}
              colors={colors}
              isDark={isDark}
            />
            <ActionRow
              icon={<Play size={18} color={colors.primary} strokeWidth={2} />}
              title="Preview Grace Period Modal"
              onPress={() => setShowGracePeriodPreview(true)}
              colors={colors}
              isDark={isDark}
              isLast
            />
          </GlassPanel>

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>CHALLENGE</Text>
          <GlassPanel isDark={isDark} colors={colors}>
            <ActionRow
              icon={<BookOpen size={18} color={colors.primary} strokeWidth={2} />}
              title="Challenge Rules"
              subtitle="Review the four rules of the challenge"
              onPress={() => setShowRulesModal(true)}
              colors={colors}
              isDark={isDark}
              isFirst
            />
            <ActionRow
              icon={<Archive size={18} color={colors.primary} strokeWidth={2} />}
              title="Archived Challenges"
              subtitle="View your past challenge history"
              onPress={() => router.push('/archived-challenges')}
              colors={colors}
              isDark={isDark}
            />
            {activeGoal && (
              <>
                <ActionRow
                  icon={<RefreshCw size={18} color={colors.primary} strokeWidth={2} />}
                  title="Run It Again"
                  subtitle="Restart Day 1, keep your identity & compass"
                  onPress={handleRunItAgain}
                  colors={colors}
                  isDark={isDark}
                />
                <ActionRow
                  icon={<Sparkles size={18} color="#EF4444" strokeWidth={2} />}
                  title="Start Fresh"
                  subtitle="Archive this challenge, rebuild from scratch"
                  onPress={handleStartFresh}
                  colors={colors}
                  isDark={isDark}
                  variant="danger"
                  isLast
                />
              </>
            )}
            {!activeGoal && (
              <ActionRow
                icon={<RefreshCw size={18} color={colors.textTertiary} strokeWidth={2} />}
                title="No active challenge"
                onPress={() => {}}
                colors={colors}
                isDark={isDark}
                isLast
              />
            )}
          </GlassPanel>

          {confirmingSignOut ? (
            <View style={[
              styles.confirmPanel,
              { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
            ]}>
              <Text style={[styles.confirmText, { color: colors.text }]}>Sign out of your account?</Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                  onPress={() => setConfirmingSignOut(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#EF4444' }]}
                  onPress={handleConfirmSignOut}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <GlassPanel isDark={isDark} colors={colors}>
              <ActionRow
                icon={<LogOut size={18} color="#EF4444" strokeWidth={2} />}
                title="Sign Out"
                onPress={handleSignOut}
                colors={colors}
                isDark={isDark}
                variant="danger"
                isFirst
                isLast
              />
            </GlassPanel>
          )}

          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Compound to Greatness v1.0
          </Text>
        </View>
      </LinearGradient>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    minHeight: '100%',
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 16,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  confirmPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  photoOptionsPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  photoOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  photoOptionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  photoError: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
});

const rulesModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  rulesList: {
    gap: 12,
    marginBottom: 28,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  ruleNum: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 22,
    width: 18,
  },
  ruleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  closeBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
});
