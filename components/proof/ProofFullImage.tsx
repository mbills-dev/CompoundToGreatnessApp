import React from 'react';
import { Pressable, Image, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import ProofIconButton from './ProofIconButton';

interface ProofFullImageProps {
  /** The proof to show complete and uncropped; null renders nothing. */
  uri: string | null;
  onClose: () => void;
  /** Safe-area top inset, for placing the close button. */
  topInset: number;
}

/**
 * The complete, uncropped original (`contain` on near-black). Tap anywhere or
 * the close button to dismiss. Rendered as an absolute layer, so it must be
 * placed last inside a full-screen container (e.g. inside an existing Modal).
 * Display only: the stored proof is never modified.
 */
export default function ProofFullImage({ uri, onClose, topInset }: ProofFullImageProps) {
  if (!uri) return null;
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      <ProofIconButton
        onPress={onClose}
        accessibilityLabel="Close full proof"
        style={[styles.close, { top: topInset + 12 }]}
      >
        <X size={20} color="#FFFFFF" strokeWidth={2.5} />
      </ProofIconButton>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    right: 20,
  },
});
