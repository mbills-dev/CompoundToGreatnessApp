import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Modal,
  Clipboard,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Copy, Share2, X, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

export default function InviteWatcherModal({ visible, onClose, userId }: Props) {
  const { colors, isDark } = useTheme();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUsername();
    }
  }, [visible]);

  const loadUsername = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.username) {
        setUsername(profile.username);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const getShareLink = () => {
    if (!username) return '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}/watch/${username}`;
    }
    return `https://app.77daychallenge.com/watch/${username}`;
  };

  const handleCopy = async () => {
    Clipboard.setString(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I'm on Day ${0} of my 77-Day Challenge. Follow along and watch my journey for free:\n\n${getShareLink()}`,
        url: getShareLink(),
      });
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: isDark ? '#0A0A0A' : '#F5F5F0' }]}>
          <View style={styles.dragHandle} />

          <View style={styles.topRow}>
            <Text style={[styles.title, { color: colors.text }]}>Invite a Watcher</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={22} color={colors.textTertiary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.eyeRow}>
            <View style={[styles.eyeCircle, { borderColor: 'rgba(204, 255, 0, 0.3)' }]}>
              <Eye size={32} color="#ccff00" strokeWidth={2} />
            </View>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Share your unique link with anyone. They can watch your journey completely free — no subscription needed.
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#ccff00" />
            </View>
          ) : (
            <>
              <View style={[styles.codeCard, { backgroundColor: isDark ? '#111' : '#FFFFFF', borderColor: isDark ? '#1A1A1A' : '#E0E0DB' }]}>
                <Text style={[styles.codeLabel, { color: colors.textTertiary }]}>YOUR INVITE LINK</Text>
                <Text style={[styles.codeText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                  {getShareLink()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
              >
                <LinearGradient colors={['#ccff00', '#aed900']} style={styles.shareButtonGradient}>
                  <Share2 size={20} color="#000000" strokeWidth={2.5} />
                  <Text style={styles.shareButtonText}>Share Invite Link</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: isDark ? '#111' : '#FFFFFF', borderColor: isDark ? '#1A1A1A' : '#E0E0DB' }]}
                onPress={handleCopy}
              >
                {copied ? (
                  <>
                    <Check size={20} color="#ccff00" strokeWidth={2.5} />
                    <Text style={[styles.copyButtonText, { color: '#ccff00' }]}>Copied!</Text>
                  </>
                ) : (
                  <>
                    <Copy size={20} color={colors.textSecondary} strokeWidth={2.5} />
                    <Text style={[styles.copyButtonText, { color: colors.textSecondary }]}>Copy Link</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={[styles.infoBox, { backgroundColor: isDark ? '#0D0D0D' : '#FFFFFF', borderColor: isDark ? '#1A1A1A' : '#E0E0DB' }]}>
                <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                  Watchers see your streak, identity, and daily progress. They can't see your personal settings or edit anything. Share freely.
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '900' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeRow: { alignItems: 'center', marginBottom: 20 },
  eyeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  loadingContainer: { height: 100, alignItems: 'center', justifyContent: 'center' },
  codeCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  shareButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  shareButtonText: { fontSize: 16, fontWeight: '900', color: '#000000' },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  copyButtonText: { fontSize: 15, fontWeight: '700' },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
});
