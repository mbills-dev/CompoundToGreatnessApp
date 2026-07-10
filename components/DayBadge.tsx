import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

const MILESTONE_DAYS = [7, 21, 40, 77];

const MILESTONE_LABELS: Record<number, string> = {
  7: 'WEEK 1',
  21: '3 WEEKS',
  40: 'HALFWAY',
  77: 'COMPLETE',
};

const MILESTONE_SUBTITLES: Record<number, string> = {
  7: 'Your first week. The hardest one.',
  21: "Three weeks in. You're wired different.",
  40: 'Halfway. Most people quit before here.',
  77: 'All 77 days. You became the person.',
};

interface DayBadgeProps {
  day: number;
  isMilestone: boolean;
}

export function DayBadge({ day, isMilestone }: DayBadgeProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const shieldPath = 'M55 4 L100 20 L100 58 C100 80 80 97 55 108 C30 97 10 80 10 58 L10 20 Z';
  const innerRing1 = 'M55 12 L92 26 L92 58 C92 76 74 91 55 101 C36 91 18 76 18 58 L18 26 Z';
  const innerRing2 = 'M55 20 L84 32 L84 58 C84 73 68 86 55 95 C42 86 26 73 26 58 L26 32 Z';

  const borderColor = isMilestone ? '#FF6B00' : '#CCFF00';
  const bgColor = isMilestone ? '#1a0800' : '#161616';
  const numberColor = isMilestone && day === 77 ? '#FF6B00' : '#ffffff';
  const labelColor = isMilestone ? '#FF6B00' : '#CCFF00';
  const badgeSize = isMilestone ? 130 : 100;
  const viewBox = '0 0 110 115';

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }] }]}>
      <Svg width={badgeSize} height={badgeSize * 1.05} viewBox={viewBox}>
        <Path d={shieldPath} fill={bgColor} stroke={borderColor} strokeWidth={isMilestone ? 2.5 : 2} />
        {isMilestone && (
          <>
            <Path d={innerRing1} fill="none" stroke={borderColor} strokeWidth={1} opacity={0.4} />
            {day >= 40 && <Path d={innerRing2} fill="none" stroke={borderColor} strokeWidth={1} opacity={0.2} />}
          </>
        )}
        {isMilestone ? (
          <>
            <SvgText x="55" y="44" textAnchor="middle" fontSize={9} fontWeight="700" fill={labelColor} letterSpacing={2} fontFamily="sans-serif">
              {MILESTONE_LABELS[day]}
            </SvgText>
            <SvgText x="55" y="74" textAnchor="middle" fontSize={day >= 40 ? 26 : 30} fontWeight="900" fill={numberColor} fontFamily="sans-serif">
              {day}
            </SvgText>
          </>
        ) : (
          <>
            <SvgText x="55" y="46" textAnchor="middle" fontSize={9} fontWeight="700" fill={labelColor} letterSpacing={2} fontFamily="sans-serif">
              DAY
            </SvgText>
            <SvgText x="55" y="76" textAnchor="middle" fontSize={30} fontWeight="900" fill="#ffffff" fontFamily="sans-serif">
              {day}
            </SvgText>
          </>
        )}
      </Svg>

      {isMilestone ? (
        <>
          <Text style={[styles.milestoneTitle, { color: borderColor }]}>
            {MILESTONE_LABELS[day]} Unlocked
          </Text>
          <Text style={styles.milestoneSubtitle}>{MILESTONE_SUBTITLES[day]}</Text>
        </>
      ) : (
        <Text style={styles.dailyLabel}>Compounded</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  dailyLabel: { fontSize: 10, color: '#444', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 },
  milestoneTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 },
  milestoneSubtitle: { fontSize: 11, color: '#555', marginTop: 4, textAlign: 'center', lineHeight: 17 },
});
