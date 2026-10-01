import React, { useState, useEffect, useRef } from 'react';
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
  Share,
  ViewStyle,
  PanResponder,
  Animated,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { X, HelpCircle, Images, RotateCcw, Zap, ZapOff, Camera, Share2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIME = '#CCFF00';

// ── Lens selection (iOS, expo-camera 17 `selectedLens`) ──────────────
// 1x  = expo-camera's default device for the current facing (selectedLens
//       left undefined).
// .5x = the physical ultra-wide device, selected explicitly by the name
//       expo-camera reports via onAvailableLensesChanged
//       (AVCaptureDevice.localizedName). The `zoom` prop cannot do this: it
//       maps to videoZoomFactor = maxZoom^zoom (always >= 1.0), zoom IN only.
// Names are localized by iOS; if no ultra-wide name is recognized, .5x is
// simply not offered.
const ULTRA_WIDE_LENS_PATTERN = /\bultra\s*wide\b/i;
// Failsafe only — see beginSwitch.
const DEVICE_SWITCH_FAILSAFE_MS = 1500;

type LensMode = 'wide' | 'ultraWide';
// `remaining` = device swaps still to be confirmed (one onAvailableLensesChanged
// per native swap); consecutive lens taps coalesce into one pending switch.
type PendingSwitch = { kind: 'flip' | 'lens'; staleKey: string | null; remaining: number };

type FlashMode = 'off' | 'on' | 'auto';

interface CaptureProofCameraProps {
  visible: boolean;
  onClose: () => void;
  onImageReady: (uri: string, source: 'camera' | 'library') => void;
  challengeDay?: number | null;
}

export default function CaptureProofCamera({
  visible,
  onClose,
  onImageReady,
  challengeDay,
}: CaptureProofCameraProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [lensMode, setLensMode] = useState<LensMode>('wide');
  // Lens names reported by expo-camera, cached per camera position. These are
  // device facts (not session state), so they survive close/reopen.
  const [lensesByFacing, setLensesByFacing] = useState<Record<CameraType, string[]>>({
    back: [],
    front: [],
  });
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedSource, setCapturedSource] = useState<'camera' | 'library'>('camera');
  const [showHelp, setShowHelp] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Refs are only for synchronous guards inside async/gesture handlers.
  const capturingRef = useRef(false);
  const sessionIdRef = useRef(0);
  const pendingSwitchRef = useRef<PendingSwitch | null>(null);
  const switchWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fresh session on open ─────────────────────────────────────────
  // Reset during render (React's "adjust state on prop change" pattern) so the
  // FIRST render of a new session already has fresh values. A useEffect reset
  // would first mount CameraView with the previous session's facing/lens and
  // then immediately reconfigure it.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setFacing('back');
      setLensMode('wide');
      setCapturedUri(null);
      setShowHelp(false);
      setCapturing(false);
      setCameraReady(false);
      setSwitching(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    sessionIdRef.current += 1; // results from a previous session are ignored
    capturingRef.current = false;
    pendingSwitchRef.current = null;
    if (switchWatchdogRef.current) {
      clearTimeout(switchWatchdogRef.current);
      switchWatchdogRef.current = null;
    }
  }, [visible]);

  useEffect(() => () => {
    if (switchWatchdogRef.current) clearTimeout(switchWatchdogRef.current);
  }, []);

  // ── Capabilities (derived — never assumed) ────────────────────────
  const backLenses = lensesByFacing.back;
  const ultraWideLensName = backLenses.find((name) => ULTRA_WIDE_LENS_PATTERN.test(name)) ?? null;
  // .5x is offered only on the back camera, and only when a physical
  // ultra-wide lens was positively detected in the device's own lens list.
  const ultraWideSupported = facing === 'back' && ultraWideLensName !== null;
  const isUltraWide = ultraWideSupported && lensMode === 'ultraWide';

  // What the native side is told to use: the ultra-wide device only when .5x
  // is active on the back camera; otherwise undefined, so expo-camera uses its
  // normal default device for the current facing (1x / front).
  const selectedLens = isUltraWide ? ultraWideLensName ?? undefined : undefined;

  // Single source of truth for the shutter.
  const canCapture = cameraReady && !capturing && !switching;

  // ── Haptics ───────────────────────────────────────────────────────
  const hapticSelection = () => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  };
  const hapticCapture = () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  // ── Device switch confirmation (flip / lens) ──────────────────────
  // expo-camera 17 applies `facing` / `selectedLens` changes in place on the
  // running session and does NOT fire onCameraReady again. The only native
  // confirmation that the new device is installed is onAvailableLensesChanged,
  // emitted after the session reconfiguration commits.
  const finishSwitch = (confirmed: boolean) => {
    if (switchWatchdogRef.current) {
      clearTimeout(switchWatchdogRef.current);
      switchWatchdogRef.current = null;
    }
    if (!pendingSwitchRef.current) return;
    pendingSwitchRef.current = null;
    setSwitching(false);
    if (confirmed) hapticSelection();
  };

  const beginSwitch = (pending: PendingSwitch) => {
    pendingSwitchRef.current = pending;
    setSwitching(true);
    if (switchWatchdogRef.current) clearTimeout(switchWatchdogRef.current);
    // Failsafe only: the session keeps running during a device swap, so if the
    // confirmation event is ever missed the shutter must not stay locked.
    switchWatchdogRef.current = setTimeout(() => finishSwitch(false), DEVICE_SWITCH_FAILSAFE_MS);
  };

  const handleAvailableLensesChanged = ({ lenses }: { lenses: string[] }) => {
    const key = lenses.join('|');
    const pending = pendingSwitchRef.current;
    // A late event describing the camera we just flipped away from.
    if (pending?.kind === 'flip' && key === pending.staleKey) return;

    setLensesByFacing((prev) =>
      prev[facing].join('|') === key ? prev : { ...prev, [facing]: lenses }
    );
    if (pending) {
      pending.remaining -= 1;
      if (pending.remaining <= 0) finishSwitch(true);
    }
  };

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  // Leaving the live camera unmounts CameraView (the review branch replaces
  // it), so its readiness and any pending switch end with it.
  const enterReview = (uri: string, source: 'camera' | 'library') => {
    finishSwitch(false);
    setCameraReady(false);
    setCapturedSource(source);
    setCapturedUri(uri);
  };

  const handleTakePhoto = async () => {
    if (!canCapture || capturingRef.current) return;
    const ref = cameraRef.current;
    if (!ref) return;

    const session = sessionIdRef.current;
    capturingRef.current = true;
    setCapturing(true);
    hapticCapture();
    try {
      const photo = await ref.takePictureAsync({ quality: 0.8 });
      if (session !== sessionIdRef.current) return;
      if (photo?.uri) enterReview(photo.uri, 'camera');
    } catch (err) {
      if (session !== sessionIdRef.current) return;
      console.error('Camera capture error:', err);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      if (session === sessionIdRef.current) {
        capturingRef.current = false;
        setCapturing(false);
      }
    }
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to select an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    enterReview(result.assets[0].uri, 'library');
  };

  // Returning to the camera branch mounts a fresh CameraView, which reports
  // its own onCameraReady. Facing and lens are preserved within the session.
  const handleRetake = () => {
    setCapturedUri(null);
  };

  const handleUsePhoto = () => {
    if (capturedUri) {
      onImageReady(capturedUri, capturedSource);
      setCapturedUri(null);
    }
  };

  const handleShareCapture = async () => {
    if (!capturedUri) return;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Share', capturedUri);
        return;
      }
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(capturedUri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share Photo',
        });
      } else {
        await Share.share({ url: capturedUri });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  // In-place flip: the native view swaps devices on its running session.
  // No remount, no second AVCaptureSession. The back-camera lens choice is
  // kept for when the user flips back; while on the front camera no lens is
  // selected, so the front camera uses its default device.
  const handleFlip = () => {
    if (!cameraReady || switching || capturing) return;
    beginSwitch({ kind: 'flip', staleKey: lensesByFacing[facing].join('|'), remaining: 1 });
    setFacing((cur) => (cur === 'back' ? 'front' : 'back'));
  };

  const cycleFlash = () => {
    setFlash((cur) => (cur === 'off' ? 'on' : cur === 'on' ? 'auto' : 'off'));
  };

  // The ONE lens-change path, used by both the labels and the swipe.
  // A tap during an unconfirmed lens swap is NOT dropped: the latest choice
  // wins. expo-camera applies each selectedLens change in order on its serial
  // session queue, so rapid .5x/1x taps are safe; the pending switch just
  // waits for one more confirmation. Only a pending flip or a capture blocks.
  const selectLens = (mode: LensMode) => {
    if (!ultraWideSupported) return;
    if (!cameraReady || capturing) return;
    if (mode === lensMode) return;
    const pending = pendingSwitchRef.current;
    if (pending?.kind === 'flip') return;
    if (pending?.kind === 'lens') {
      pending.remaining += 1;
      beginSwitch(pending); // restarts the failsafe for the new swap
    } else {
      beginSwitch({ kind: 'lens', staleKey: null, remaining: 1 });
    }
    setLensMode(mode);
  };

  // Swipe: PanResponder is created once, so it reads the latest render's
  // values through a ref instead of capturing first-render closures.
  const swipeRef = useRef<{ enabled: boolean; select: (mode: LensMode) => void }>({
    enabled: false,
    select: () => {},
  });
  useEffect(() => {
    swipeRef.current = { enabled: ultraWideSupported, select: selectLens };
  });

  // The swipe layer becomes the JS responder at touch START. It is a sibling
  // of every control, so this only applies to touches on the bare preview
  // (nothing else there handles touches). Owning the gesture from the start
  // means no mid-gesture claim/transfer negotiation and no gestureState reset
  // at grant: g.dx at release is the full distance from the touch origin.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => swipeRef.current.enabled,
      onMoveShouldSetPanResponder: () => swipeRef.current.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 30 || Math.abs(g.dx) < Math.abs(g.dy)) return;
        swipeRef.current.select(g.dx < 0 ? 'ultraWide' : 'wide');
      },
    })
  ).current;

  if (!permission) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={LIME} />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <Camera size={32} color={LIME} strokeWidth={1.5} />
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionBody}>
              Allow camera access to capture proof of your progress.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionBtnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.permissionCancel}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.permissionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Review state ────────────────────────────────────────────────────
  if (capturedUri) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.reviewContainer}>
          <View style={[styles.reviewTopBar, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.reviewTitle}>REVIEW YOUR PROOF</Text>
            <TouchableOpacity
              style={styles.reviewCloseBtn}
              onPress={onClose}
              activeOpacity={0.6}
            >
              <X size={20} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.reviewImageContainer}>
            <RNImage source={{ uri: capturedUri }} style={styles.reviewImage} resizeMode="contain" />
          </View>

          <View style={[styles.reviewBottom, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.reviewSecondaryRow}>
              <TouchableOpacity
                style={styles.reviewSecondaryBtn}
                onPress={handleRetake}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewSecondaryText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reviewSecondaryBtn}
                onPress={handleShareCapture}
                activeOpacity={0.7}
              >
                <Share2 size={16} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
                <Text style={styles.reviewSecondaryText}>Share</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.usePhotoBtn}
              onPress={handleUsePhoto}
              activeOpacity={0.85}
            >
              <Text style={styles.usePhotoText}>USE THIS PHOTO</Text>
              <Text style={styles.usePhotoArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Camera state ───────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          selectedLens={selectedLens}
          onCameraReady={handleCameraReady}
          onAvailableLensesChanged={handleAvailableLensesChanged}
          onMountError={() => {
            setCameraReady(false);
            Alert.alert('Camera Error', 'Could not start camera. Please try again.');
            onClose();
          }}
        />

        {/* Swipe layer for lens switching. A sibling of the controls (not their
            parent), so a swipe can never steal a press from the shutter. */}
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

        {/* Top context overlay */}
        <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.translucentBtn} onPress={onClose} activeOpacity={0.6}>
            <X size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.topContext}>
            <Text style={styles.topContextTitle}>CAPTURE THE PROOF</Text>
            {challengeDay != null && (
              <Text style={styles.topContextDay}>DAY {challengeDay}</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.translucentBtn}
            onPress={() => setShowHelp(true)}
            activeOpacity={0.6}
          >
            <HelpCircle size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Corner framing guides */}
        <View style={styles.cornerGuidesContainer} pointerEvents="none">
          <View style={[styles.cornerGuide, styles.cornerTL]} />
          <View style={[styles.cornerGuide, styles.cornerTR]} />
          <View style={[styles.cornerGuide, styles.cornerBL]} />
          <View style={[styles.cornerGuide, styles.cornerBR]} />
        </View>

        {/* Bottom controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
          {/* Lens selector — only when a physical ultra-wide lens was detected */}
          {ultraWideSupported && (
            <View style={styles.zoomSelector}>
              <TouchableOpacity
                style={[styles.zoomOption, styles.zoomOptionLeft]}
                onPress={() => selectLens('ultraWide')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Ultra wide, .5x"
                accessibilityState={{ selected: isUltraWide }}
              >
                <Text style={[styles.zoomLabel, isUltraWide && styles.zoomLabelActive]}>
                  .5x
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomOption, styles.zoomOptionRight]}
                onPress={() => selectLens('wide')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Wide, 1x"
                accessibilityState={{ selected: !isUltraWide }}
              >
                <Text style={[styles.zoomLabel, !isUltraWide && styles.zoomLabelActive]}>
                  1x
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.shutterRow}>
            {/* Flash */}
            <TouchableOpacity style={styles.translucentBtn} onPress={cycleFlash} activeOpacity={0.7}>
              {flash === 'off' ? (
                <ZapOff size={20} color="#FFFFFF" strokeWidth={2.2} />
              ) : (
                <Zap size={20} color={flash === 'auto' ? LIME : '#FFFFFF'} strokeWidth={2.2} />
              )}
            </TouchableOpacity>

            {/* Shutter — enabled only when a live camera can actually capture */}
            <TouchableOpacity
              style={[styles.shutterOuter, !canCapture && !capturing && styles.shutterUnavailable]}
              onPress={handleTakePhoto}
              disabled={!canCapture}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              style={styles.translucentBtn}
              onPress={handlePickFromLibrary}
              activeOpacity={0.7}
            >
              <Images size={20} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Flip camera */}
          <TouchableOpacity
            style={[styles.flipBtn, { marginTop: 12 }]}
            onPress={handleFlip}
            disabled={!cameraReady || switching || capturing}
            activeOpacity={0.7}
          >
            <RotateCcw size={18} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            <Text style={styles.flipText}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Help bottom sheet */}
        <Modal
          visible={showHelp}
          transparent
          animationType="slide"
          onRequestClose={() => setShowHelp(false)}
        >
          <View style={styles.helpOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setShowHelp(false)}
              activeOpacity={1}
            />
            <View style={[styles.helpSheet, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.helpHandle} />
              <Text style={styles.helpTitle}>CAPTURE THE PROOF</Text>
              <Text style={styles.helpBody}>
                Document something that shows where you are today.
              </Text>
              <Text style={styles.helpBody}>
                For the best comparison, capture the same type of evidence throughout your 77 days so you can see how far you've come.
              </Text>
              <Text style={styles.helpExamples}>Examples could include:</Text>
              <View style={styles.helpBulletList}>
                <Text style={styles.helpBullet}>• A progress photo</Text>
                <Text style={styles.helpBullet}>• A dashboard or metric</Text>
                <Text style={styles.helpBullet}>• A project or piece of work</Text>
                <Text style={styles.helpBullet}>• A screenshot from your photo library</Text>
              </View>
              <Text style={styles.helpBody}>
                You can capture multiple pieces of proof throughout your journey.
              </Text>
              <TouchableOpacity
                style={styles.helpCloseBtn}
                onPress={() => setShowHelp(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.helpCloseText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const TRANSLUCENT_DARK: ViewStyle = {
  backgroundColor: 'rgba(0,0,0,0.35)',
  borderRadius: 100,
};

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCard: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    marginTop: 8,
  },
  permissionBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  permissionBtn: {
    backgroundColor: LIME,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'Inter-Bold',
  },
  permissionCancel: {
    marginTop: 8,
    padding: 8,
  },
  permissionCancelText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter-Regular',
  },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topContext: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 6,
  },
  topContextTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
    fontFamily: 'Inter-Bold',
  },
  topContextDay: {
    fontSize: 10,
    fontWeight: '700',
    color: LIME,
    letterSpacing: 1,
    fontFamily: 'Inter-Bold',
  },
  translucentBtn: {
    ...TRANSLUCENT_DARK,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cornerGuidesContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  cornerGuide: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cornerTL: {
    top: '18%',
    left: '10%',
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: '18%',
    right: '10%',
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: '24%',
    left: '10%',
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: '24%',
    right: '10%',
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 8,
  },

  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  zoomSelector: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 16,
  },
  // Touch targets: padding enlarges each option to ~44pt tall and ~50pt
  // wide (covering the pill's own padding and half the gap), and equal
  // negative margins cancel it out of layout, so the pill renders exactly
  // as before. The pill doesn't clip, so the overhang stays tappable.
  zoomOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginVertical: -14,
  },
  zoomOptionLeft: {
    paddingLeft: 16,
    marginLeft: -16,
    paddingRight: 10,
    marginRight: -10,
  },
  zoomOptionRight: {
    paddingLeft: 10,
    marginLeft: -10,
    paddingRight: 16,
    marginRight: -16,
  },
  zoomLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Bold',
  },
  zoomLabelActive: {
    color: LIME,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 30,
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterUnavailable: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  flipText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-SemiBold',
  },

  reviewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  reviewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  reviewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.5,
    fontFamily: 'Inter-Bold',
  },
  reviewCloseBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  reviewSecondaryRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 16,
  },
  reviewSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  reviewSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-SemiBold',
  },
  usePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LIME,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
  },
  usePhotoText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Black',
  },
  usePhotoArrow: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },

  helpOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  helpSheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  helpHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 12,
    fontFamily: 'Inter-Black',
  },
  helpBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  helpExamples: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  helpBulletList: {
    gap: 6,
    marginBottom: 16,
  },
  helpBullet: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  helpCloseBtn: {
    backgroundColor: LIME,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  helpCloseText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'Inter-Bold',
  },
});
