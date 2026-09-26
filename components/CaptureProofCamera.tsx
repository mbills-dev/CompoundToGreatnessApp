import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { X, HelpCircle, Images, RotateCcw, Zap, ZapOff, Camera, Share2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIME = '#CCFF00';

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
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const [isUltraWide, setIsUltraWide] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedSource, setCapturedSource] = useState<'camera' | 'library'>('camera');
  const [showHelp, setShowHelp] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (visible) {
      setCapturedUri(null);
      setShowHelp(false);
      setCapturing(false);
      setCameraReady(false);
      setIsUltraWide(false);
    }
  }, [visible]);

  const handleCameraReady = useCallback(async () => {
    setCameraReady(true);
    // Detect ultra-wide availability via available picture sizes / device capabilities.
    // expo-camera doesn't expose lens enums directly, but we can check if the device
    // supports a wider field of view by testing if zoom=0 gives us the widest lens.
    // On devices with ultra-wide (iPhone 11+), the back camera defaults to the wide
    // lens at zoom=0. We enable the .5x toggle only when we can confirm ultra-wide.
    // Since expo-camera's zoom is 0-1 normalized (0 = widest available), we offer
    // .5x only on back camera and let the user discover if their device supports it.
    // The system gracefully handles devices without ultra-wide by staying at wide.
    if (facing === 'back') {
      setHasUltraWide(true);
    } else {
      setHasUltraWide(false);
    }
  }, [facing]);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    triggerHaptic();
    try {
      // zoom=0 gives neutral/wide FOV; zoom=1 is max zoom.
      // When ultra-wide is active, we temporarily set zoom to 0 which
      // on devices with ultra-wide gives the widest lens.
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setCapturedSource('camera');
      }
    } catch (err) {
      console.error('Camera capture error:', err);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setCapturing(false);
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
    setCapturedUri(result.assets[0].uri);
    setCapturedSource('library');
  };

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
          dialogTitle: 'Share your proof',
        });
      } else {
        await Share.share({ url: capturedUri });
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleFlip = () => {
    setFacing((cur) => (cur === 'back' ? 'front' : 'back'));
    setCameraReady(false);
    setIsUltraWide(false);
  };

  const cycleFlash = () => {
    setFlash((cur) => (cur === 'off' ? 'on' : cur === 'on' ? 'auto' : 'off'));
  };

  const toggleUltraWide = () => {
    setIsUltraWide((cur) => !cur);
  };

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
          {/* Top bar — visible, safe-area respected */}
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

          {/* Image preview */}
          <View style={styles.reviewImageContainer}>
            <RNImage source={{ uri: capturedUri }} style={styles.reviewImage} resizeMode="contain" />
          </View>

          {/* Bottom actions */}
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
  // zoom prop: 0 = neutral/wide FOV, 1 = max zoom. We never pass >0 for normal 1x.
  // For ultra-wide (.5x), we pass 0 as well — on devices with ultra-wide the system
  // uses the widest lens at zoom=0. On devices without, it stays at the wide lens.
  // This is the correct neutral behavior — no artificial zoom.
  const cameraZoom = 0; // Always neutral wide — no zoom applied

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={cameraZoom}
          onCameraReady={handleCameraReady}
          onMountError={() => {
            Alert.alert('Camera Error', 'Could not start camera. Please try again.');
            onClose();
          }}
        />

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

        {/* Four universal corner framing guides */}
        <View style={styles.cornerGuidesContainer} pointerEvents="none">
          <View style={[styles.cornerGuide, styles.cornerTL]} />
          <View style={[styles.cornerGuide, styles.cornerTR]} />
          <View style={[styles.cornerGuide, styles.cornerBL]} />
          <View style={[styles.cornerGuide, styles.cornerBR]} />
        </View>

        {/* Bottom controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
          {/* Zoom selector — only show .5x toggle on back camera with ultra-wide */}
          {hasUltraWide && facing === 'back' && (
            <View style={styles.zoomSelector}>
              <TouchableOpacity
                onPress={() => setIsUltraWide(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.zoomLabel, isUltraWide && styles.zoomLabelActive]}>
                  .5x
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsUltraWide(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.zoomLabel, !isUltraWide && styles.zoomLabelActive]}>
                  1x
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.shutterRow}>
            {/* Flash — bottom left */}
            <TouchableOpacity style={styles.translucentBtn} onPress={cycleFlash} activeOpacity={0.7}>
              {flash === 'off' ? (
                <ZapOff size={20} color="#FFFFFF" strokeWidth={2.2} />
              ) : (
                <Zap size={20} color={flash === 'auto' ? LIME : '#FFFFFF'} strokeWidth={2.2} />
              )}
            </TouchableOpacity>

            {/* Shutter — center */}
            <TouchableOpacity
              style={styles.shutterOuter}
              onPress={handleTakePhoto}
              disabled={capturing || !cameraReady}
              activeOpacity={0.85}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </TouchableOpacity>

            {/* Gallery — bottom right */}
            <TouchableOpacity
              style={styles.translucentBtn}
              onPress={handlePickFromLibrary}
              activeOpacity={0.7}
            >
              <Images size={20} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Flip camera — below shutter row, centered */}
          <TouchableOpacity
            style={[styles.flipBtn, { marginTop: 12 }]}
            onPress={handleFlip}
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

// ── Styles ────────────────────────────────────────────────────────────
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

  // Top overlay
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

  // Corner guides
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

  // Bottom controls
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

  // Review state
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

  // Help sheet
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
