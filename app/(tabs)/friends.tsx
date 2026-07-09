import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, UserPlus, Send, Eye, Share2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import InviteWatcherModal from '@/components/InviteWatcherModal';

interface FriendWithStreak {
  id: string;
  username: string;
  display_name: string;
  streak: number;
  goalTitle: string;
  watchers: number;
  isWatching: boolean;
  photo_url?: string | null;
}

const MOCK_FRIENDS: FriendWithStreak[] = [
  {
    id: '1',
    username: 'sarah_fit',
    display_name: 'Sarah Johnson',
    streak: 23,
    goalTitle: 'Run a marathon in 6 months',
    watchers: 12,
    isWatching: true,
  },
  {
    id: '2',
    username: 'mike_builder',
    display_name: 'Mike Chen',
    streak: 45,
    goalTitle: 'Build a $10K/month business',
    watchers: 28,
    isWatching: true,
  },
  {
    id: '3',
    username: 'emma_wellness',
    display_name: 'Emma Davis',
    streak: 12,
    goalTitle: 'Lose 20 pounds in 3 months',
    watchers: 8,
    isWatching: false,
  },
  {
    id: '4',
    username: 'alex_achiever',
    display_name: 'Alex Rivera',
    streak: 67,
    goalTitle: 'Write a 50,000 word novel',
    watchers: 35,
    isWatching: true,
  },
  {
    id: '5',
    username: 'jordan_strong',
    display_name: 'Jordan Taylor',
    streak: 8,
    goalTitle: 'Master advanced yoga poses',
    watchers: 15,
    isWatching: false,
  },
];

export default function FriendsScreen() {
  const { colors, isDark } = useTheme();
  const { user, isSubscribed } = useAuth();
  const [friends, setFriends] = useState<FriendWithStreak[]>(MOCK_FRIENDS);
  const [loading, setLoading] = useState(false);
  const [searchUsername, setSearchUsername] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState('');
  const [watchingUsers, setWatchingUsers] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    if (!user) return;
    try {
      const { data: watcherRows } = await supabase
        .from('watchers')
        .select('watcher_id')
        .eq('watched_id', user.id);
      setWatchingUsers(watcherRows?.length || 0);
    } catch {}
    setLoading(false);
  };

  const calculateStreak = (completions: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streakCount = 0;
    let currentDate = new Date(today);

    for (let i = 0; i < 90; i++) {
      const dateString = currentDate.toISOString().split('T')[0];
      const completion = completions.find(
        (c) => c.completion_date === dateString
      );

      if (completion && completion.completed_at) {
        streakCount++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streakCount;
  };

  const toggleWatch = (friendId: string) => {
    setFriends(prevFriends =>
      prevFriends.map(friend =>
        friend.id === friendId
          ? { ...friend, isWatching: !friend.isWatching, watchers: friend.isWatching ? friend.watchers - 1 : friend.watchers + 1 }
          : friend
      )
    );
  };

  const sendEncouragement = (friendId: string, emoji: string) => {
    setSelectedFriend(null);
    setEncouragementMessage('');
    alert(`Sent ${emoji} to ${friends.find(f => f.id === friendId)?.display_name}!`);
  };

  const addFriend = () => {
    if (!searchUsername.trim()) return;
    alert(`In production, this would search for user: ${searchUsername}`);
    setSearchUsername('');
  };

  const removeFriend = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    if (friend) {
      alert(`Remove ${friend.display_name}? This feature will be available in production.`);
    }
  };

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
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Your Circle</Text>
            </View>
            <View style={[styles.watchersBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Eye size={20} color={colors.primary} strokeWidth={2.5} />
              <View>
                <Text style={[styles.watchersCount, { color: colors.text }]}>{watchingUsers}</Text>
                <Text style={[styles.watchersLabel, { color: colors.textTertiary }]}>Watching You</Text>
              </View>
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
            <TouchableOpacity
              style={styles.addButton}
              onPress={addFriend}
              disabled={!searchUsername.trim()}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.addButtonGradient}
              >
                <UserPlus size={24} color="#000000" strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Friends</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {friends.length} people crushing their goals
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
                    colors={colors.cardGradient}
                    style={[styles.friendCardGradient, { backgroundColor: colors.card }]}
                  >
                    <View style={styles.friendHeader}>
                      <View style={styles.friendInfo}>
                        {friend.photo_url ? (
                          <Image source={{ uri: friend.photo_url }} style={styles.avatarImage} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
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
                      </View>

                      <View style={[styles.streakBadge, { backgroundColor: isDark ? '#000000' : '#1A1A1A' }]}>
                        <Text style={styles.fireEmoji}>🔥</Text>
                        <Text style={styles.streakNumber}>{friend.streak}</Text>
                        <Text style={styles.streakLabel}>DAYS</Text>
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
                                style={[styles.emojiButton, { backgroundColor: isDark ? '#1A1A1A' : '#1A1A1A', borderColor: isDark ? '#2A2A2A' : '#111111' }]}
                                onPress={() => sendEncouragement(friend.id, emoji)}
                              >
                                <Text style={styles.emojiButtonText}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                              setSelectedFriend(null);
                              setEncouragementMessage('');
                            }}
                          >
                            <Text style={[styles.cancelButtonText, { color: colors.textTertiary }]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.actionButtons}>
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
                                fill={friend.isWatching ? "#000000" : "transparent"}
                              />
                              <Text style={[styles.watchButtonText, { color: friend.isWatching ? "#000000" : "#FFFFFF" }]}>
                                {friend.isWatching ? 'Watching' : 'Watch'}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.encourageButton}
                            onPress={() => setSelectedFriend(friend.id)}
                          >
                            <LinearGradient
                              colors={isDark ? ['#404040', '#2A2A2A'] : ['#1A1A1A', '#111111']}
                              style={styles.encourageButtonGradient}
                            >
                              <Heart size={18} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.encourageButtonText}>Encourage</Text>
                            </LinearGradient>
                          </TouchableOpacity>
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
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
  },
  watchersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  watchersCount: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  watchersLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  addFriendSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  addFriendInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  addFriendInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 18,
    fontSize: 17,
    fontWeight: '600',
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  friendCard: {
    borderRadius: 20,
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
    backgroundColor: '#707070',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  friendUsername: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  friendGoal: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  fireEmoji: {
    fontSize: 24,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  streakLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fc433d',
    letterSpacing: 1,
    marginTop: 2,
  },
  encouragementSection: {
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
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
  },
  encourageButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  encourageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  encourageButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
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
  },
});
