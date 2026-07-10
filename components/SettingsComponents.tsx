import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Camera, User, ChevronRight, Check } from 'lucide-react-native';

const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const THUMB_SIZE = 27;
const THUMB_OFFSET = 2;

interface CustomToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  activeColor: string;
  isDark: boolean;
}

function CustomToggle({ value, onValueChange, activeColor, isDark }: CustomToggleProps) {
  const inactiveTrack = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(120,120,128,0.2)';

  const trackStyle = useAnimatedStyle(() => {
    const bg = withTiming(value ? activeColor : inactiveTrack, { duration: 200 });
    return { backgroundColor: bg };
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: withTiming(value ? TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET : THUMB_OFFSET, { duration: 200 }),
    }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

interface ProfilePhotoSectionProps {
  profilePhoto: string | null;
  uploading: boolean;
  onPress: () => void;
  colors: any;
}

export function ProfilePhotoSection({ profilePhoto, uploading, onPress, colors }: ProfilePhotoSectionProps) {
  return (
    <TouchableOpacity style={styles.profileSection} onPress={onPress} disabled={uploading} activeOpacity={0.7}>
      {profilePhoto ? (
        <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
      ) : (
        <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.textTertiary }]}>
          <User size={36} color="#FFFFFF" strokeWidth={1.8} />
        </View>
      )}
      <View style={[styles.cameraButton, { backgroundColor: colors.primary }]}>
        {uploading ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Camera size={14} color="#000000" strokeWidth={2.5} />
        )}
      </View>
    </TouchableOpacity>
  );
}

interface ProfileInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: any;
  isDark: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  isFirst?: boolean;
  isLast?: boolean;
}

export function ProfileInput({ label, value, onChangeText, placeholder, colors, isDark, keyboardType = 'default', autoCapitalize = 'words', isFirst, isLast }: ProfileInputProps) {
  return (
    <View style={[
      styles.glassInputRow,
      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' },
      isFirst && styles.glassInputFirst,
      isLast && styles.glassInputLast,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
    ]}>
      <Text style={[styles.glassInputLabel, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[styles.glassInput, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

interface GlassPanelProps {
  children: React.ReactNode;
  isDark: boolean;
  colors: any;
}

export function GlassPanel({ children, isDark, colors }: GlassPanelProps) {
  return (
    <View style={[
      styles.glassPanel,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      },
    ]}>
      {children}
    </View>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  colors: any;
  isDark: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export function ToggleRow({ icon, title, description, value, onValueChange, colors, isDark, isFirst, isLast }: ToggleRowProps) {
  return (
    <View style={[
      styles.glassRow,
      isFirst && styles.glassRowFirst,
      isLast && styles.glassRowLast,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
    ]}>
      <View style={styles.rowIconSmall}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {description && <Text style={[styles.rowDescription, { color: colors.textTertiary }]}>{description}</Text>}
      </View>
      <CustomToggle
        value={value}
        onValueChange={onValueChange}
        activeColor={colors.primary}
        isDark={isDark}
      />
    </View>
  );
}

interface DayEndTimePickerProps {
  selectedTime: string;
  onSelect: (time: string) => void;
  showPicker: boolean;
  onTogglePicker: () => void;
  colors: any;
  isDark: boolean;
}

const DAY_END_OPTIONS = [
  '10:00 PM',
  '10:30 PM',
  '11:00 PM',
  '11:30 PM',
  '11:59 PM',
  '12:00 AM',
  '12:30 AM',
  '1:00 AM',
];

export function DayEndTimePicker({ selectedTime, onSelect, showPicker, onTogglePicker, colors, isDark }: DayEndTimePickerProps) {
  return (
    <View>
      <TouchableOpacity
        style={[styles.glassRow, styles.glassRowFirst, !showPicker && styles.glassRowLast]}
        onPress={onTogglePicker}
        activeOpacity={0.6}
      >
        <View style={styles.rowIconSmall}>
          <Text style={{ fontSize: 18 }}>&#x1F552;</Text>
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Day End Time</Text>
        </View>
        <Text style={[styles.rowValue, { color: colors.primary }]}>{selectedTime}</Text>
        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
      {showPicker && (
        <View style={[
          styles.timePickerContainer,
          { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
        ]}>
          {DAY_END_OPTIONS.map((time, index) => {
            const isSelected = selectedTime === time;
            const isLastOption = index === DAY_END_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeOption,
                  !isLastOption && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                  isLastOption && styles.glassRowLast,
                ]}
                onPress={() => onSelect(time)}
                activeOpacity={0.5}
              >
                <Text style={[
                  styles.timeOptionText,
                  { color: isSelected ? colors.primary : colors.text },
                  isSelected && { fontWeight: '700' },
                ]}>
                  {time}
                </Text>
                {isSelected && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

interface ActionRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: any;
  isDark: boolean;
  variant?: 'default' | 'danger';
  isFirst?: boolean;
  isLast?: boolean;
}

export function ActionRow({ icon, title, subtitle, onPress, colors, isDark, variant = 'default', isFirst, isLast }: ActionRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.glassRow,
        isFirst && styles.glassRowFirst,
        isLast && styles.glassRowLast,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
      ]}
      onPress={onPress}
      activeOpacity={0.5}
    >
      <View style={styles.rowIconSmall}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: variant === 'danger' ? '#EF4444' : colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.rowDescription, { color: colors.textTertiary }]}>{subtitle}</Text>}
      </View>
      <ChevronRight size={16} color={variant === 'danger' ? 'rgba(239,68,68,0.5)' : colors.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 8,
  },
  profilePhoto: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  profilePhotoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  glassPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 20,
  },
  glassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 48,
  },
  glassRowFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  glassRowLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  glassInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  glassInputFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  glassInputLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  glassInputLabel: {
    fontSize: 15,
    fontWeight: '600',
    width: 90,
  },
  glassInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    padding: 0,
    textAlign: 'right',
  },
  rowIconSmall: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowDescription: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
    lineHeight: 16,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  toggleTrack: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  timePickerContainer: {
    overflow: 'hidden',
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
