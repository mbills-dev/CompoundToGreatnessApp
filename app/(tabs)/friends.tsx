import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, UserPlus, Eye, Share2, Zap } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { computeCurrentStreak } from '@/lib/streakHelpers';
import InviteWatcherModal from '@/components/InviteWatcherModal';
import { getInboxItems, markInboxItemRead, type InboxItem } from '@/lib/inboxHelpers';
import InboxItemCard from '@/components/InboxItemCard';
import { useRouter } from 'expo-router';
import { Animated } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFriends, friendsKey, FriendWithStreak } from '@/hooks/useFriends';

interface SearchResult {
  id: string;
  username: string;
  display_name: string;
  photo_url?: string | null;
}

export default function FriendsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isSubscribed } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendWithStreak[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();
  const { data: friendsData, isLoading: loading, error: friendsLoadError } = useQuery({
    queryKey: friendsKey(user?.id),
    queryFn: () => fetchFriends(user!.id),
    enabled: !!user,
  });
  useEffect(() => {
    if (friendsData) setFriends(friendsData);
  }, [friendsData]);
  const loadFriends = () => {
    return queryClient.invalidateQueries({ queryKey: friendsKey(user?.id) });
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const items = await getInboxItems(user.id);
        setInboxItems(items);
      } catch {
        // silently fail — inbox is non-critical
      }
    })();
  }, [user]);

  const handleMarkInboxRead = async (item: InboxItem) => {
    setInboxItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
    );
    try {
      await markInboxItemRead(item);
    } catch {
      // revert on failure
      setInboxItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, readAt: null } : i)),
      );
    }
  };

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchUsername.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      if (!user) return;
      try {
        const { data, error: sErr } = await supabase
          .from('profiles')
          .select('id, username, display_name, photo_url')
          .ilike('username', `%${searchUsername.trim()}%`)
          .neq('id', user.id)
          .limit(10);
        if (sErr) throw sErr;
        setSearchResults(data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchUsername, user]);

  const addFriend = async (friendId: string) => {
    if (!user) return;
    try {
      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        setError('Friend request already sent or you are already friends.');
        return;
      }

      // Frictionless: create as accepted directly
      const { error: insErr } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'accepted',
        });
      if (insErr) throw insErr;

      setSearchUsername('');
      setSearchResults([]);
      await loadFriends();
    } catch (e: any) {
      setError(e.message || 'Failed to add friend');
    }
  };

  const toggleWatch = async (friendId: string) => {
    if (!user) return;
    const isCurrentlyWatching = friends.find((f) => f.id === friendId)?.isWatching;
    // Optimistic update
    setFriends((prev) =>
      prev.map((f) =>
        f.id === friendId
          ? {
              ...f,
              isWatching: !f.isWatching,
              watchers: f.isWatching ? f.watchers - 1 : f.watchers + 1,
            }
          : f
      )
    );
    try {
      if (isCurrentlyWatching) {
        const { error: delErr } = await supabase
          .from('watchers')
          .delete()
          .eq('watcher_id', user.id)
          .eq('watched_id', friendId);
        if (delErr) throw delErr;
      } else {
        const { error: insErr } = await supabase
          .from('watchers')
          .insert({ watcher_id: user.id, watched_id: friendId });
        if (insErr) throw insErr;
      }
    } catch (e: any) {
      // Revert on failure
      setFriends((prev) =>
        prev.map((f) =>
          f.id === friendId
            ? {
                ...f,
                isWatching: isCurrentlyWatching ?? false,
                watchers: isCurrentlyWatching ? f.watchers + 1 : f.watchers - 1,
              }
            : f
        )
      );
      setError(e.message || 'Failed to toggle watch');
    }
  };

  const sendEncouragement = async (friendId: string, emoji: string | null) => {
    if (!user) return;
    try {
      const { error: insErr } = await supabase
        .from('encouragements')
        .insert({
          from_user_id: user.id,
          to_user_id: friendId,
          emoji,
          message: encouragementMessage.trim() || null,
        });
      if (insErr) throw insErr;
      setSelectedFriend(null);
      setEncouragementMessage('');
    } catch (e: any) {
      setError(e.message || 'Failed to send encouragement');
    }
  };

  const sendQuickReact = async (friendId: string, emoji: string) => {
    if (!user) return;
    try {
      const { error: insErr } = await supabase
        .from('encouragements')
        .insert({
          from_user_id: user.id,
          to_user_id: friendId,
          emoji,
          message: null,
        });
      if (insErr) throw insErr;
    } catch (e: any) {
      setError(e.message || 'Failed to send reaction');
    }
  };

  const displayError = error ?? (friendsLoadError ? (friendsLoadError as Error).message || 'Failed to load friends' : null);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={isDark ? ['#000000', '#111111', '#000000'] : ['#F5F5F0', '#F0F0EB', '#F5F5F0']}
        style={styles.gradient}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Your Friends</Text>
            </View>
          </View>

          {isSubscribed && user ? (
            <TouchableOpacity
              style={[styles.inviteButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowInviteModal(true)}
            >
              <Share2 size={18} color="#000000" strokeWidth={2.5} />
              <Text style={styles.inviteButtonText}>Invite Watchers</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.addFriendSection}>
          <View style={styles.addFriendInputContainer}>
            <TextInput
              style={[styles.addFriendInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter username"
              placeholderTextColor={colors.textTertiary}
              value={searchUsername}
              onChangeText={setSearchUsername}
              autoCapitalize="none"
            />
          </View>

          {searching ? (
            <View style={styles.searchLoadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.searchLoadingText, { color: colors.textTertiary }]}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <View style={[styles.searchResultsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.searchResultRow}
                  onPress={() => addFriend(result.id)}
                >
                  {result.photo_url ? (
                    <Image source={{ uri: result.photo_url }} style={styles.searchResultAvatar} />
                  ) : (
                    <View style={[styles.searchResultAvatar, styles.avatarPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                      <Text style={styles.avatarText}>
                        {(result.display_name || result.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.searchResultInfo}>
                    <Text style={[styles.searchResultName, { color: colors.text }]}>
                      {result.display_name || 'Unknown'}
                    </Text>
                    <Text style={[styles.searchResultUsername, { color: colors.textTertiary }]}>
                      @{result.username}
                    </Text>
                  </View>
                  <UserPlus size={20} color={colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {inboxItems.length > 0 && (
          <View style={styles.inboxSection}>
            <Text style={[styles.inboxLabel, { color: colors.textTertiary }]}>ENCOURAGEMENT</Text>
            <View style={styles.inboxList}>
              {[...inboxItems]
                .sort((a, b) => {
                  const aUnread = a.readAt ? 0 : 1;
                  const bUnread = b.readAt ? 0 : 1;
                  if (aUnread !== bUnread) return bUnread - aUnread;
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                })
                .slice(0, 1)
                .map((item) => (
                  <InboxItemCard key={`${item.source}-${item.id}`} item={item} onPress={handleMarkInboxRead} />
                ))}
            </View>
            {inboxItems.length > 1 && (
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => router.push('/inbox')}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeAllText, { color: colors.primary }]}>
                  See all ({inboxItems.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {displayError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{displayError}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={[styles.errorDismiss, { color: colors.primary }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {friends.length} {friends.length === 1 ? 'person' : 'people'} crushing their goals
          </Text>

          <View style={styles.friendsList}>
            {friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  Add friends to see their progress and send encouragement!
                </Text>
              </View>
            ) : (
              friends.map((friend) => (
                <View key={friend.id} style={styles.friendCard}>
                  <LinearGradient
                    colors={colors.cardGradient as [string, string, ...string[]]}
                    style={[styles.friendCardGradient, { backgroundColor: colors.card }]}
                  >
                    <View style={styles.friendHeader}>
                      <TouchableOpacity
                        style={styles.friendInfo}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/friend/${friend.id}`)}
                      >
                        {friend.photo_url ? (
                          <Image source={{ uri: friend.photo_url }} style={styles.avatarImage} />
                        ) : (
                          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                            <Text style={styles.avatarText}>
                              {friend.display_name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.friendDetails}>
                          <Text style={[styles.friendName, { color: colors.text }]}>{friend.display_name}</Text>
                          <Text style={[styles.friendUsername, { color: colors.textTertiary }]}>@{friend.username}</Text>
                          <Text style={[styles.friendGoal, { color: colors.textSecondary }]} numberOfLines={1}>
                            {friend.goalTitle}
                          </Text>
                          <View style={styles.friendStats}>
                            <Eye size={14} color={colors.textTertiary} strokeWidth={2.5} />
                            <Text style={[styles.friendWatchers, { color: colors.textTertiary }]}>
                              {friend.watchers} watching
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={[styles.streakBadge, { backgroundColor: isDark ? '#000000' : '#1A1A1A' }]}>
                        <Zap size={20} color={colors.primary} fill={colors.primary} strokeWidth={2.5} />
                        <Text style={styles.streakNumber}>{friend.streak}</Text>
                        <Text style={[styles.streakLabel, { color: colors.primary }]}>DAY STREAK</Text>
                      </View>
                    </View>

                    <View style={styles.encouragementSection}>
                      {selectedFriend === friend.id ? (
                        <View style={styles.encouragementForm}>
                          <TextInput
                            style={[styles.messageInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                            placeholder="Add a message (optional)"
                            placeholderTextColor={colors.textTertiary}
                            value={encouragementMessage}
                            onChangeText={setEncouragementMessage}
                            multiline
                          />
                          <View style={styles.emojiButtons}>
                            {['🔥', '💪', '👏', '⭐', '🎯', '🚀'].map((emoji) => (
                              <TouchableOpacity
                                key={emoji}
                                style={[
                                  styles.emojiButton,
                                  {
                                    backgroundColor: isDark ? '#1A1A1A' : colors.backgroundSecondary,
                                    borderColor: isDark ? '#2A2A2A' : colors.border,
                                    borderWidth: 2,
                                  },
                                ]}
                                onPress={() => setEncouragementMessage(prev => prev + emoji)}
                              >
                                <Text style={styles.emojiButtonText}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={styles.encouragementActions}>
                            <TouchableOpacity
                              style={styles.cancelButton}
                              onPress={() => {
                                setSelectedFriend(null);
                                setEncouragementMessage('');
                              }}
                            >
                              <Text style={[styles.cancelButtonText, { color: colors.textTertiary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.sendButton, { backgroundColor: colors.primary }]}
                              onPress={() => sendEncouragement(friend.id, null)}
                            >
                              <Text style={styles.sendButtonText}>Send</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.actionButtons}>
                          <QuickReactRow friendId={friend.id} onReact={sendQuickReact} />
                          <View style={styles.mainActionButtons}>
                          <TouchableOpacity
                            style={styles.watchButton}
                            onPress={() => toggleWatch(friend.id)}
                          >
                            <LinearGradient
                              colors={friend.isWatching ? [colors.primary, colors.primaryDark] : isDark ? ['#404040', '#2A2A2A'] : ['#1A1A1A', '#111111']}
                              style={styles.watchButtonGradient}
                            >
                              <Eye
                                size={18}
                                color={friend.isWatching ? "#000000" : "#FFFFFF"}
                                strokeWidth={2.5}
                                fill="transparent"
                              />
                              <Text style={[styles.watchButtonText, { color: friend.isWatching ? "#000000" : "#FFFFFF" }]}>
                                {friend.isWatching ? 'Watching' : 'Watch'}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.encourageButton, { backgroundColor: colors.backgroundSecondary, borderColor: 'rgba(204,255,0,0.3)', borderWidth: 1.5 }]}
                            onPress={() => setSelectedFriend(friend.id)}
                          >
                              <Heart size={18} color={colors.primary} strokeWidth={2.5} />
                              <Text style={[styles.encourageButtonText, { color: colors.primary }]}>Encourage</Text>
                          </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </View>
              ))
            )}
          </View>
        </View>
      </LinearGradient>
    </ScrollView>

    {user ? (
      <InviteWatcherModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        userId={user.id}
      />
    ) : null}
  </>
  );
}

const QUICK_EMOJIS = ['🔥', '💪', '👏', '🚀'];

function QuickReactButton({ emoji, onPress }: { emoji: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.quickReactButton}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.Text style={[styles.quickReactEmoji, { transform: [{ scale }] }]}>
        {emoji}
      </Animated.Text>
    </TouchableOpacity>
  );
}

function QuickReactRow({ friendId, onReact }: { friendId: string; onReact: (friendId: string, emoji: string) => void }) {
  return (
    <View style={styles.quickReactRow}>
      {QUICK_EMOJIS.map((emoji) => (
        <QuickReactButton
          key={emoji}
          emoji={emoji}
          onPress={() => onReact(friendId, emoji)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    color: '#000000',
  },
  gradient: {
    minHeight: '100%',
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  addFriendSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  addFriendInputContainer: {
    flexDirection: 'row',
  },
  addFriendInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    padding: 18,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Inter-Black',
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  searchLoadingText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  searchResultsContainer: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-Black',
  },
  searchResultUsername: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    marginTop: 2,
  },
  errorContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(252,67,61,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(252,67,61,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    color: '#fc433d',
  },
  errorDismiss: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  content: {
    padding: 24,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    marginBottom: 24,
  },
  friendsList: {
    gap: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  friendCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  friendCardGradient: {
    padding: 24,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  friendInfo: {
    flexDirection: 'row',
    gap: 16,
    flex: 1,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(204,255,0,0.3)',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  friendGoal: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    marginBottom: 6,
  },
  friendStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  friendWatchers: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
  },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(204,255,0,0.3)',
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#FFFFFF',
    marginTop: 4,
  },
  streakLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
    letterSpacing: 1,
    marginTop: 2,
    textAlign: 'center',
    marginRight: -1,
  },
  encouragementSection: {
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 10,
  },
  mainActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickReactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  quickReactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(204, 255, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.15)',
  },
  quickReactEmoji: {
    fontSize: 22,
  },
  watchButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  watchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  watchButtonText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
  },
  encourageButton: {
    flex: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  encourageButtonText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Inter-Bold',
  },
  encouragementForm: {
    gap: 12,
  },
  messageInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-Bold',
    minHeight: 80,
  },
  emojiButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  emojiButton: {
    width: 56,
    height: 56,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  emojiButtonText: {
    fontSize: 28,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
  encouragementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sendButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
    color: '#000000',
  },
  inboxSection: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  inboxLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    fontFamily: 'Inter-Black',
  },
  inboxList: {
    gap: 10,
  },
  seeAllButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
  },
});
