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
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { X, Plus, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const imageHeight = Math.round(width * 1.1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={handleDismiss}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerText}>
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

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => (
              <View style={{ width, height: imageHeight }}>
                <Image
                  source={{ uri: item.storage_url }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            )}
          />

          {items.length > 1 && (
            <Text style={styles.position}>
              {safeIndex + 1} / {items.length}
            </Text>
          )}

          {current && (
            <View style={styles.details}>
              <Text style={styles.assignment}>
                {current.daily_activity_name ?? 'General progress'}
              </Text>
              {!!current.note && <Text style={styles.note}>{current.note}</Text>}
            </View>
          )}
        </ScrollView>

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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  position: {
    alignSelf: 'center',
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  details: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  assignment: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  note: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.7)',
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
});
