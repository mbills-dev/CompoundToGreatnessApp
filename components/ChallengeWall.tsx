import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Rect, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import { Star } from 'lucide-react-native';
import { MILESTONE_DAYS, isMilestoneDay, TOTAL_CHALLENGE_DAYS } from '@/constants/milestones';
import { TileLayout } from './DayCardModal';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'day-tile-keyframes';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes milestonePulse {
        0%, 100% {
          border-color: #CCFF00;
          box-shadow: 0 0 0 3px rgba(204,255,0,0.14), 0 0 12px rgba(204,255,0,0.55), 0 0 24px rgba(204,255,0,0.20);
        }
        50% {
          border-color: rgba(204,255,0,0.5);
          box-shadow: 0 0 2px rgba(204,255,0,0.12);
        }
      }
      @keyframes firePulse {
        0%, 100% {
          border-color: #FF4400;
          box-shadow: 0 0 0 3px rgba(255,68,0,0.14), 0 0 12px rgba(255,68,0,0.55), 0 0 24px rgba(255,68,0,0.20);
        }
        50% {
          border-color: rgba(255,68,0,0.5);
          box-shadow: 0 0 2px rgba(255,68,0,0.12);
        }
      }
      .tile-milestone-glow {
        animation: milestonePulse 2s ease-in-out infinite;
      }
      .tile-fire-glow {
        animation: firePulse 2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

export interface ChallengeWallProps {
  currentDay: number;
  isDayCompleted: (day: number) => boolean;
  isLight: boolean;
  onTilePress?: (day: number, layout?: TileLayout) => void;
}

interface DayTileProps {
  day: number;
  currentDay: number;
  completed: boolean;
  isSelected: boolean;
  tileSize: number;
  isLight: boolean;
  interactive: boolean;
  onPress: (layout?: TileLayout) => void;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function DayTile({ day, currentDay, completed, isSelected, tileSize, isLight, interactive, onPress }: DayTileProps) {
  const tileRef = useRef<View>(null);
  const glowOpacity = useRef(new Animated.Value(1.0)).current;

  const handlePress = () => {
    const ref = tileRef.current as any;
    if (ref && typeof ref.measureInWindow === 'function') {
      let called = false;
      ref.measureInWindow((x: number, y: number, width: number, height: number) => {
        called = true;
        onPress({ x, y, width, height });
      });
      setTimeout(() => {
        if (!called) onPress();
      }, 32);
    } else {
      onPress();
    }
  };
  const isCurrent = day === currentDay;
  const isFuture = day > currentDay;
  const isDay77 = day === 77;
  const isCompletedMilestone = completed && isMilestoneDay(day) && !isDay77;
  const isUpcomingMilestone = !completed && isMilestoneDay(day) && !isDay77 && day > currentDay;
  const isDay77Locked = isDay77 && !completed;
  const isDay77Completed = isDay77 && completed;
  const needsGlow = isUpcomingMilestone || isDay77Locked;

  useEffect(() => {
    if (!needsGlow) return;
    glowOpacity.setValue(1.0);
    const minOpacity = isCompletedMilestone ? 0.5 : 0.3;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: minOpacity, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowOpacity, { toValue: 1.0, duration: 1000, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [needsGlow]);

  const getBg = (): string => {
    if (isDay77Completed) return '#FF4400';
    if (completed) return '#CCFF00';
    return '#2C2C2C';
  };

  const getNumberColor = (): string => {
    if (isDay77Completed) return '#FFFFFF';
    if (isDay77Locked) return '#FF4400';
    if (completed) return '#1A1A1A';
    if (isCurrent) return 'rgba(204,255,0,0.5)';
    if (isUpcomingMilestone) return '#CCFF00';
    return 'rgba(255,255,255,0.18)';
  };

  const getNumberSize = (): number => {
    if (isDay77 || isCompletedMilestone || isUpcomingMilestone) return 11;
    return 13;
  };

  const getBorderStyle = (): object => {
    if (isCurrent) return { borderWidth: 2, borderStyle: 'dashed' as const, borderColor: '#CCFF00' };
    return {};
  };

  const glowColor = isDay77Locked ? '#FF4400' : '#CCFF00';
  const BLUR = 8;
  const svgPad = BLUR * 2;
  const svgW = tileSize + svgPad * 2;
  const svgH = tileSize + svgPad * 2;
  const rx = 9;

  if (needsGlow) {
    if (!interactive) {
      return (
        <View style={{ width: tileSize, height: tileSize }}>
          <View style={{ position: 'absolute', top: -svgPad, left: -svgPad, width: svgW, height: svgH, pointerEvents: 'none' }}>
            <Svg width={svgW} height={svgH} pointerEvents="none">
              <Defs>
                <Filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <FeGaussianBlur stdDeviation={BLUR} result="blur" />
                </Filter>
              </Defs>
              <AnimatedRect
                x={svgPad}
                y={svgPad}
                width={tileSize}
                height={tileSize}
                rx={rx}
                ry={rx}
                fill={glowColor}
                filter="url(#glow)"
                opacity={glowOpacity}
              />
              <AnimatedRect
                x={svgPad + 1}
                y={svgPad + 1}
                width={tileSize - 2}
                height={tileSize - 2}
                rx={rx - 1}
                ry={rx - 1}
                fill="none"
                stroke={glowColor}
                strokeWidth={2}
                opacity={glowOpacity}
              />
            </Svg>
          </View>
          <View style={[styles.dayTile, { width: tileSize, height: tileSize, backgroundColor: getBg() }]}>
            <View style={styles.dayTileInner}>
              {(isCompletedMilestone || isDay77Completed) && (
                <View style={styles.starIconWrapper}>
                  <Star size={9} color={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} fill={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} strokeWidth={0} />
                </View>
              )}
              <Text style={[styles.dayNumber, { color: getNumberColor(), fontSize: getNumberSize() }]}>{day}</Text>
            </View>
          </View>
        </View>
      );
    }
    return (
      <TouchableOpacity
        ref={tileRef}
        onPress={handlePress}
        disabled={isFuture && !completed}
        activeOpacity={0.8}
        style={{ width: tileSize, height: tileSize }}
      >
        <View style={{ position: 'absolute', top: -svgPad, left: -svgPad, width: svgW, height: svgH, pointerEvents: 'none' }}>
          <Svg width={svgW} height={svgH} pointerEvents="none">
            <Defs>
              <Filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <FeGaussianBlur stdDeviation={BLUR} result="blur" />
              </Filter>
            </Defs>
            <AnimatedRect
              x={svgPad}
              y={svgPad}
              width={tileSize}
              height={tileSize}
              rx={rx}
              ry={rx}
              fill={glowColor}
              filter="url(#glow)"
              opacity={glowOpacity}
            />
            <AnimatedRect
              x={svgPad + 1}
              y={svgPad + 1}
              width={tileSize - 2}
              height={tileSize - 2}
              rx={rx - 1}
              ry={rx - 1}
              fill="none"
              stroke={glowColor}
              strokeWidth={2}
              opacity={glowOpacity}
            />
          </Svg>
        </View>
        <View style={[styles.dayTile, { width: tileSize, height: tileSize, backgroundColor: getBg() }]}>
          <View style={styles.dayTileInner}>
            {(isCompletedMilestone || isDay77Completed) && (
              <View style={styles.starIconWrapper}>
                <Star size={9} color={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} fill={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} strokeWidth={0} />
              </View>
            )}
            <Text style={[styles.dayNumber, { color: getNumberColor(), fontSize: getNumberSize() }]}>{day}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (!interactive) {
    return (
      <View
        style={[
          { width: tileSize, height: tileSize, borderRadius: 9 },
          getBorderStyle(),
        ]}
      >
        <View
          style={[
            styles.dayTile,
            { width: '100%', height: '100%', backgroundColor: getBg() },
          ]}
        >
          <View style={styles.dayTileInner}>
            {(isCompletedMilestone || isDay77Completed) && (
              <View style={styles.starIconWrapper}>
                <Star size={9} color={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} fill={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} strokeWidth={0} />
              </View>
            )}
            <Text style={[styles.dayNumber, { color: getNumberColor(), fontSize: getNumberSize() }]}>{day}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      ref={tileRef}
      style={[
        { width: tileSize, height: tileSize, borderRadius: 9 },
        getBorderStyle(),
      ]}
    >
      <View
        style={[
          styles.dayTile,
          { width: '100%', height: '100%', backgroundColor: getBg() },
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          disabled={isFuture && !completed}
          activeOpacity={0.8}
          style={styles.dayTileInner}
        >
          {(isCompletedMilestone || isDay77Completed) && (
            <View style={styles.starIconWrapper}>
              <Star size={9} color={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} fill={isDay77Completed ? '#FFFFFF' : '#1A1A1A'} strokeWidth={0} />
            </View>
          )}
          <Text style={[styles.dayNumber, { color: getNumberColor(), fontSize: getNumberSize() }]}>{day}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChallengeWall({ currentDay, isDayCompleted, isLight, onTilePress }: ChallengeWallProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const GRID_COLS = 7;
  const GRID_GAP = 6;
  const tileSize = containerWidth > 0
    ? Math.floor((containerWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS)
    : 0;

  const days = Array.from({ length: TOTAL_CHALLENGE_DAYS }, (_, i) => i + 1);

  const handlePress = (day: number, completed: boolean) => (layout?: TileLayout) => {
    if (onTilePress) {
      onTilePress(day, layout);
    }
  };

  return (
    <>
      <View
        style={styles.challengeGrid}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && days.map((day) => {
          const completed = !!isDayCompleted(day);
          return (
            <DayTile
              key={day}
              day={day}
              currentDay={currentDay}
              completed={completed}
              isSelected={false}
              tileSize={tileSize}
              isLight={isLight}
              interactive={!!onTilePress}
              onPress={onTilePress ? handlePress(day, completed) : () => {}}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#CCFF00' }]} />
          <Text style={[styles.legendLabel, { color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }]}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.legendSwatchToday]} />
          <Text style={[styles.legendLabel, { color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }]}>Today</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#CCFF00' }]}>
            <Star size={8} color="#1A1A1A" fill="#1A1A1A" strokeWidth={0} />
          </View>
          <Text style={[styles.legendLabel, { color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }]}>Milestone</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#FF4400' }]}>
            <Star size={8} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
          </View>
          <Text style={[styles.legendLabel, { color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }]}>Day 77</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  challengeGrid: {
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  dayTile: {
    borderRadius: 9,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0D0D0D',
  },
  dayTileInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  starIconWrapper: {
    position: 'absolute',
    top: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 16,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendSwatchToday: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CCFF00',
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'Inter-Bold',
  },
});
