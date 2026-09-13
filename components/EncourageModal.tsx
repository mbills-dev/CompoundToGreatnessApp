import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Heart, Zap, Send } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ENCOURAGE_EMOJIS = ['🔥', '💪', '👏', '⭐', '🎯', '🚀', '💰', '🙌', '⚡', '✨'];

type Props = {
  visible: boolean;
  friendName: string;
  friendPhotoUrl?: string | null;
  friendStreak: number;
  message: string;
  onMessageChange: (text: string) => void;
  onSend: () => void;
  onClose: () => void;
};

export default function EncourageModal({
  visible,
  friendName,
  friendPhotoUrl,
  friendStreak,
  message,
  onMessageChange,
  onSend,
  onClose,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: isDark ? '#0A0A0A' : '#F5F5F0', paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>SEND ENCOURAGEMENT</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <X size={22} color={colors.textTertiary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.identityRow}>
            {friendPhotoUrl ? (
              <View style={[styles.avatar, { borderColor: 'rgba(204,255,0,0.3)' }]}>
                <Text style={styles.avatarText}>{friendName.charAt(0).toUpperCase()}</Text>
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.backgroundSecondary, borderColor: 'rgba(204,255,0,0.3)' }]}>
                <Text style={styles.avatarText}>{friendName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={1}>{friendName}</Text>
            <View style={styles.streakPill}>
              <View style={styles.streakNumberRow}>
                <Zap size={15} color={colors.primary} fill={colors.primary} strokeWidth={2.5} />
                <Text style={[styles.streakNumber, { color: colors.text }]}>{friendStreak}</Text>
              </View>
              <Text style={[styles.streakLabel, { color: colors.primary }]}>DAY STREAK</Text>
            </View>
          </View>

          <TextInput
            style={[styles.messageInput, { backgroundColor: isDark ? '#1A1A1A' : 'rgba(0,0,0,0.04)', borderColor: colors.border, color: colors.text }]}
            placeholder="Write an encouraging message..."
            placeholderTextColor={colors.textTertiary}
            value={message}
            onChangeText={onMessageChange}
            multiline
            autoFocus
            maxLength={500}
            selectionColor="#CCFF00"
          />

          <Text style={styles.sectionLabel}>QUICK ENCOURAGEMENT</Text>

          <View style={styles.emojiRow}>
            {ENCOURAGE_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiButton, { backgroundColor: isDark ? '#1A1A1A' : 'rgba(0,0,0,0.04)', borderColor: isDark ? '#2A2A2A' : colors.border }]}
                onPress={() => onMessageChange(message + emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={onSend}
            activeOpacity={0.85}
          >
            <Heart size={18} color="#000000" strokeWidth={2.5} fill="#000000" />
            <Text style={styles.sendButtonText}>SEND ENCOURAGEMENT</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  closeButton: {
    padding: 4,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
  },
  identityName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
  },
  streakPill: {
    alignItems: 'flex-end',
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  streakNumber: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  streakLabel: {
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1,
    marginTop: 1,
  },
  messageInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    minHeight: 72,
    maxHeight: 112,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    color: '#CCFF00',
    marginTop: 16,
    marginBottom: 10,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emojiText: {
    fontSize: 24,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#CCFF00',
    borderRadius: 14,
    paddingVertical: 16,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
    letterSpacing: 0.8,
  },
});
