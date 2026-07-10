import React, { useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export function RacingBorder({ visible, onComplete }: { visible: boolean; onComplete: () => void }) {
  const insets = useSafeAreaInsets();
  const totalHeight = SCREEN_HEIGHT;

  const topWidth    = useSharedValue(0);
  const rightHeight = useSharedValue(0);
  const bottomWidth = useSharedValue(0);
  const leftHeight  = useSharedValue(0);
  const opacity     = useSharedValue(1);

  const DURATION = 175;

  const topStyle    = useAnimatedStyle(() => ({ width: topWidth.value, opacity: opacity.value }));
  const rightStyle  = useAnimatedStyle(() => ({ height: rightHeight.value, opacity: opacity.value }));
  const bottomStyle = useAnimatedStyle(() => ({ width: bottomWidth.value, opacity: opacity.value }));
  const leftStyle   = useAnimatedStyle(() => ({ height: leftHeight.value, opacity: opacity.value }));

  useEffect(() => {
    if (!visible) return;

    topWidth.value    = 0;
    rightHeight.value = 0;
    bottomWidth.value = 0;
    leftHeight.value  = 0;
    opacity.value     = 1;

    topWidth.value = withTiming(SCREEN_WIDTH, { duration: DURATION, easing: Easing.linear }, () => {
      rightHeight.value = withTiming(totalHeight, { duration: DURATION, easing: Easing.linear }, () => {
        bottomWidth.value = withTiming(SCREEN_WIDTH, { duration: DURATION, easing: Easing.linear }, () => {
          leftHeight.value = withTiming(totalHeight, { duration: DURATION, easing: Easing.linear }, () => {
            opacity.value = withDelay(80, withTiming(0, { duration: 250 }, () => {
              runOnJS(onComplete)();
            }));
          });
        });
      });
    });
  }, [visible]);

  if (!visible) return null;

  const THICKNESS = 3;
  const GLOW = 12;
  const COLOR = '#CCFF00';

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0,
      width: SCREEN_WIDTH, height: totalHeight,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      <Animated.View style={[{
        position: 'absolute', top: 0, left: 0,
        height: THICKNESS, backgroundColor: COLOR,
        shadowColor: COLOR, shadowOpacity: 0.8, shadowRadius: GLOW, shadowOffset: { width: 0, height: 0 },
      }, topStyle]} />

      <Animated.View style={[{
        position: 'absolute', top: 0, right: 0,
        width: THICKNESS, backgroundColor: COLOR,
        shadowColor: COLOR, shadowOpacity: 0.8, shadowRadius: GLOW, shadowOffset: { width: 0, height: 0 },
      }, rightStyle]} />

      <Animated.View style={[{
        position: 'absolute', bottom: insets.bottom, right: 0,
        height: THICKNESS, backgroundColor: COLOR,
        shadowColor: COLOR, shadowOpacity: 0.8, shadowRadius: GLOW, shadowOffset: { width: 0, height: 0 },
      }, bottomStyle]} />

      <Animated.View style={[{
        position: 'absolute', bottom: insets.bottom, left: 0,
        width: THICKNESS, backgroundColor: COLOR,
        shadowColor: COLOR, shadowOpacity: 0.8, shadowRadius: GLOW, shadowOffset: { width: 0, height: 0 },
      }, leftStyle]} />
    </View>
  );
}
