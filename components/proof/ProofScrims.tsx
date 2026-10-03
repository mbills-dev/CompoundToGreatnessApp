import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProofScrimsProps {
  /** Height of the top scrim (callers include the safe-area inset). */
  topHeight: number;
}

/**
 * Legibility scrims for text overlaid on an immersive proof canvas. The top
 * one sits under header text; the bottom one sits under the caption and fades
 * the photo into the near-black area below it. Place inside the canvas, after
 * the photo and before any overlaid text.
 */
export default function ProofScrims({ topHeight }: ProofScrimsProps) {
  return (
    <>
      <LinearGradient
        colors={['rgba(5,5,5,0.6)', 'rgba(5,5,5,0)']}
        style={[styles.top, { height: topHeight }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.6)', '#050505']}
        locations={[0, 0.55, 1]}
        style={styles.bottom}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
  },
});
