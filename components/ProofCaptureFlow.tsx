import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image as RNImage,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Share as RNShare,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { X, Check, Plus, Share2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Goal } from '@/types/database';
import { isMilestoneDay } from '@/constants/milestones';
import CaptureProofCamera from './CaptureProofCamera';

const LIME = '#CCFF00';

interface GoalOption {
  id: string | null;
  title: string;
}

interface ProofCaptureFlowProps {
  visible: boolean;
  onClose: () => void;
  challengeDay: number;
  goals: Goal[];
  defaultGoalId: string | null;
  onSaved: () => void;
}

type Phase = 'camera' | 'goal' | 'note' | 'saving' | 'confirm';

export default function ProofCaptureFlow({
  visible,
  onClose,
  challengeDay,
  goals,
  defaultGoalId,
  onSaved,
}: ProofCaptureFlowProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('camera');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<'camera' | 'library'>('camera');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(defaultGoalId);
  const [note, setNote] = useState('');
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);

  const goalOptions: GoalOption[] = [
    ...goals.map((g) => ({ id: g.id, title: g.title })),
    { id: null, title: 'General progress' },
  ];

  const showGoalPicker = goals.length > 1;

  const resetState = useCallback(() => {
    setPhase('camera');
    setImageUri(null);
    setImageSource('camera');
    setSelectedGoalId(defaultGoalId);
    setNote('');
    setSavedPhotoUrl(null);
  }, [defaultGoalId]);

  const handleClose = () => {
    Keyboard.dismiss();
    resetState();
    onClose();
  };

  const handleImageReady = (uri: string, source: 'camera' | 'library') => {
    setImageUri(uri);
    setImageSource(source);
    if (showGoalPicker) {
      setPhase('goal');
    } else {
      setSelectedGoalId(defaultGoalId);
      setPhase('note');
    }
  };

  const triggerGoalHaptic = () => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  const handleGoalSelected = (goalId: string | null) => {
    triggerGoalHaptic();
    setSelectedGoalId(goalId);
    setPhase('note');
  };

  const handleSave = async () => {
    if (!imageUri || !user) return;
    Keyboard.dismiss();
    setPhase('saving');

    try {
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `proof_${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) throw new Error('Image file not found');

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(filePath, decode(base64), { contentType });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('progress_photos').insert({
        user_id: user.id,
        goal_id: selectedGoalId,
        challenge_day: challengeDay,
        storage_url: urlData.publicUrl,
        is_milestone: isMilestoneDay(challengeDay),
        is_shared_with_watchers: false,
        source: imageSource,
        note: note.trim() || null,
      });

      if (dbError) throw dbError;

      setSavedPhotoUrl(urlData.publicUrl);

      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }

      setPhase('confirm');
      onSaved();
    } catch (err) {
      console.error('Proof save error:', err);
      Alert.alert('Error', 'Failed to save your proof. Please try again.');
      setPhase('note');
    }
  };

  const handleShareSaved = async () => {
    if (!savedPhotoUrl) return;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Share', savedPhotoUrl);
        return;
      }
      // For remote URLs, download to a temp file first, then share via expo-sharing
      const localPath = `${FileSystem.cacheDirectory}share_proof_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(savedPhotoUrl, localPath);
      if (downloadRes.status !== 200) throw new Error('Download failed');

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share your proof',
        });
      } else {
        await RNShare.share({ url: downloadRes.uri });
      }
    } catch (err) {
      console.error('Share failed:', err);
      Alert.alert('Share Error', 'Could not share this image. Please try again.');
    }
  };

  const handleAddAnother = () => {
    resetState();
  };

  // ── Camera phase ─────────────────────────────────────────────────
  if (phase === 'camera') {
    return (
      <CaptureProofCamera
        visible={visible}
        onClose={handleClose}
        onImageReady={handleImageReady}
        challengeDay={challengeDay}
      />
    );
  }

  // ── Saving phase ─────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color={LIME} />
          <Text style={styles.savingText}>Saving proof…</Text>
        </View>
      </Modal>
    );
  }

  // ── Confirmation phase ───────────────────────────────────────────
  if (phase === 'confirm' && savedPhotoUrl) {
    const selectedGoal = goals.find((g) => g.id === selectedGoalId);
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.confirmContainer}>
          <View style={[styles.confirmContent, { paddingTop: insets.top + 40 }]}>
            <View style={styles.confirmCheckCircle}>
              <Check size={32} color="#000000" strokeWidth={3} />
            </View>
            <Text style={styles.confirmTitle}>PROOF CAPTURED</Text>
            <Text style={styles.confirmDay}>
              DAY {challengeDay}
              {selectedGoal ? ` · ${selectedGoal.title.toUpperCase()}` : ''}
            </Text>

            <View style={styles.confirmImageWrapper}>
              <RNImage
                source={{ uri: savedPhotoUrl }}
                style={styles.confirmImage}
                resizeMode="cover"
              />
            </View>

            <View style={[styles.confirmActions, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity
                style={styles.confirmShareBtn}
                onPress={handleShareSaved}
                activeOpacity={0.85}
              >
                <Share2 size={17} color="#000000" strokeWidth={2.5} />
                <Text style={styles.confirmShareText}>SHARE MY PROGRESS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmAddAnotherBtn}
                onPress={handleAddAnother}
                activeOpacity={0.7}
              >
                <Plus size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
                <Text style={styles.confirmAddAnotherText}>ADD ANOTHER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDoneBtn}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmDoneText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Goal selection phase ─────────────────────────────────────────
  if (phase === 'goal') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.goalContainer}>
          <View style={[styles.goalHeader, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.goalEyebrow}>WHAT DOES THIS PROVE?</Text>
            <TouchableOpacity style={styles.goalCloseBtn} onPress={handleClose} activeOpacity={0.6}>
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {imageUri && (
            <View style={styles.goalPreviewWrapper}>
              <RNImage source={{ uri: imageUri }} style={styles.goalPreview} resizeMode="contain" />
            </View>
          )}

          <ScrollView
            style={styles.goalList}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.goalSubtitle}>Choose the goal this evidence belongs to.</Text>
            {goalOptions.map((option) => (
              <TouchableOpacity
                key={option.id ?? 'general'}
                style={[
                  styles.goalOption,
                  selectedGoalId === option.id && styles.goalOptionSelected,
                ]}
                onPress={() => handleGoalSelected(option.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.goalOptionText,
                    selectedGoalId === option.id && styles.goalOptionTextSelected,
                  ]}
                  numberOfLines={2}
                >
                  {option.title}
                </Text>
                {selectedGoalId === option.id && (
                  <Check size={20} color={LIME} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ── Note/context phase ───────────────────────────────────────────
  if (phase === 'note') {
    const selectedGoal = goals.find((g) => g.id === selectedGoalId);
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <KeyboardAvoidingView
          style={styles.noteContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.noteHeader, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={styles.noteBackBtn}
              onPress={() => {
                Keyboard.dismiss();
                setPhase(showGoalPicker ? 'goal' : 'camera');
              }}
              activeOpacity={0.6}
            >
              <Text style={styles.noteBackText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.noteHeaderTitle}>ADD CONTEXT</Text>
            <TouchableOpacity style={styles.noteCloseBtn} onPress={handleClose} activeOpacity={0.6}>
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              style={styles.noteScroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.noteImageWrapper}>
                {imageUri && (
                  <RNImage source={{ uri: imageUri }} style={styles.noteImage} resizeMode="contain" />
                )}
              </View>

              <View style={styles.noteBottom}>
                {selectedGoal && (
                  <Text style={styles.noteGoalTag}>{selectedGoal.title}</Text>
                )}
                {!selectedGoal && (
                  <Text style={styles.noteGoalTag}>General progress</Text>
                )}
                <Text style={styles.notePrompt}>What will you want to remember about this moment?</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g. Hit 27,418 subscribers today."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={note}
                  onChangeText={setNote}
                  maxLength={200}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity style={styles.noteSkipBtn} onPress={handleSave} activeOpacity={0.7}>
                    <Text style={styles.noteSkipText}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.noteSaveBtn} onPress={handleSave} activeOpacity={0.85}>
                    <Text style={styles.noteSaveText}>SAVE PROOF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  savingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  savingText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Bold',
  },

  // Confirmation
  confirmContainer: {
    flex: 1,
    backgroundColor: '#050505',
  },
  confirmContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: 'Inter-Black',
    marginBottom: 6,
  },
  confirmDay: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
    marginBottom: 24,
  },
  confirmImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  confirmImage: {
    width: '100%',
    height: '100%',
  },
  confirmActions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  confirmShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LIME,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
  },
  confirmShareText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  confirmAddAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  confirmAddAnotherText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Bold',
  },
  confirmDoneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  confirmDoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'Inter-SemiBold',
  },

  // Goal selection
  goalContainer: {
    flex: 1,
    backgroundColor: '#050505',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  goalEyebrow: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  goalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPreviewWrapper: {
    width: '100%',
    height: 200,
    marginBottom: 8,
    overflow: 'hidden',
  },
  goalPreview: {
    width: '100%',
    height: '100%',
  },
  goalList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  goalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191919',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  goalOptionSelected: {
    borderColor: LIME,
  },
  goalOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-SemiBold',
  },
  goalOptionTextSelected: {
    color: '#FFFFFF',
  },

  // Note phase
  noteContainer: {
    flex: 1,
    backgroundColor: '#050505',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  noteHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  noteBackBtn: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  noteBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter-SemiBold',
  },
  noteCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteScroll: {
    flex: 1,
  },
  noteImageWrapper: {
    width: '100%',
    height: 240,
    marginBottom: 16,
    overflow: 'hidden',
  },
  noteImage: {
    width: '100%',
    height: '100%',
  },
  noteBottom: {
    paddingHorizontal: 24,
  },
  noteGoalTag: {
    fontSize: 11,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 0.5,
    fontFamily: 'Inter-Bold',
    marginBottom: 16,
  },
  notePrompt: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 10,
  },
  noteInput: {
    backgroundColor: '#191919',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    minHeight: 50,
    maxHeight: 80,
    marginBottom: 20,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  noteSkipBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#191919',
  },
  noteSkipText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter-Bold',
  },
  noteSaveBtn: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: LIME,
  },
  noteSaveText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
});
