import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getInboxItems, markInboxItemRead, type InboxItem } from '@/lib/inboxHelpers';
import InboxItemCard from '@/components/InboxItemCard';

const PAGE_SIZE = 20;

export default function InboxScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [allItems, setAllItems] = useState<InboxItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInbox = useCallback(async () => {
    if (!user) return;
    try {
      const items = await getInboxItems(user.id);
      setAllItems(items);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const handleMarkRead = async (item: InboxItem) => {
    setAllItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)),
    );
    try {
      await markInboxItemRead(item);
    } catch {
      setAllItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, readAt: null } : i)),
      );
    }
  };

  const visibleItems = allItems.slice(0, visibleCount);
  const hasMore = visibleCount < allItems.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Inbox</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadInbox();
              }}
              tintColor={colors.primary}
            />
          }
        >
          {allItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No messages yet
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visibleItems.map((item) => (
                <InboxItemCard
                  key={`${item.source}-${item.id}`}
                  item={item}
                  onPress={handleMarkRead}
                />
              ))}
              {hasMore && (
                <TouchableOpacity
                  style={[styles.loadMoreButton, { borderColor: colors.border }]}
                  onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                    Load more
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'Inter-Black',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-Regular',
  },
  list: {
    gap: 10,
  },
  loadMoreButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter-Black',
  },
});
