import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  useWindowDimensions,
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
import ProofScrims from './proof/ProofScrims';
import ProofCaption from './proof/ProofCaption';
import ProofIconButton from './proof/ProofIconButton';
import ProofFullImage from './proof/ProofFullImage';

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
  const { height: windowHeight } = useWindowDimensions();
  const { user } = useAuth();
  const noteScrollRef = useRef<ScrollView>(null);

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
  // The complete, uncropped original opened from a photographic canvas.
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);

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
    setFullImageUri(null);
  }, [initialInputId]);

  // Add Context: the photo occupies roughly the top half of the usable
  // screen, so once the keyboard has opened, scroll the editing area into
  // view (note field + SAVE PROOF). The photo may move partly off-screen.
  useEffect(() => {
    if (phase !== 'note') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      noteScrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, [phase]);

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
          {/* The saved proof as the canvas (display-only cover; tap for the
              complete original), with the success state and its context. */}
          <Pressable
            style={styles.confirmCanvas}
            onPress={() => setFullImageUri(savedPhotoUrl)}
            accessibilityRole="imagebutton"
            accessibilityLabel="View the full, uncropped proof"
          >
            <RNImage source={{ uri: savedPhotoUrl }} style={styles.canvasImage} resizeMode="cover" />
            <ProofScrims topHeight={insets.top + 150} />
            <View style={[styles.confirmHeader, { paddingTop: insets.top + 16 }]} pointerEvents="none">
              <View style={styles.confirmCheckCircle}>
                <Check size={20} color="#000000" strokeWidth={3} />
              </View>
              <Text style={styles.confirmTitle}>PROOF CAPTURED</Text>
            </View>
            <ProofCaption
              assignment={selectedInput?.activity_name}
              note={note.trim() || null}
              leading={<Text style={styles.confirmDay}>DAY {challengeDay}</Text>}
            />
          </Pressable>

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

          <ProofFullImage
            uri={fullImageUri}
            onClose={() => setFullImageUri(null)}
            topInset={insets.top}
          />
        </View>
      </Modal>
    );
  }

  // ── Note/context phase ───────────────────────────────────────────
  if (phase === 'note') {
    // ~50% of the usable screen (plus the status-bar area it extends under).
    const usableHeight = windowHeight - insets.top - insets.bottom;
    const noteCanvasHeight = insets.top + Math.round(usableHeight * 0.5);
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              ref={noteScrollRef}
              style={styles.noteScroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* The captured proof as the upper canvas: edge to edge, display-only
                  cover. Tap the photo for the complete original; tap the caption
                  to change the assignment. */}
              <Pressable
                style={[styles.noteCanvas, { height: noteCanvasHeight }]}
                onPress={() => {
                  Keyboard.dismiss();
                  setFullImageUri(imageUri);
                }}
                accessibilityRole="imagebutton"
                accessibilityLabel="View the full, uncropped proof"
              >
                {imageUri && (
                  <RNImage source={{ uri: imageUri }} style={styles.canvasImage} resizeMode="cover" />
                )}
                <ProofScrims edges="bottom" />
                <ProofCaption
                  assignment={assignmentLabel}
                  assignmentPrefix={`DAY ${challengeDay} · `}
                  trailing={<ChevronDown size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowAssignSheet(true);
                  }}
                  accessibilityLabel={`Assigned to ${assignmentLabel}. Change assignment.`}
                />
              </Pressable>

              <View style={styles.noteBottom}>
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

          {/* Header stays fixed over the canvas (as before, it doesn't scroll). */}
          <ProofScrims edges="top" topHeight={insets.top + 110} />
          <View style={[styles.noteHeader, { paddingTop: insets.top + 16 }]} pointerEvents="box-none">
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
            <Text style={styles.noteHeaderTitle} pointerEvents="none">ADD CONTEXT</Text>
            <ProofIconButton onPress={handleClose} activeOpacity={0.6} accessibilityLabel="Close">
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </ProofIconButton>
          </View>

          <ProofFullImage
            uri={fullImageUri}
            onClose={() => setFullImageUri(null)}
            topInset={insets.top}
          />
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
  confirmCanvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#191919',
  },
  canvasImage: {
    width: '100%',
    height: '100%',
  },
  confirmHeader: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
  },
  confirmCheckCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  confirmDay: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  confirmActions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 24,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter-SemiBold',
  },
  noteScroll: {
    flex: 1,
  },
  noteCanvas: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#191919',
  },
  noteBottom: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
