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
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { X, Plus } from 'lucide-react-native';
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
}

export default function TodayProofViewer({
  visible,
  onClose,
  challengeDay,
  photos,
  onAddAnother,
  onViewJourney,
}: TodayProofViewerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Actions that open another modal or navigate run after this modal has
  // finished dismissing (iOS cannot present while a dismissal is in flight).
  const pendingActionRef = useRef<(() => void) | null>(null);

  const items = useMemo(
    () => [...photos].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [photos]
  );

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const safeIndex = Math.min(index, Math.max(items.length - 1, 0));
  const current = items[safeIndex];

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

        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <FlatList
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
});
