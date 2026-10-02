import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageLoadEventData,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, X, Images } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressPhoto } from '@/types/database';

const BLACK = '#050505';
const SURFACE = '#191919';
const LIME = '#CCFF00';
const MUTED = 'rgba(255,255,255,0.55)';
const CHALLENGE_LENGTH = 77;
const FRAME_INSET = 12;
const THUMB = 56;
const THUMB_GAP = 8;
const THUMB_CELL = THUMB + THUMB_GAP;

interface JourneyStoryProps {
  /** The active run's proof, already ordered challenge_day ASC, created_at ASC. */
  photos: ProgressPhoto[];
  loading: boolean;
  /** Opens the existing Proof capture flow. Omit to hide the empty-state CTA. */
  onTakeFirstProof?: () => void;
}

/** Challenge progress language. Days beyond the 77-day challenge drop "/ 77". */
function dayLabel(day: number): string {
  return day <= CHALLENGE_LENGTH ? `DAY ${day} / ${CHALLENGE_LENGTH}` : `DAY ${day}`;
}

/** created_at is the proof-save timestamp (not verified media capture time). */
function savedDateLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function JourneyStory({ photos, loading, onTakeFirstProof }: JourneyStoryProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList<ProgressPhoto>>(null);
  const stripRef = useRef<FlatList<ProgressPhoto>>(null);

  const [pageHeight, setPageHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [seeded, setSeeded] = useState(false);
  // Landscape proofs are shown uncropped ('contain'); portrait fill the frame.
  const [landscape, setLandscape] = useState<Record<string, boolean>>({});
  const [fullScreenUri, setFullScreenUri] = useState<string | null>(null);

  const count = photos.length;
  // The ONE selected proof. Pager, arrows, thumbnails and X / N all derive from it.
  const current = Math.min(index, Math.max(count - 1, 0));

  const goTo = (target: number) => {
    const next = Math.max(0, Math.min(target, count - 1));
    setIndex(next);
    pagerRef.current?.scrollToOffset({ offset: next * width, animated: true });
  };

  // Swipe: the pager reports where it settled; programmatic scrolls settle on
  // the index already set, so this is a no-op for them.
  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const settled = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / width), count - 1));
    if (settled !== current) setIndex(settled);
  };

  // Open on the most recent proof, once per Journey session, as soon as the
  // library first arrives. Later proof-array updates never re-seed, so the
  // user is not moved away from the proof they're viewing. Seeding with an
  // empty library leaves index 0, which is where a first captured proof lands.
  useEffect(() => {
    if (!seeded && !loading) {
      setIndex(Math.max(photos.length - 1, 0));
      setSeeded(true);
    }
  }, [seeded, loading, photos.length]);

  // Keep the selected thumbnail centered in the strip.
  useEffect(() => {
    if (count > 1) {
      stripRef.current?.scrollToIndex({ index: current, viewPosition: 0.5, animated: true });
    }
  }, [current, count]);

  const handleImageLoad = (id: string) => (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width: w, height: h } = e.nativeEvent.source;
    if (w > h) setLandscape((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  if (count === 0) {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={LIME} />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Images size={44} color="rgba(255,255,255,0.85)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>START YOUR JOURNEY</Text>
        <Text style={styles.emptySub}>
          Take your first proof photo to begin building your visual story.
        </Text>
        {onTakeFirstProof && (
          <TouchableOpacity style={styles.cta} onPress={onTakeFirstProof} activeOpacity={0.85}>
            <Text style={styles.ctaText}>TAKE YOUR FIRST PROOF</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Between the library arriving and the seed effect running (one commit),
  // hold the loading state so the pager mounts already on the latest proof
  // via initialScrollIndex rather than starting at 0 and jumping.
  if (!seeded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={LIME} />
      </View>
    );
  }

  const renderPage = ({ item }: { item: ProgressPhoto }) => (
    <View style={{ width, height: pageHeight, paddingHorizontal: FRAME_INSET }}>
      <TouchableOpacity
        style={styles.frame}
        activeOpacity={0.95}
        onPress={() => setFullScreenUri(item.storage_url)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Day ${item.challenge_day} proof. Open full screen.`}
      >
        <Image
          source={{ uri: item.storage_url }}
          style={StyleSheet.absoluteFill}
          resizeMode={landscape[item.id] ? 'contain' : 'cover'}
          onLoad={handleImageLoad(item.id)}
        />
        {/* Legibility scrims for the overlaid text — not decoration. */}
        <LinearGradient
          colors={['rgba(5,5,5,0.7)', 'rgba(5,5,5,0)']}
          style={styles.topScrim}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.85)']}
          style={styles.bottomScrim}
          pointerEvents="none"
        />
        <View style={styles.topText} pointerEvents="none">
          <Text style={styles.dayText}>{dayLabel(item.challenge_day)}</Text>
          <Text style={styles.dateText}>{savedDateLabel(item.created_at)}</Text>
        </View>
        <View style={styles.bottomText} pointerEvents="none">
          <Text style={styles.inputText} numberOfLines={2}>
            {(item.daily_activity_name ?? 'General progress').toUpperCase()}
          </Text>
          {!!item.note && (
            <Text style={styles.noteText} numberOfLines={3}>
              {`\u201C${item.note}\u201D`}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.pagerArea}
        onLayout={(e) => setPageHeight(Math.floor(e.nativeEvent.layout.height))}
      >
        {pageHeight > 0 && (
          <FlatList
            ref={pagerRef}
            data={photos}
            keyExtractor={(p) => p.id}
            renderItem={renderPage}
            extraData={landscape}
            horizontal
            pagingEnabled
            scrollEnabled={count > 1}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={current}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={handleMomentumEnd}
          />
        )}
      </View>

      {count > 1 && (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.stripWrap}>
          <FlatList
            ref={stripRef}
            data={photos}
            keyExtractor={(p) => p.id}
            extraData={current}
            horizontal
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: THUMB_CELL, offset: THUMB_CELL * i, index: i })}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item, index: i }) => (
              <TouchableOpacity
                style={styles.thumbCell}
                onPress={() => goTo(i)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Proof ${i + 1} of ${count}, day ${item.challenge_day}`}
                accessibilityState={{ selected: i === current }}
              >
                <View style={[styles.thumb, i === current && styles.thumbActive]}>
                  <Image source={{ uri: item.storage_url }} style={styles.thumbImage} resizeMode="cover" />
                </View>
              </TouchableOpacity>
            )}
          />
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
              onPress={() => goTo(current - 1)}
              disabled={current === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous proof"
            >
              <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.position}>
              {current + 1} / {count}
            </Text>
            <TouchableOpacity
              style={[styles.navBtn, current === count - 1 && styles.navBtnDisabled]}
              onPress={() => goTo(current + 1)}
              disabled={current === count - 1}
              accessibilityRole="button"
              accessibilityLabel="Next proof"
            >
              <ChevronRight size={26} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {count === 1 && <View style={{ height: insets.bottom + 16 }} />}

      <Modal
        visible={fullScreenUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenUri(null)}
      >
        <TouchableOpacity
          style={styles.fullOverlay}
          activeOpacity={1}
          onPress={() => setFullScreenUri(null)}
        >
          {fullScreenUri && (
            <Image source={{ uri: fullScreenUri }} style={styles.fullImage} resizeMode="contain" />
          )}
          <TouchableOpacity
            style={[styles.fullClose, { top: insets.top + 12 }]}
            onPress={() => setFullScreenUri(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  pagerArea: {
    flex: 1,
  },
  frame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  topText: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
  },
  dayText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.3,
  },
  dateText: {
    marginTop: 2,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-Regular',
  },
  bottomText: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  inputText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1.2,
  },
  noteText: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  controls: {
    paddingTop: 14,
  },
  stripWrap: {
    paddingHorizontal: FRAME_INSET - THUMB_GAP / 2,
  },
  thumbCell: {
    width: THUMB_CELL,
    alignItems: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  thumbActive: {
    borderColor: LIME,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.25,
  },
  position: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1,
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  cta: {
    marginTop: 28,
    backgroundColor: LIME,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '900',
    color: BLACK,
    fontFamily: 'Inter-Black',
    letterSpacing: 0.5,
  },
  fullOverlay: {
    flex: 1,
    backgroundColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullClose: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
