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
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { X, Check, Plus, Share2, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DailyActivity } from '@/types/database';
import { isMilestoneDay } from '@/constants/milestones';
import CaptureProofCamera from './CaptureProofCamera';

const LIME = '#CCFF00';

interface ProofCaptureFlowProps {
  visible: boolean;
  onClose: () => void;
  challengeDay: number;
  /** The challenge goal this proof belongs to (persisted as goal_id). */
  goalId: string | null;
  /** The user's active Success Stack inputs, in display order. */
  inputs: DailyActivity[];
  /** Preselect only when capture was launched from a specific input. */
  defaultInputId?: string | null;
  challengeRunId: string | null;
  onSaved: () => void;
}

type Phase = 'camera' | 'note' | 'saving' | 'confirm';

export default function ProofCaptureFlow({
  visible,
  onClose,
  challengeDay,
  goalId,
  inputs,
  defaultInputId = null,
  challengeRunId,
  onSaved,
}: ProofCaptureFlowProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('camera');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<'camera' | 'library'>('camera');
  // Never guess an input: preselect only a default that is actually in the
  // current Success Stack, otherwise "General progress" (null).
  const initialInputId =
    defaultInputId && inputs.some((i) => i.id === defaultInputId) ? defaultInputId : null;
  const [selectedInputId, setSelectedInputId] = useState<string | null>(initialInputId);
  const [showAssignSheet, setShowAssignSheet] = useState(false);
  const [note, setNote] = useState('');
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);

  const selectedInput = inputs.find((i) => i.id === selectedInputId) ?? null;
  const assignmentLabel = selectedInput ? selectedInput.activity_name : 'General progress';

  const resetState = useCallback(() => {
    setPhase('camera');
    setImageUri(null);
    setImageSource('camera');
    setSelectedInputId(initialInputId);
    setShowAssignSheet(false);
    setNote('');
    setSavedPhotoUrl(null);
  }, [initialInputId]);

  const handleClose = () => {
    Keyboard.dismiss();
    resetState();
    onClose();
  };

  const handleImageReady = (uri: string, source: 'camera' | 'library') => {
    setImageUri(uri);
    setImageSource(source);
    setPhase('note');
  };

  const handleInputSelected = (inputId: string | null) => {
    if (inputId !== selectedInputId && Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedInputId(inputId);
    setShowAssignSheet(false);
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
        goal_id: goalId,
        daily_activity_id: selectedInput?.id ?? null,
        daily_activity_name: selectedInput?.activity_name ?? null,
        challenge_day: challengeDay,
        storage_url: urlData.publicUrl,
        is_milestone: isMilestoneDay(challengeDay),
        is_shared_with_watchers: false,
        source: imageSource,
        note: note.trim() || null,
        challenge_run_id: challengeRunId,
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
      const localPath = `${FileSystem.cacheDirectory}share_proof_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(savedPhotoUrl, localPath);
      if (downloadRes.status !== 200) throw new Error('Download failed');

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share My Progress',
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
              {selectedInput ? ` · ${selectedInput.activity_name.toUpperCase()}` : ''}
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

  // ── Note/context phase ───────────────────────────────────────────
  if (phase === 'note') {
    const assignOptions: { id: string | null; name: string }[] = [
      ...inputs.map((i) => ({ id: i.id, name: i.activity_name })),
      { id: null, name: 'General progress' },
    ];
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
                setPhase('camera');
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
                <TouchableOpacity
                  style={styles.assignCard}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowAssignSheet(true);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Assigned to ${assignmentLabel}. Change assignment.`}
                >
                  <Text style={styles.assignCardText} numberOfLines={1}>
                    <Text style={styles.assignCardDay}>DAY {challengeDay} · </Text>
                    {assignmentLabel}
                  </Text>
                  <ChevronDown size={18} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
                </TouchableOpacity>
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
                  <TouchableOpacity style={styles.noteSaveBtn} onPress={handleSave} activeOpacity={0.85}>
                    <Text style={styles.noteSaveText}>SAVE PROOF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        {/* ASSIGN THIS PROOF — selecting a row applies it and closes */}
        <Modal
          visible={showAssignSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAssignSheet(false)}
        >
          <View style={styles.sheetRoot}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowAssignSheet(false)} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>ASSIGN THIS PROOF</Text>
              <Text style={styles.sheetSubtitle}>What does this proof show?</Text>
              <ScrollView style={styles.sheetList} bounces={false}>
                {assignOptions.map((option, index) => {
                  const selected = option.id === selectedInputId;
                  return (
                    <TouchableOpacity
                      key={option.id ?? 'general'}
                      style={[styles.sheetRow, index > 0 && styles.sheetRowDivider]}
                      onPress={() => handleInputSelected(option.id)}
                      activeOpacity={0.6}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[styles.sheetRowText, selected && styles.sheetRowTextSelected]}
                        numberOfLines={2}
                      >
                        {option.name}
                      </Text>
                      {selected && <Check size={20} color={LIME} strokeWidth={2.75} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  assignCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#191919',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  assignCardText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  assignCardDay: {
    color: LIME,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
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
  noteSaveBtn: {
    flex: 1,
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

  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 24,
    maxHeight: '75%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: 'Inter-Black',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 16,
  },
  sheetRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sheetRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter-SemiBold',
  },
  sheetRowTextSelected: {
    color: LIME,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
  },
});
