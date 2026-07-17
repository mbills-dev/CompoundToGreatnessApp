import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Platform,
  Share,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Camera, X, Share2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Goal, DailyActivity, DailyCompletion, ProgressPhoto } from '@/types/database';
import { MILESTONE_DATA, isMilestoneDay } from '@/constants/milestones';
import { getDateForChallengeDay } from '@/lib/dateHelpers';
import { useJourneyComparison } from '@/hooks/useJourneyComparison';
import { ComparisonModal } from './JourneyComparisonBanner';

export interface TileLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DayCardModalProps {
  visible: boolean;
  day: number | null;
  goal: Goal;
  tileLayout: TileLayout | null;
  onClose: () => void;
  editable?: boolean;
  onSaved?: () => void;
  headerMode?: 'day' | 'date';
}

const LIME = '#CCFF00';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_H * 0.94;
const CARD_TOP = SCREEN_H - CARD_HEIGHT;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DayCardModal({ visible, day, goal, tileLayout, onClose, editable = false, onSaved, headerMode = 'day' }: DayCardModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const cardBg = isDark ? '#000000' : colors.background;
  const headerBg = isDark ? '#1A1A1A' : colors.backgroundSecondary;
  const evidenceBg = isDark ? '#111111' : colors.backgroundSecondary;
  const placeholderBg = isDark ? '#111111' : colors.backgroundSecondary;
  const shareSheetBg = isDark ? '#1A1A1A' : colors.card;
  const textPrimary = isDark ? '#FFFFFF' : colors.text;
  const textMuted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const { stats: journeyStats } = useJourneyComparison(goal.id, goal.current_challenge_day ?? 0);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [completion, setCompletion] = useState<DailyCompletion | null>(null);
  const [editChecked, setEditChecked] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [evidenceContent, setEvidenceContent] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ProgressPhoto | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [mounted, setMounted] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const scale = useRef(new Animated.Value(0.97)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const dateStr = day != null ? getDateForChallengeDay(goal.challenge_start_date, day) : null;
  const isMilestone = day != null ? isMilestoneDay(day) : false;
  const milestoneData = day != null && isMilestone ? MILESTONE_DATA[day] : null;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      scale.setValue(0.97);
      overlayOpacity.setValue(0);
      contentOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1.0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.85,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible]);

  const load = useCallback(async () => {
    if (day == null || !dateStr) return;
    setLoading(true);
    try {
      const [actRes, compRes, evRes, photoRes] = await Promise.all([
        supabase
          .from('daily_activities')
          .select('*')
          .eq('goal_id', goal.id)
          .order('order_position', { ascending: true }),
        supabase
          .from('daily_completions')
          .select('*')
          .eq('goal_id', goal.id)
          .eq('completion_date', dateStr)
          .maybeSingle(),
        supabase
          .from('evidence_logs')
          .select('content')
          .eq('goal_id', goal.id)
          .eq('completion_date', dateStr)
          .maybeSingle(),
        supabase
          .from('progress_photos')
          .select('*')
          .eq('goal_id', goal.id)
          .eq('challenge_day', day)
          .maybeSingle(),
      ]);

      setActivities(actRes.data ?? []);
      setCompletion(compRes.data ?? null);
      setEditChecked(compRes.data?.activities_completed ?? []);
      setEvidenceContent(evRes.data?.content ?? null);
      setPhoto(photoRes.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [day, goal.id, dateStr]);

  useEffect(() => {
    if (visible && day != null) {
      load();
    }
  }, [visible, day, load]);

  const toggleEditActivity = (activityId: string) => {
    setEditChecked((prev) =>
      prev.includes(activityId) ? prev.filter((id) => id !== activityId) : [...prev, activityId]
    );
  };

  const saveActivityEdit = async () => {
    if (!dateStr) return;
    setSavingEdit(true);
    try {
      const allComplete = editChecked.length === activities.length && activities.length > 0;
      const now = new Date().toISOString();

      if (completion) {
        await supabase
          .from('daily_completions')
          .update({
            activities_completed: editChecked,
            completed_at: allComplete ? completion.completed_at || now : null,
            edited_at: now,
          })
          .eq('id', completion.id);
      } else {
        await supabase.from('daily_completions').insert({
          goal_id: goal.id,
          completion_date: dateStr,
          activities_completed: editChecked,
          completed_at: allComplete ? now : null,
          is_rest_day: false,
          edited_at: now,
        });
      }

      await load();
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Error saving activity edit:', error);
    } finally {
      setSavingEdit(false);
    }
  };

  const uploadPickedPhoto = async (uri: string) => {
    if (day == null) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${goal.id}/day-${day}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(path);

      const record = {
        user_id: user.id,
        goal_id: goal.id,
        challenge_day: day,
        storage_url: urlData.publicUrl,
        is_milestone: isMilestoneDay(day),
        is_shared_with_watchers: false,
      };

      let savedPhoto: ProgressPhoto;
      if (photo) {
        const { data, error } = await supabase
          .from('progress_photos')
          .update({ storage_url: urlData.publicUrl })
          .eq('id', photo.id)
          .select()
          .single();
        if (error) throw error;
        savedPhoto = data;
      } else {
        const { data, error } = await supabase
          .from('progress_photos')
          .insert(record)
          .select()
          .single();
        if (error) throw error;
        savedPhoto = data;
      }

      setPhoto(savedPhoto);
    } catch (err) {
      console.error('Photo upload error:', err);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedPhoto(result.assets[0].uri);
  };

  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadPickedPhoto(result.assets[0].uri);
  };

  const handlePickPhoto = () => {
    if (day == null) return;
    Alert.alert(
      'Add Photo',
      undefined,
      [
        { text: 'Take Photo', onPress: takePhotoWithCamera },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShareWithWatchers = async () => {
    if (!photo) return;
    await supabase
      .from('progress_photos')
      .update({ is_shared_with_watchers: true })
      .eq('id', photo.id);
    setPhoto({ ...photo, is_shared_with_watchers: true });
    setShowShareSheet(false);
    Alert.alert('Shared', 'Your photo has been shared with your watchers.');
  };

  const handleShareExternally = async () => {
    if (!photo) return;
    setShowShareSheet(false);
    if (Platform.OS === 'web') {
      Alert.alert('Share', photo.storage_url);
    } else {
      await Share.share({ url: photo.storage_url, message: `Day ${day} progress photo` });
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!mounted) return null;

  const completedIds = completion?.activities_completed ?? [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, { opacity: overlayOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY }, { scale }],
            backgroundColor: cardBg,
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Animated.View style={[styles.cardContent, { opacity: contentOpacity }]}>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} bounces>
            <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 12 }]}>
              <View style={styles.headerLeft}>
                <Text style={[styles.dayNumber, { color: textPrimary }]}>
                  {headerMode === 'date' && dateStr ? formatDate(dateStr) : `DAY ${day}`}
                </Text>
                <Text style={[styles.challengeLabel, { color: textMuted }]}>
                  {headerMode === 'date' ? 'KEEP GOING' : '77-DAY CHALLENGE'}
                </Text>
              </View>
              <View style={styles.headerRight}>
                {dateStr && headerMode !== 'date' && <Text style={[styles.dateText, { color: textMuted }]}>{formatDate(dateStr)}</Text>}
                {isMilestone && (
                  <View style={styles.milestonePill}>
                    <Text style={styles.milestonePillText}>MILESTONE</Text>
                  </View>
                )}
              </View>
            </View>

            {isMilestone && milestoneData && (
              <View style={styles.milestoneBlock}>
                <Text style={[styles.milestoneBlockTag, { color: textMuted }]}>MILESTONE UNLOCKED</Text>
                <Text style={[styles.milestoneH1, { color: textPrimary }]}>{milestoneData.h1} /</Text>
                <Text style={styles.milestoneH2}>{milestoneData.h2}</Text>
                <Text style={[styles.milestoneBody, { color: textMuted }]}>{milestoneData.body}</Text>
              </View>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={LIME} />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SUCCESS STACK</Text>
                  {activities.map((act) => {
                    const done = editable ? editChecked.includes(act.id) : completedIds.includes(act.id);
                    const row = (
                      <>
                        <View style={[styles.activityCircle, done && styles.activityCircleDone]}>
                          {done && <Text style={styles.activityCheck}>✓</Text>}
                        </View>
                        <Text style={[
                          styles.activityName,
                          done ? [styles.activityNameDone, { color: textPrimary }] : [styles.activityNameMissed, { color: textMuted }],
                        ]}>
                          {act.activity_name}
                        </Text>
                      </>
                    );
                    return editable ? (
                      <TouchableOpacity key={act.id} style={styles.activityRow} onPress={() => toggleEditActivity(act.id)} activeOpacity={0.7}>
                        {row}
                      </TouchableOpacity>
                    ) : (
                      <View key={act.id} style={styles.activityRow}>
                        {row}
                      </View>
                    );
                  })}
                  {editable && activities.length > 0 && (
                    <TouchableOpacity
                      style={[styles.saveEditBtn, savingEdit && { opacity: 0.6 }]}
                      onPress={saveActivityEdit}
                      disabled={savingEdit}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.saveEditBtnText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                  )}
                  {activities.length === 0 && (
                    <Text style={[styles.emptyNote, { color: textMuted }]}>No activities configured</Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>EVIDENCE LOG</Text>
                  {evidenceContent ? (
                    <View style={[styles.evidenceBox, { backgroundColor: evidenceBg }]}>
                      <Text style={[styles.evidenceText, { color: textMuted }]}>"{evidenceContent}"</Text>
                    </View>
                  ) : (
                    <Text style={[styles.emptyNote, { color: textMuted }]}>No entry for this day</Text>
                  )}
                </View>

                <View style={[styles.section, { borderBottomWidth: 0, paddingBottom: 48 }]}>
                  <Text style={styles.sectionLabel}>PROGRESS PHOTO</Text>
                  {photo ? (
                    <View style={styles.photoWrapper}>
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setShowFullPhoto(true)}>
                        <Image source={{ uri: photo.storage_url }} style={styles.photo} resizeMode="cover" />
                      </TouchableOpacity>
                      <View style={styles.photoStamp}>
                        <Text style={styles.photoStampText}>
                          Day {day}{isMilestone && milestoneData ? ` · ${milestoneData.h1} ${milestoneData.h2}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.photoShareBtn} onPress={() => setShowShareSheet(true)}>
                        <Share2 size={15} color={LIME} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.photoPlaceholder, { backgroundColor: placeholderBg }]}
                      onPress={handlePickPhoto}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? (
                        <ActivityIndicator color={textMuted} />
                      ) : (
                        <>
                          <Camera size={22} color={textMuted} strokeWidth={1.5} />
                          <Text style={[styles.photoPlaceholderText, { color: textMuted }]}>Add photo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {journeyStats && (
                    <TouchableOpacity style={styles.journeyLink} onPress={() => setShowComparison(true)}>
                      <Text style={styles.journeyLinkText}>See Your Journey →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>

        {showShareSheet && (
          <View style={styles.shareSheetOverlay}>
            <TouchableOpacity style={styles.shareSheetDismiss} onPress={() => setShowShareSheet(false)} />
            <View style={[styles.shareSheet, { backgroundColor: shareSheetBg }]}>
              <View style={styles.shareSheetHandle} />
              <TouchableOpacity style={styles.shareOption} onPress={handleShareWithWatchers}>
                <Text style={[styles.shareOptionText, { color: textPrimary }]}>Share with my watchers</Text>
              </TouchableOpacity>
              <View style={styles.shareOptionDivider} />
              <TouchableOpacity style={styles.shareOption} onPress={handleShareExternally}>
                <Text style={[styles.shareOptionText, { color: textPrimary }]}>Share externally</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareOption, { marginTop: 8 }]} onPress={() => setShowShareSheet(false)}>
                <Text style={[styles.shareOptionText, { color: textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
      <Animated.View
        style={[styles.closeBtnWrapper, { opacity: contentOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.6}>
          <X size={18} color="rgba(255,255,255,0.55)" strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>

      <ComparisonModal
        visible={showComparison}
        onClose={() => setShowComparison(false)}
        earliestPhoto={journeyStats?.earliestPhoto ?? null}
        latestPhoto={journeyStats?.latestPhoto ?? null}
      />

      <Modal visible={showFullPhoto} transparent animationType="fade" onRequestClose={() => setShowFullPhoto(false)}>
        <TouchableOpacity
          style={styles.fullPhotoOverlay}
          activeOpacity={1}
          onPress={() => setShowFullPhoto(false)}
        >
          <Image
            source={{ uri: photo?.storage_url }}
            style={styles.fullPhotoImage}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.fullPhotoClose} onPress={() => setShowFullPhoto(false)}>
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
  },
  closeBtnWrapper: {
    position: 'absolute',
    top: CARD_TOP + 14,
    right: 14,
    zIndex: 30,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
  },
  scroll: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerLeft: {
    gap: 4,
  },
  dayNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 68,
  },
  challengeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.92,
    textTransform: 'uppercase',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 8,
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  milestonePill: {
    backgroundColor: LIME,
    borderRadius: 100,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  milestonePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  milestoneBlock: {
    backgroundColor: 'rgba(204,255,0,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(204,255,0,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 4,
  },
  milestoneBlockTag: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  milestoneH1: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 21,
  },
  milestoneH2: {
    fontSize: 16,
    fontWeight: '900',
    color: LIME,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 21,
  },
  milestoneBody: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    lineHeight: 15,
  },

  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 2.24,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCircleDone: {
    backgroundColor: LIME,
    borderColor: LIME,
  },
  activityCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    lineHeight: 14,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  activityNameDone: {
    color: '#FFFFFF',
  },
  activityNameMissed: {
    color: 'rgba(255,255,255,0.3)',
    textDecorationLine: 'line-through',
  },

  evidenceBox: {
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 16,
    minHeight: 90,
    justifyContent: 'center',
  },
  evidenceText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    lineHeight: 21,
  },
  emptyNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
  },

  photoWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
  },
  photoStamp: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoStampText: {
    fontSize: 11,
    fontWeight: '700',
    color: LIME,
  },
  photoShareBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },

  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  shareSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  shareSheetDismiss: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  shareSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
    paddingTop: 12,
  },
  shareSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareOption: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareOptionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  journeyLink: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  journeyLinkText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    color: LIME,
  },
  fullPhotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhotoImage: {
    width: '100%',
    height: '80%',
  },
  fullPhotoClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditBtn: {
    backgroundColor: LIME,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveEditBtnText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    color: '#000000',
  },
});
