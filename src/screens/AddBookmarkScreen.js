import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Animated,
  Vibration,
} from 'react-native';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TAGS = ['Work', 'Learning', 'Tools', 'Reading', 'Other'];
const TAG_COLORS = {
  Work: '#3b82f6',     // Blue
  Learning: '#10b981', // Green
  Tools: '#f97316',    // Orange
  Reading: '#8b5cf6',   // Purple
  Other: '#6b7280',    // Grey
};

export default function AddBookmarkScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [selectedTag, setSelectedTag] = useState('Other');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Success Checkmark scale animation ref
  const successScale = useRef(new Animated.Value(0)).current;

  // Extract domain name from URL
  const getDomain = (urlStr) => {
    try {
      const cleanUrl = urlStr.replace(/^(https?:\/\/)?(www\.)?/i, '');
      return cleanUrl.split('/')[0];
    } catch (e) {
      return '';
    }
  };

  // Scrape page title with AbortController timeout
  const fetchPageTitle = async (urlStr) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

    try {
      const response = await fetch(urlStr, { signal: controller.signal });
      const html = await response.text();
      clearTimeout(timeoutId);

      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match && match[1]) {
        let titleText = match[1].trim();
        // Decode common HTML entities
        titleText = titleText
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&mdash;/g, '—')
          .replace(/&ndash;/g, '–');
        return titleText;
      }
    } catch (e) {
      // Aborted or failed, return null to fallback
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  };

  const handleAddBookmark = async () => {
    if (!url.trim()) {
      Alert.alert('Validation Error', 'Please enter a URL.');
      return;
    }

    let processedUrl = url.trim();
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = 'https://' + processedUrl;
    }

    const urlPattern = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    if (!urlPattern.test(processedUrl)) {
      Alert.alert('Validation Error', 'Please enter a valid URL.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to add bookmarks.');
      }

      const domain = getDomain(processedUrl);
      const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;

      // Scrape title from website. If failed or empty, fallback to domain or user-entered title.
      let fetchedTitle = null;
      try {
        fetchedTitle = await fetchPageTitle(processedUrl);
      } catch (e) {
        // Silent catch
      }

      const finalTitle = title.trim() || fetchedTitle || domain || 'Untitled Bookmark';

      const { error } = await supabase
        .from('bookmarks')
        .insert([
          {
            user_id: user.id,
            url: processedUrl,
            title: finalTitle,
            page_title: finalTitle,
            favicon_url: faviconUrl,
            tag: selectedTag,
          },
        ]);

      if (error) throw error;

      // Haptic Feedback (brief physical vibration on success)
      Vibration.vibrate(100);

      // Trigger Success checkmark animation
      setShowSuccess(true);
      Animated.spring(successScale, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        setTitle('');
        setUrl('');
        setSelectedTag('Other');
        setShowSuccess(false);
        successScale.setValue(0);
        navigation.navigate('Bookmarks');
      }, 1500);

    } catch (error) {
      Alert.alert('Database Error', error.message || 'Failed to save bookmark.');
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <View style={styles.successContainer}>
        <Animated.View style={[styles.successCircle, { transform: [{ scale: successScale }] }]}>
          <Ionicons name="checkmark-circle-outline" size={96} color="#10b981" />
        </Animated.View>
        <Text style={styles.successText}>Bookmark Saved!</Text>
        <Text style={styles.successSubtitle}>Added successfully to your vault</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <LinearGradient
              colors={['#4f46e5', '#7c3aed']}
              style={styles.iconGradientCircle}
            >
              <Ionicons name="add-circle" size={28} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.headerTitle}>Add New Bookmark</Text>
            <Text style={styles.headerSubtitle}>
              Save your favorite web page links to access them anytime
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>URL Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="link-outline" size={20} color="#7c3aed" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. github.com"
                placeholderTextColor="#6b7280"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                value={url}
                onChangeText={setUrl}
              />
            </View>

            <Text style={styles.label}>Bookmark Title (Optional - Auto-fetched if empty)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="text-outline" size={20} color="#7c3aed" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Supabase Docs"
                placeholderTextColor="#6b7280"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="words"
              />
            </View>

            {/* Premium Pill-based Tag Selector */}
            <Text style={styles.label}>Select Category Tag</Text>
            <View style={styles.tagSelector}>
              {TAGS.map((t) => {
                const isSelected = selectedTag === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.tagOption,
                      isSelected && {
                        borderColor: TAG_COLORS[t],
                        backgroundColor: TAG_COLORS[t] + '20', // Translucent tint background
                      },
                    ]}
                    onPress={() => setSelectedTag(t)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.tagDot, { backgroundColor: TAG_COLORS[t] }]} />
                    <Text style={[styles.tagOptionText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddBookmark}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Bookmark</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    minHeight: Platform.OS === 'web' ? '100vh' : '100%',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconGradientCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  formCard: {
    backgroundColor: '#13131a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d1d5db',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
    backgroundColor: '#1e1e2e',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    height: '100%',
  },
  tagSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    marginHorizontal: -4,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    marginVertical: 4,
    backgroundColor: '#1e1e2e',
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tagOptionText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'visible',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    marginTop: 8,
  },
  saveButtonGradient: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
