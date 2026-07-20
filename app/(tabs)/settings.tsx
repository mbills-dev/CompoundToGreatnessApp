import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ActivityIndicator,
  TextInput,
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
  RefreshCw,
  Sparkles,
  Archive,
  Eye,
  Check,
  X,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { fetchSettingsBundle, settingsBundleKey } from '@/hooks/useSettingsBundle';
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
  LegalModal,
} from '@/components/SettingsComponents';
import {
  requestNotificationPermissions,
  resyncAllReminders,
  sendImmediateNotification,
} from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { CHALLENGE_RULES } from '@/constants/challengeRules';
import { PRIVACY_POLICY, PRIVACY_POLICY_UPDATED, TERMS_OF_SERVICE, TERMS_UPDATED } from '@/constants/legalDocs';
import { BookOpen } from 'lucide-react-native';

const ONBOARDING_KEY = '@onboarding_completed';
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function SettingsScreen() {
  const { theme, toggleTheme, colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut: authSignOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dayEndTime, setDayEndTime] = useState('12:00 AM');
  const [morningNotifications, setMorningNotifications] = useState(true);
  const [eveningNotifications, setEveningNotifications] = useState(true);
  const [saveProgressPhotos, setSaveProgressPhotos] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [challengeActionLoading, setChallengeActionLoading] = useState(false);
  const [shareFullJourney, setShareFullJourney] = useState(true);
  const [username, setUsername] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalUsernameRef = useRef('');

  useEffect(() => {
    loadSettings();
    loadActiveGoal();
  }, []);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { profile, settings: data } = await queryClient.fetchQuery({
        queryKey: settingsBundleKey(user.id),
        queryFn: () => fetchSettingsBundle(user),
      });

      if (profile?.photo_url) {
        setProfilePhoto(profile.photo_url);
      }
      if (profile?.username) {
        setUsername(profile.username);
        originalUsernameRef.current = profile.username;
      }

      if (data) {
        setSettingsId(data.id);
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setName([data.first_name, data.last_name].filter(Boolean).join(' '));
        setEmail(data.email || user.email || '');
        setDayEndTime(data.day_end_time || '12:00 AM');
        setMorningNotifications(data.morning_notifications);
        setEveningNotifications(data.evening_notifications);
        setSaveProgressPhotos(data.save_progress_photos);
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
      setShareFullJourney(data?.share_full_journey ?? true);
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
        router.replace({ pathname: '/', params: { chooseStart: '1' } });
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
      queryClient.invalidateQueries({ queryKey: settingsBundleKey(user?.id) });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settingsId, queryClient, user?.id]);

  const handleNameChange = (value: string) => {
    setName(value);
    const parts = value.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ');
    setFirstName(first);
    setLastName(last);
    saveSettings({ first_name: first, last_name: last });
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    saveSettings({ email: value });
  };

  const checkUsernameAvailability = useCallback(async (value: string) => {
    if (value === originalUsernameRef.current) {
      setUsernameAvailability('idle');
      return;
    }
    if (!USERNAME_REGEX.test(value)) {
      setUsernameAvailability('invalid');
      return;
    }
    if (!user?.id) return;
    setUsernameAvailability('checking');
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', value)
        .neq('id', user.id)
        .limit(1);
      setUsernameAvailability(data && data.length > 0 ? 'taken' : 'available');
    } catch {
      setUsernameAvailability('idle');
    }
  }, [user?.id]);

  const handleUsernameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (!cleaned) {
      setUsernameAvailability('idle');
      return;
    }
    usernameDebounceRef.current = setTimeout(() => {
      checkUsernameAvailability(cleaned);
    }, 400);
  };

  const handleUsernameBlur = async () => {
    if (!user?.id) return;
    if (username === originalUsernameRef.current) return;
    if (usernameAvailability !== 'available') return;
    const { error } = await supabase
      .from('profiles')
      .update({ username, username_set: true })
      .eq('id', user.id);
    if (!error) {
      originalUsernameRef.current = username;
      queryClient.invalidateQueries({ queryKey: settingsBundleKey(user?.id) });
    }
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
    if (granted && user) {
      await resyncAllReminders(user.id);
    }
  };

  const handleEveningNotificationsToggle = async (value: boolean) => {
    setEveningNotifications(value);
    saveSettings({ evening_notifications: value });
    const granted = await requestNotificationPermissions();
    if (granted && user) {
      await resyncAllReminders(user.id);
    }
  };

  const handleSaveProgressPhotosToggle = (value: boolean) => {
    setSaveProgressPhotos(value);
    saveSettings({ save_progress_photos: value });
  };

  const handleShareFullJourneyToggle = async (value: boolean) => {
    setShareFullJourney(value);
    if (activeGoal) {
      try {
        await supabase
          .from('goals')
          .update({ share_full_journey: value })
          .eq('id', activeGoal.id);
      } catch (error) {
        console.error('Error updating share_full_journey:', error);
      }
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    setPhotoError(null);
    try {
      const ext = uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfilePhoto(publicUrl);
      queryClient.invalidateQueries({ queryKey: settingsBundleKey(user?.id) });
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // DEBUG: NOTIFICATIONS — dev-only diagnostic state
  const [debugTestResult, setDebugTestResult] = useState<string | null>(null);
  const [debugPermissionStatus, setDebugPermissionStatus] = useState<any | null>(null);
  const [debugScheduled, setDebugScheduled] = useState<Notifications.NotificationRequest[] | null>(null);
  const [debugResyncError, setDebugResyncError] = useState<string | null>(null);

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

  const handleDeleteAccountPress = () => {
    setDeleteConfirmText('');
    setDeleteError(null);
    setConfirmingDelete(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await authSignOut();
    } catch (error: any) {
      setDeleteError(error?.message ?? 'Something went wrong. Please try again.');
      setDeletingAccount(false);
    }
  };

  return (
    <>
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
    <LegalModal
      visible={showPrivacyModal}
      onClose={() => setShowPrivacyModal(false)}
      title="Privacy Policy"
      updatedLabel={PRIVACY_POLICY_UPDATED}
      sections={PRIVACY_POLICY}
      colors={colors}
      isDark={isDark}
    />
    <LegalModal
      visible={showTermsModal}
      onClose={() => setShowTermsModal(false)}
      title="Terms of Service"
      updatedLabel={TERMS_UPDATED}
      sections={TERMS_OF_SERVICE}
      colors={colors}
      isDark={isDark}
    />
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
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
            <ProfileInput
              label="Username"
              value={username}
              onChangeText={handleUsernameChange}
              onBlur={handleUsernameBlur}
              placeholder="username"
              colors={colors}
              isDark={isDark}
              autoCapitalize="none"
              isFirst
              isLast={false}
              rightElement={
                usernameAvailability === 'checking' ? <ActivityIndicator size="small" color={colors.textTertiary} /> :
                usernameAvailability === 'available' ? <Check size={18} color="#ccff00" strokeWidth={3} /> :
                usernameAvailability === 'taken' ? <X size={18} color="#EF4444" strokeWidth={3} /> :
                null
              }
            />
            <ProfileInput label="Name" value={name} onChangeText={handleNameChange} placeholder="Your name" colors={colors} isDark={isDark} isLast={false} />
            <ProfileInput label="Email" value={user?.email || ''} onChangeText={() => {}} editable={false} placeholder="email@example.com" colors={colors} isDark={isDark} keyboardType="email-address" autoCapitalize="none" isLast />
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

          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PRIVACY</Text>
          <GlassPanel isDark={isDark} colors={colors}>
            <ToggleRow
              icon={<Eye size={18} color={colors.primary} strokeWidth={2} />}
              title="Share Full Journey"
              description="Watchers see your identity & daily inputs, not just your streak"
              value={shareFullJourney}
              onValueChange={handleShareFullJourneyToggle}
              colors={colors}
              isDark={isDark}
              isFirst
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

          {confirmingDelete ? (
            <View style={[
              styles.confirmPanel,
              { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
            ]}>
              <Text style={[styles.confirmText, { color: colors.text }]}>
                This permanently deletes your account and all your data — challenge history, photos, friends, and streaks. This cannot be undone.
              </Text>
              <Text style={[styles.deleteInputLabel, { color: colors.textTertiary }]}>Type DELETE to confirm</Text>
              <TextInput
                style={[styles.deleteInput, { color: colors.text, borderColor: 'rgba(239,68,68,0.4)' }]}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="DELETE"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deletingAccount}
              />
              {deleteError && <Text style={styles.deleteErrorText}>{deleteError}</Text>}
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                  onPress={() => setConfirmingDelete(false)}
                  activeOpacity={0.7}
                  disabled={deletingAccount}
                >
                  <Text style={[styles.confirmBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: '#EF4444' },
                    (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount) && { opacity: 0.5 },
                  ]}
                  onPress={handleConfirmDeleteAccount}
                  activeOpacity={0.7}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                >
                  {deletingAccount ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <GlassPanel isDark={isDark} colors={colors}>
              <ActionRow
                icon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />}
                title="Delete Account"
                onPress={handleDeleteAccountPress}
                colors={colors}
                isDark={isDark}
                variant="danger"
                isFirst
                isLast
              />
            </GlassPanel>
          )}

          {__DEV__ && (
            <View style={[styles.debugSection, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}>
              <Text style={[styles.debugTitle, { color: colors.primary }]}>DEBUG: NOTIFICATIONS</Text>

              <TouchableOpacity
                style={[styles.debugBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  try {
                    await sendImmediateNotification('Test', 'If you see this, delivery works.');
                    setDebugTestResult('Sent successfully');
                  } catch (err: any) {
                    setDebugTestResult(`Error: ${err?.message ?? String(err)}`);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.debugBtnText}>Send Test Notification Now</Text>
              </TouchableOpacity>
              {debugTestResult && (
                <Text style={[styles.debugResult, { color: colors.textSecondary }]}>{debugTestResult}</Text>
              )}

              <TouchableOpacity
                style={[styles.debugBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  try {
                    const status = await Notifications.getPermissionsAsync();
                    setDebugPermissionStatus(status);
                  } catch (err: any) {
                    setDebugPermissionStatus({ error: err?.message ?? String(err) });
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.debugBtnText}>Check Permission Status</Text>
              </TouchableOpacity>
              {debugPermissionStatus && (
                <Text style={[styles.debugResult, { color: colors.textSecondary }]}>
                  {JSON.stringify(debugPermissionStatus, null, 2)}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.debugBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  if (!user) {
                    setDebugResyncError('No user in scope');
                    return;
                  }
                  setDebugResyncError(null);
                  try {
                    await resyncAllReminders(user.id);
                  } catch (err: any) {
                    setDebugResyncError(`resync error: ${err?.message ?? String(err)}`);
                  }
                  try {
                    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
                    setDebugScheduled(scheduled);
                  } catch (err: any) {
                    setDebugResyncError(`list error: ${err?.message ?? String(err)}`);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.debugBtnText}>Force Resync + List Scheduled</Text>
              </TouchableOpacity>
              {debugResyncError && (
                <Text style={[styles.debugResult, { color: colors.error }]}>{debugResyncError}</Text>
              )}
              {debugScheduled && (
                <View>
                  <Text style={[styles.debugResult, { color: colors.textSecondary }]}>
                    Scheduled count: {debugScheduled.length}
                  </Text>
                  {debugScheduled.map((n, i) => (
                    <Text key={i} style={[styles.debugResult, { color: colors.textSecondary }]}>
                      [{i}] title={n.content.title ?? '(none)'} trigger={JSON.stringify(n.trigger)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            COMPOUND TO GREATNESS v1.0
          </Text>
          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => setShowPrivacyModal(true)} activeOpacity={0.7}>
              <Text style={[styles.legalLinkText, { color: colors.textTertiary }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[styles.legalLinkDivider, { color: colors.textTertiary }]}>·</Text>
            <TouchableOpacity onPress={() => setShowTermsModal(true)} activeOpacity={0.7}>
              <Text style={[styles.legalLinkText, { color: colors.textTertiary }]}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
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
  deleteInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  deleteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deleteErrorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
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
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  legalLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalLinkDivider: {
    fontSize: 12,
  },
  usernameFeedback: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
  },
  debugSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    marginBottom: 8,
    gap: 8,
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  debugBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  debugBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  debugResult: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
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
