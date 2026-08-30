import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

export function AiThinkingIndicator({
  phrases,
  subtitle,
  size = 48,
}: {
  phrases: string[];
  subtitle?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 300 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(rotation);
    };
  }, []);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const [phraseIdx, setPhraseIdx] = useState(0);
  const phraseOpacity = useSharedValue(1);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    let step = 0;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      phraseOpacity.value = withTiming(0, { duration: 200 });
      setTimeout(() => {
        if (!mountedRef.current) return;
        step = (step + 1) % phrases.length;
        setPhraseIdx(step);
        phraseOpacity.value = withTiming(1, { duration: 200 });
      }, 200);
    }, 800);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [phrases]);
  const phraseStyle = useAnimatedStyle(() => ({ opacity: phraseOpacity.value }));

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
      <Animated.View style={[fadeStyle, { alignItems: 'center', gap: 20 }]}>
        <Animated.View style={iconStyle}>
          <Image
            source={require('@/assets/images/logo-mark-trimmed.png')}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.Text style={[{ fontSize: 16, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }, phraseStyle]}>
          {phrases[phraseIdx]}
        </Animated.Text>
        {subtitle ? (
          <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: 'center', maxWidth: 280 }}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
