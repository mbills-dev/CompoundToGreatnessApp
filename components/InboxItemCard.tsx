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
  const isFriend = item.source === 'friend';

  return (
    <TouchableOpacity
      key={`${item.source}-${item.id}`}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#111111' : colors.card,
          borderColor: isUnread ? 'rgba(204,255,0,0.15)' : colors.border,
        },
      ]}
      onPress={() => isUnread && onPress(item)}
      activeOpacity={isUnread ? 0.7 : 1}
    >
      {isFriend ? (
        <FriendEncouragementItem item={item} isUnread={isUnread} />
      ) : (
        <PublicPageItem item={item} isUnread={isUnread} />
      )}

      <View style={styles.footerRow}>
        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
          {getRelativeTime(item.createdAt)}
        </Text>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
}

function FriendEncouragementItem({ item }: { item: InboxItem; isUnread: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={styles.itemBody}>
      <View style={styles.senderRow}>
        <Heart size={14} color={colors.primary} strokeWidth={2.5} fill={colors.primary} />
        <Text style={[styles.senderName, { color: colors.text }]} numberOfLines={1}>
          {item.senderName}
        </Text>
        {item.emoji && <Text style={styles.emoji}>{item.emoji}</Text>}
      </View>
      {item.message && (
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.message}
        </Text>
      )}
    </View>
  );
}

function PublicPageItem({ item }: { item: InboxItem; isUnread: boolean }) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.itemBody}>
      <View style={styles.publicEyebrowRow}>
        <Mail size={13} color={colors.primary} strokeWidth={2.5} />
        <View style={[styles.publicBadge, { backgroundColor: isDark ? 'rgba(204,255,0,0.1)' : 'rgba(204,255,0,0.08)' }]}>
          <Text style={styles.publicBadgeText}>PUBLIC PAGE</Text>
        </View>
      </View>
      <Text style={[styles.senderName, { color: colors.text }]} numberOfLines={1}>
        {item.visitorName || 'Anonymous'}
      </Text>
      {item.message && (
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 11,
    gap: 5,
  },
  itemBody: {
    gap: 3,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    flexShrink: 1,
  },
  emoji: {
    fontSize: 15,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    fontFamily: 'Inter-Bold',
  },
  publicEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publicBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  publicBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    letterSpacing: 1,
    color: '#CCFF00',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#CCFF00',
  },
});
