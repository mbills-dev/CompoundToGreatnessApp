import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';

interface ProofIconButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
  /** Pass through exactly; omit to keep React Native's default (0.2). */
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
}

/** 40pt round, dark translucent icon button that stays legible over photos. */
export default function ProofIconButton({
  onPress,
  accessibilityLabel,
  children,
  disabled,
  activeOpacity,
  style,
}: ProofIconButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5,5,5,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
