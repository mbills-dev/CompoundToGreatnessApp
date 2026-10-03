import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressPhoto } from '@/types/database';
import ProofScrims from '@/components/proof/ProofScrims';
import ProofCaption from '@/components/proof/ProofCaption';
import ProofFullImage from '@/components/proof/ProofFullImage';

const BLACK = '#050505';
const SURFACE = '#191919';
const LIME = '#CCFF00';
const MUTED = 'rgba(255,255,255,0.55)';
const CHALLENGE_LENGTH = 77;
const STRIP_INSET = 12;
// History rail: portrait thumbs.
const THUMB_W = 44;
const THUMB_H = 58;
const THUMB_GAP = 8;
const THUMB_CELL = THUMB_W + THUMB_GAP;
const NAV_TOP = 8;
const NAV_H = 44;

interface JourneyStoryProps {
  /** The active run's proof, already ordered challenge_day ASC, created_at ASC. */
  photos: ProgressPhoto[];
  loading: boolean;
  /**
   * Measured height of the Journey header overlaid on the canvas (0 until
   * laid out). The top scrim follows it, so a taller header (e.g. a future
   * STORY | THEN → NOW selector) stays legible without layout changes here.
   */
  headerHeight: number;
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

export default function JourneyStory({
  photos,
  loading,
  headerHeight,
  onTakeFirstProof,
}: JourneyStoryProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList<ProgressPhoto>>(null);
  const stripRef = useRef<FlatList<ProgressPhoto>>(null);

  // Height of the full-bleed photographic canvas (everything above the
  // history controls; the whole screen when there is no history to navigate).
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [seeded, setSeeded] = useState(false);
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

  const hasHistory = count > 1;
  const topScrimHeight = headerHeight > 0 ? headerHeight + 60 : insets.top + 150;

  // Each page is one proof: the photo edge to edge (display-only cover crop),
  // its scrims, and its caption, so DAY X / 77 always travels with its own
  // photo while swiping. Tap opens the complete, uncropped original.
  const renderPage = ({ item }: { item: ProgressPhoto }) => (
    <Pressable
      style={{ width, height: canvasHeight }}
      onPress={() => setFullScreenUri(item.storage_url)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Day ${item.challenge_day} proof. Open the full, uncropped original.`}
    >
      <Image source={{ uri: item.storage_url }} style={styles.image} resizeMode="cover" />
      <ProofScrims topHeight={topScrimHeight} />
      <ProofCaption
        assignment={item.daily_activity_name}
        note={item.note}
        leading={
          <View style={styles.dayBlock}>
            <Text style={styles.dayText}>{dayLabel(item.challenge_day)}</Text>
            <Text style={styles.dateText}>{savedDateLabel(item.created_at)}</Text>
          </View>
        }
        style={hasHistory ? undefined : { bottom: insets.bottom + 24 }}
      />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.canvas}
        onLayout={(e) => setCanvasHeight(Math.floor(e.nativeEvent.layout.height))}
      >
        {canvasHeight > 0 && (
          <FlatList
            ref={pagerRef}
            data={photos}
            keyExtractor={(p) => p.id}
            renderItem={renderPage}
            extraData={`${canvasHeight}:${topScrimHeight}:${hasHistory}`}
            horizontal
            pagingEnabled
            scrollEnabled={hasHistory}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={current}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={handleMomentumEnd}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>

      {/* Historical navigation: below the canvas, where YOUR PROOF has its
          actions; visually subordinate to the proof. */}
      {hasHistory && (
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
                <View style={[styles.thumb, i === current ? styles.thumbActive : styles.thumbIdle]}>
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
              <ChevronLeft size={20} color="rgba(255,255,255,0.55)" strokeWidth={2} />
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
              <ChevronRight size={20} color="rgba(255,255,255,0.55)" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ProofFullImage
        uri={fullScreenUri}
        onClose={() => setFullScreenUri(null)}
        topInset={insets.top}
        presentation="modal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dayBlock: {
    marginBottom: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dayText: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Inter-Black',
    letterSpacing: 0.2,
  },
  dateText: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Inter-Regular',
    letterSpacing: 0.2,
  },
  stripWrap: {
    paddingHorizontal: STRIP_INSET - THUMB_GAP / 2,
  },
  thumbCell: {
    width: THUMB_CELL,
    alignItems: 'center',
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  thumbActive: {
    borderColor: LIME,
  },
  thumbIdle: {
    opacity: 0.45,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginTop: NAV_TOP,
  },
  navBtn: {
    width: NAV_H,
    height: NAV_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  position: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
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
  controls: {
    paddingTop: 12,
  },
});
