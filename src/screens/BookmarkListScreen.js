import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import BookmarkItem from '../components/BookmarkItem';
import AISummarySheet from '../components/AISummarySheet';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const CACHE_KEY = '@smartbookmark_cache';
const screenHeight = Dimensions.get('window').height;

const FILTER_TAGS = ['All', 'Work', 'Learning', 'Tools', 'Reading', 'Other'];
const TAG_COLORS = {
  All: '#7c3aed',
  Work: '#3b82f6',
  Learning: '#10b981',
  Tools: '#f97316',
  Reading: '#8b5cf6',
  Other: '#6b7280',
};

export default function BookmarkListScreen({ navigation }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Tag Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');

  // Delete Confirmation Bottom Sheet States
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // AI Summary Bottom Sheet States
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryBookmark, setSummaryBookmark] = useState(null);

  // Bottom Sheet Slide & Opacity animations
  const bottomSheetY = useRef(new Animated.Value(screenHeight)).current;
  const deleteOverlayOpacity = useRef(new Animated.Value(0)).current;

  // Offline cache loader
  const loadCache = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userCacheKey = `${CACHE_KEY}_${user.id}`;
      const cached = await AsyncStorage.getItem(userCacheKey);
      if (cached) {
        setBookmarks(JSON.parse(cached));
        setLoading(false); // Cache found, show bookmarks immediately!
      }
    } catch (e) {
      console.log('AsyncStorage read error:', e);
    }
  };

  // Cache saver
  const saveCache = async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userCacheKey = `${CACHE_KEY}_${user.id}`;
      await AsyncStorage.setItem(userCacheKey, JSON.stringify(data));
    } catch (e) {
      console.log('AsyncStorage write error:', e);
    }
  };

  const fetchBookmarks = async (silent = false) => {
    if (!silent && bookmarks.length === 0) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const freshData = data || [];
      setBookmarks(freshData);
      await saveCache(freshData); // Cache the fresh list offline
    } catch (error) {
      // If fetching fails but we have cached bookmarks, user still sees cached list
      console.log('Sync Error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let activeChannel = null;
    let isSubscribed = true;

    const setupSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isSubscribed) return;

        // Load the specific cache for this user, then sync fresh
        const userCacheKey = `${CACHE_KEY}_${user.id}`;
        const cached = await AsyncStorage.getItem(userCacheKey);
        if (cached && isSubscribed) {
          setBookmarks(JSON.parse(cached));
          setLoading(false);
        }
        
        fetchBookmarks();

        // Subscribe to public database alterations, filtering events by current user_id
        activeChannel = supabase
          .channel(`user-bookmarks-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'bookmarks',
            },
            (payload) => {
              if (!isSubscribed) return;

              if (payload.eventType === 'INSERT') {
                if (payload.new.user_id !== user.id) return; // Skip inserts from other users
                setBookmarks((prev) => {
                  if (prev.some((item) => item.id === payload.new.id)) return prev;
                  const updated = [payload.new, ...prev];
                  saveCache(updated);
                  return updated;
                });
              } else if (payload.eventType === 'DELETE') {
                // Delete event payload only has payload.old.id
                setBookmarks((prev) => {
                  const updated = prev.filter((item) => item.id !== payload.old.id);
                  saveCache(updated);
                  return updated;
                });
              } else if (payload.eventType === 'UPDATE') {
                if (payload.new.user_id !== user.id) return; // Skip updates from other users
                setBookmarks((prev) => {
                  const updated = prev.map((item) => (item.id === payload.new.id ? payload.new : item));
                  saveCache(updated);
                  return updated;
                });
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.log('Subscription setup error:', err);
      }
    };

    setupSubscription();

    return () => {
      isSubscribed = false;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookmarks(true);
  };

  const handleLongPressItem = (item) => {
    setSummaryBookmark(item);
    setSummaryVisible(true);
  };

  // Open the delete confirmation bottom sheet
  const triggerDeleteConfirm = (id) => {
    setDeleteTargetId(id);
    setShowBottomSheet(true);
    Animated.parallel([
      Animated.spring(bottomSheetY, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(deleteOverlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Dismiss the delete bottom sheet
  const dismissBottomSheet = () => {
    Animated.parallel([
      Animated.timing(bottomSheetY, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(deleteOverlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowBottomSheet(false);
      setDeleteTargetId(null);
    });
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    dismissBottomSheet();

    // Smooth UI delete happens inside BookmarkItem using transition hooks,
    // here we call the db delete and state updates.
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
      
      // Update local state and offline cache
      setBookmarks((prev) => {
        const updated = prev.filter((item) => item.id !== targetId);
        saveCache(updated);
        return updated;
      });
    } catch (error) {
      Alert.alert('Delete Error', error.message || 'Failed to delete bookmark.');
      fetchBookmarks(true); // reload to recover sync state
    }
  };

  // Filter list by Tag + Search query
  const filteredBookmarks = bookmarks.filter((item) => {
    const matchesTag = selectedTag === 'All' || item.tag === selectedTag;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery.trim() === '' ||
      (item.title && item.title.toLowerCase().includes(searchLower)) ||
      (item.page_title && item.page_title.toLowerCase().includes(searchLower)) ||
      (item.url && item.url.toLowerCase().includes(searchLower));

    return matchesTag && matchesSearch;
  });

  if (loading && bookmarks.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Syncing bookmarks...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Search Input Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search title, URL..."
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.resultCountText}>
          {searchQuery.trim() === ''
            ? `${filteredBookmarks.length} bookmarks`
            : `${filteredBookmarks.length} ${filteredBookmarks.length === 1 ? 'result' : 'results'} for '${searchQuery}'`}
        </Text>
      </View>

      {/* Horizontal Filter Pill Row */}
      <View style={styles.tagFiltersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilterScroll}
        >
          {FILTER_TAGS.map((t) => {
            const isSelected = selectedTag === t;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.filterPill,
                  isSelected && {
                    borderColor: TAG_COLORS[t],
                    backgroundColor: TAG_COLORS[t] + '20',
                  },
                ]}
                onPress={() => setSelectedTag(t)}
                activeOpacity={0.8}
              >
                {t !== 'All' && <View style={[styles.filterDot, { backgroundColor: TAG_COLORS[t] }]} />}
                <Text style={[styles.filterPillText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main FlatList */}
      <FlatList
        data={filteredBookmarks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <BookmarkItem item={item} onDelete={triggerDeleteConfirm} onLongPress={handleLongPressItem} />
        )}
        contentContainerStyle={filteredBookmarks.length === 0 ? styles.emptyScrollContainer : styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#7c3aed']}
            tintColor="#7c3aed"
          />
        }
        ListEmptyComponent={
          searchQuery.trim() !== '' ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={40} color="#7c3aed" />
              </View>
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptySubtitle}>
                No results matching "{searchQuery}". Try editing your query.
              </Text>
              <TouchableOpacity style={styles.clearQueryBtn} onPress={() => setSearchQuery('')}>
                <Text style={styles.clearQueryBtnText}>Clear Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="bookmark-outline" size={42} color="#7c3aed" />
              </View>
              <Text style={styles.emptyTitle}>No Bookmarks Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the '+' tab at the bottom to save your first link!
              </Text>
              {/* Redirect to Add Tab CTA */}
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('Add')}
              >
                <LinearGradient
                  colors={['#4f46e5', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaGradient}
                >
                  <Text style={styles.emptyCtaText}>Add Bookmark</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Delete Confirmation – always rendered, hidden via pointerEvents + opacity */}
      <Animated.View
        style={[
          styles.deleteSheetWrapper,
          { opacity: deleteOverlayOpacity },
        ]}
        pointerEvents={showBottomSheet ? 'box-none' : 'none'}
      >
        {/* Tap dim area to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={dismissBottomSheet}
          activeOpacity={1}
        />

        {/* Sheet slides up from bottom */}
        <Animated.View
          style={[
            styles.deleteSheetPanel,
            { transform: [{ translateY: bottomSheetY }] },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.bottomSheetHandle} />
          <Text style={styles.bottomSheetTitle}>Delete this bookmark?</Text>
          <Text style={styles.bottomSheetSub}>This action is permanent and cannot be undone.</Text>

          <View style={styles.bottomSheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={dismissBottomSheet} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmDelete} activeOpacity={0.8}>
              <Text style={styles.confirmDeleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>

      {/* AI Summary Bottom Sheet */}
      <AISummarySheet
        visible={summaryVisible}
        bookmark={summaryBookmark}
        onClose={() => {
          setSummaryVisible(false);
          setSummaryBookmark(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    minHeight: Platform.OS === 'web' ? '100vh' : '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  resultCountText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  tagFiltersWrapper: {
    paddingBottom: 10,
  },
  tagFilterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: '#13131a',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 24,
  },
  emptyScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#13131a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyCta: {
    borderRadius: 12,
    overflow: 'visible',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    width: 160,
  },
  emptyCtaGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  clearQueryBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#13131a',
  },
  clearQueryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Custom Animated Bottom Sheet Overlay
  bottomSheetWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  bottomSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  bottomSheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#13131a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 42 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 24,
  },
  // Delete sheet uses flex layout so buttons are never covered by overlay
  deleteSheetWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  deleteSheetPanel: {
    backgroundColor: '#13131a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 42 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 24,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  bottomSheetSub: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmDeleteBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
