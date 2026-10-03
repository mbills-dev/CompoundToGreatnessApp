import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  FlatList,
  Platform,
  Alert,
  Pressable,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { X, Plus, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressPhoto } from '@/types/database';

const LIME = '#CCFF00';

interface TodayProofViewerProps {
  visible: boolean;
  onClose: () => void;
  challengeDay: number;
  photos: ProgressPhoto[];
  /** Called after the viewer has fully dismissed. */
  onAddAnother: () => void;
  /** Called after the viewer has fully dismissed. */
  onViewJourney: () => void;
  /** Permanently deletes one proof (resolves true only if deleted). Omit to hide the options control. */
  onDeletePhoto?: (photo: ProgressPhoto) => Promise<boolean>;
}

export default function TodayProofViewer({
  visible,
  onClose,
  challengeDay,
  photos,
  onAddAnother,
  onViewJourney,
  onDeletePhoto,
}: TodayProofViewerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Height of the full-bleed proof canvas (everything above the actions).
  const [canvasHeight, setCanvasHeight] = useState(0);
  // The complete, uncropped original currently opened from the canvas.
  const [fullImageUri, setFullImageUri] = useState<string | null>(null);
  const listRef = useRef<FlatList<ProgressPhoto>>(null);
  // Actions that open another modal or navigate run after this modal has
  // finished dismissing (iOS cannot present while a dismissal is in flight).
  const pendingActionRef = useRef<(() => void) | null>(null);

  const items = useMemo(
    () => [...photos].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [photos]
  );

  useEffect(() => {
    if (visible) {
      setIndex(0);
      setShowOptions(false);
      setFullImageUri(null);
    }
  }, [visible]);

  const safeIndex = Math.min(index, Math.max(items.length - 1, 0));
  const current = items[safeIndex];

  // After a delete the pager's offset can point past the end or at the wrong
  // page; realign it to the (clamped) selected proof.
  useEffect(() => {
    if (items.length > 0) {
      listRef.current?.scrollToOffset({ offset: safeIndex * width, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handleDeleteConfirmed = async () => {
    if (!current || deleting || !onDeletePhoto) return;
    const wasOnlyProof = items.length === 1;
    const deletedIndex = safeIndex;
    setDeleting(true);
    const deleted = await onDeletePhoto(current);
    setDeleting(false);
    if (!deleted) {
      Alert.alert('Error', 'Could not delete this proof. Please try again.');
      return;
    }
    if (wasOnlyProof) {
      onClose();
    } else {
      // The next proof slides into this slot; if the last one was deleted,
      // fall back to the new last (the previous proof).
      setIndex(Math.min(deletedIndex, items.length - 2));
    }
  };

  const handleDeletePress = () => {
    setShowOptions(false);
    Alert.alert(
      'Delete this proof?',
      'This photo will be permanently removed from your journey.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Proof', style: 'destructive', onPress: handleDeleteConfirmed },
      ]
    );
  };

  const closeThen = (action: () => void) => {
    pendingActionRef.current = action;
    onClose();
    if (Platform.OS !== 'ios') {
      pendingActionRef.current = null;
      action();
    }
  };

  const handleDismiss = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const dateLabel = current
    ? new Date(current.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';


  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={handleDismiss}
    >
      <View style={styles.container}>
        {/* Proof canvas: the photo fills everything above the actions,
            edge to edge (display crop only; tap opens the full original). */}
        <View
          style={styles.canvas}
          onLayout={(e) => setCanvasHeight(Math.floor(e.nativeEvent.layout.height))}
        >
          {canvasHeight > 0 && (
            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumEnd}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              style={StyleSheet.absoluteFill}
              renderItem={({ item }) => (
                <Pressable
                  style={{ width, height: canvasHeight }}
                  onPress={() => setFullImageUri(item.storage_url)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="View the full, uncropped proof"
                >
                  <Image source={{ uri: item.storage_url }} style={styles.image} resizeMode="cover" />
                </Pressable>
              )}
            />
          )}

          {/* Legibility scrims for the overlaid text; the bottom one also fades
              the photo into the action area. */}
          <LinearGradient
            colors={['rgba(5,5,5,0.6)', 'rgba(5,5,5,0)']}
            style={[styles.topScrim, { height: insets.top + 150 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.6)', '#050505']}
            locations={[0, 0.55, 1]}
            style={styles.bottomScrim}
            pointerEvents="none"
          />

          <View style={[styles.header, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
            <View style={styles.headerText} pointerEvents="none">
              <Text style={styles.dayLabel}>DAY {challengeDay}</Text>
              <Text style={styles.title}>YOUR PROOF</Text>
              {!!dateLabel && <Text style={styles.date}>{dateLabel}</Text>}
            </View>
            <View style={styles.headerButtons}>
              {!!onDeletePhoto && (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowOptions(true)}
                  disabled={!current || deleting}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel="Proof options"
                >
                  <MoreHorizontal size={20} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {current && (
            <View style={styles.caption} pointerEvents="none">
              {items.length > 1 && (
                <Text style={styles.position}>
                  {safeIndex + 1} / {items.length}
                </Text>
              )}
              <View style={styles.captionRule} />
              <Text style={styles.assignment} numberOfLines={2}>
                {current.daily_activity_name ?? 'General progress'}
              </Text>
              {!!current.note && (
                <Text style={styles.note} numberOfLines={3}>
                  {current.note}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => closeThen(onAddAnother)}
            activeOpacity={0.85}
          >
            <Plus size={17} color="#000000" strokeWidth={2.75} />
            <Text style={styles.addBtnText}>ADD ANOTHER PROOF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.journeyBtn}
            onPress={() => closeThen(onViewJourney)}
            activeOpacity={0.7}
          >
            <Text style={styles.journeyBtnText}>VIEW YOUR JOURNEY →</Text>
          </TouchableOpacity>
        </View>

        {/* Options sheet — an overlay (not a second Modal) so the destructive
            confirmation can present cleanly right after it closes. */}
        {showOptions && (
          <View style={styles.sheetRoot}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowOptions(false)} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={handleDeletePress}
                activeOpacity={0.6}
                accessibilityRole="button"
              >
                <Text style={styles.sheetDeleteText}>Delete Proof</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetRow, styles.sheetRowDivider]}
                onPress={() => setShowOptions(false)}
                activeOpacity={0.6}
                accessibilityRole="button"
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* The complete, uncropped original. A layer inside this modal (not a
            second Modal), like the options sheet above. */}
        {fullImageUri && (
          <Pressable style={styles.fullOverlay} onPress={() => setFullImageUri(null)}>
            <Image source={{ uri: fullImageUri }} style={styles.image} resizeMode="contain" />
            <TouchableOpacity
              style={[styles.closeBtn, styles.fullClose, { top: insets.top + 12 }]}
              onPress={() => setFullImageUri(null)}
              accessibilityRole="button"
              accessibilityLabel="Close full proof"
            >
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerText: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: LIME,
    letterSpacing: 1.5,
    fontFamily: 'Inter-Black',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  date: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5,5,5,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#191919',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  position: {
    alignSelf: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
    fontVariant: ['tabular-nums'],
  },
  caption: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
  },
  captionRule: {
    width: 36,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: LIME,
    marginBottom: 12,
  },
  assignment: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  note: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter-Regular',
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIME,
    paddingVertical: 16,
    borderRadius: 14,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  journeyBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  journeyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  sheetRoot: {
    ...StyleSheet.absoluteFillObject,
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
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  sheetRow: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  sheetRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sheetDeleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF453A',
    fontFamily: 'Inter-Bold',
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Bold',
  },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullClose: {
    position: 'absolute',
    right: 20,
  },
});
