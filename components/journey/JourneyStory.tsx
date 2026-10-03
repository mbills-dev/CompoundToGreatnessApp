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
// Every proof sits in the same 4:5 hero frame, so one proof's dimensions never
// change the screen's hierarchy. (4:5 is ~6% shorter than the camera's 3:4.)
const FRAME_ASPECT = 4 / 5;
// Proofs within this aspect range fill the frame; others are shown whole,
// over a blurred fill of themselves. Display only — stored proof is untouched.
const FILL_MIN_ASPECT = 0.6;
const FILL_MAX_ASPECT = 0.9;
// Vertical rhythm: the rail sits a fixed distance under the hero; spare height
// is shared above the hero (where the Journey mode switch will later sit) and
// below the navigation, weighted toward the top so the bottom stays tight.
const MIN_TOP = 4;
const RAIL_GAP = 28;
const MIN_BOTTOM = 20;
const TOP_SHARE = 3 / 4;
// Whole-image (unusual aspect) backdrop: enlarged and heavily blurred so no
// recognizable edge sits beside the foreground, then dimmed so it never
// competes with the proof. Display only.
const BACKDROP_SCALE = 1.6;
const BACKDROP_BLUR = 60;
// Editorial thumbnail rail: portrait thumbs echo the hero frame.
const THUMB_W = 44;
const THUMB_H = 58;
const THUMB_GAP = 8;
const THUMB_CELL = THUMB_W + THUMB_GAP;
const NAV_TOP = 8;
const NAV_H = 44;
const CONTROLS_H = THUMB_H + NAV_TOP + NAV_H;

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

  const [bodyHeight, setBodyHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [seeded, setSeeded] = useState(false);
  // Measured aspect (w/h) per proof, to choose fill vs. whole-image display.
  const [aspects, setAspects] = useState<Record<string, number>>({});
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
    if (!w || !h) return;
    setAspects((prev) => (prev[id] ? prev : { ...prev, [id]: w / h }));
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

  // One frame size for every proof on this device: full width, 3:4, reduced
  // only if the screen is too short to keep the rail and separation visible.
  const frameWidth = width - FRAME_INSET * 2;
  const controlsReserve = count > 1 ? CONTROLS_H : 0;
  const railGap = count > 1 ? RAIL_GAP : 0;
  const frameHeight = Math.max(
    0,
    Math.min(
      Math.round(frameWidth / FRAME_ASPECT),
      bodyHeight - MIN_TOP - railGap - controlsReserve - insets.bottom - MIN_BOTTOM
    )
  );
  // Height left after the hero, rail, safe area and both minimum gaps.
  const spare = Math.max(
    0,
    bodyHeight - frameHeight - railGap - controlsReserve - insets.bottom - MIN_TOP - MIN_BOTTOM
  );
  const topGap = MIN_TOP + Math.round(spare * TOP_SHARE);

  const renderPage = ({ item }: { item: ProgressPhoto }) => {
    const aspect = aspects[item.id];
    const fills = !aspect || (aspect >= FILL_MIN_ASPECT && aspect <= FILL_MAX_ASPECT);
    return (
      <View style={{ width, height: frameHeight, paddingHorizontal: FRAME_INSET }}>
        <TouchableOpacity
          style={styles.frame}
          activeOpacity={0.95}
          onPress={() => setFullScreenUri(item.storage_url)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Day ${item.challenge_day} proof. Open full screen.`}
        >
          {!fills && (
            <>
              <Image
                source={{ uri: item.storage_url }}
                style={[StyleSheet.absoluteFill, { transform: [{ scale: BACKDROP_SCALE }] }]}
                resizeMode="cover"
                blurRadius={BACKDROP_BLUR}
              />
              <View style={styles.blurDim} />
            </>
          )}
          <Image
            source={{ uri: item.storage_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={fills ? 'cover' : 'contain'}
            onLoad={handleImageLoad(item.id)}
          />
          {/* Legibility scrims for the day and caption — not decoration. */}
          <LinearGradient
            colors={['rgba(5,5,5,0.55)', 'rgba(5,5,5,0)']}
            style={styles.topScrim}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.9)']}
            locations={[0, 0.45, 1]}
            style={styles.bottomScrim}
            pointerEvents="none"
          />
          <View style={styles.topText} pointerEvents="none">
            <Text style={styles.dayText}>{dayLabel(item.challenge_day)}</Text>
            <Text style={styles.dateText}>{savedDateLabel(item.created_at)}</Text>
          </View>
          <View style={styles.caption} pointerEvents="none">
            <View style={styles.captionRule} />
            <Text style={styles.inputText} numberOfLines={2}>
              {(item.daily_activity_name ?? 'General progress').toUpperCase()}
            </Text>
            {!!item.note && (
              <Text style={styles.noteText} numberOfLines={2}>
                {`\u201C${item.note}\u201D`}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.pagerArea}
        onLayout={(e) => setBodyHeight(Math.floor(e.nativeEvent.layout.height))}
      >
        {frameHeight > 0 && (
          <FlatList
            ref={pagerRef}
            data={photos}
            keyExtractor={(p) => p.id}
            renderItem={renderPage}
            extraData={aspects}
            style={{ flexGrow: 0, height: frameHeight, marginTop: topGap }}
            horizontal
            pagingEnabled
            scrollEnabled={count > 1}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={current}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={handleMomentumEnd}
          />
        )}

        {count > 1 && frameHeight > 0 && (
          <View style={styles.controls}>
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
      </View>

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
  blurDim: {
    ...StyleSheet.absoluteFillObject,
    // Neutral, near-black wash: lowers brightness and perceived saturation.
    backgroundColor: 'rgba(10,10,10,0.62)',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  topText: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
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
  caption: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
  },
  captionRule: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: LIME,
    marginBottom: 10,
  },
  inputText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1.4,
  },
  noteText: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.88)',
    fontFamily: 'Inter-Regular',
  },
  controls: {
    marginTop: RAIL_GAP,
  },
  stripWrap: {
    paddingHorizontal: FRAME_INSET - THUMB_GAP / 2,
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
