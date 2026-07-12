import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Heart, Mail } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { InboxItem } from '@/lib/inboxHelpers';

function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

type Props = {
  item: InboxItem;
  onPress: (item: InboxItem) => void;
};

export default function InboxItemCard({ item, onPress }: Props) {
  const { colors, isDark } = useTheme();
  const isUnread = !item.readAt;

  return (
    <TouchableOpacity
      key={`${item.source}-${item.id}`}
      style={[
        styles.inboxCard,
        {
          backgroundColor: isUnread
            ? isDark ? '#1A1A14' : '#F5F8E8'
            : colors.card,
          borderColor: isUnread ? 'rgba(204,255,0,0.25)' : colors.border,
        },
      ]}
      onPress={() => isUnread && onPress(item)}
      activeOpacity={isUnread ? 0.7 : 1}
    >
      <View style={styles.inboxCardHeader}>
        <View style={styles.inboxSenderRow}>
          {item.source === 'friend' ? (
            <Heart size={14} color={colors.primary} strokeWidth={2.5} />
          ) : (
            <Mail size={14} color={colors.primary} strokeWidth={2.5} />
          )}
          <Text style={[styles.inboxSenderName, { color: colors.text }]} numberOfLines={1}>
            {item.senderName}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
      {item.emoji && <Text style={styles.inboxEmoji}>{item.emoji}</Text>}
      {item.message && (
        <Text style={[styles.inboxMessage, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.message}
        </Text>
      )}
      <Text style={[styles.inboxTimestamp, { color: colors.textTertiary }]}>
        {getRelativeTime(item.createdAt)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inboxCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  inboxCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inboxSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  inboxSenderName: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    flexShrink: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCFF00',
    marginLeft: 8,
  },
  inboxEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  inboxMessage: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  inboxTimestamp: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
});
