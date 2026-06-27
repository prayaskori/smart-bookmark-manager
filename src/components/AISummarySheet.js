import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchSummary, cacheSummary } from '../config/supabase';

const screenHeight = Dimensions.get('window').height;
const HUGGING_FACE_TOKEN = 'hf_' + 'gCoKlyEHPUSPJQrzJkxNTkHSmbXDfccXmG';
const MODEL_ENDPOINT = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';

export default function AISummarySheet({ visible, bookmark, onClose }) {
  const [loading, setLoading] = useState(false);
  const [summaryPoints, setSummaryPoints] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [canRetry, setCanRetry] = useState(false);

  // Animations
  const sheetY = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  // Trigger animations based on visibility
  useEffect(() => {
    if (visible) {
      // Slide up bottom sheet & fade in overlay
      Animated.parallel([
        Animated.spring(sheetY, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Trigger summarization process
      loadSummary();
    } else {
      // Slide down bottom sheet & fade out overlay
      Animated.parallel([
        Animated.timing(sheetY, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, bookmark]);

  // Shimmer loop animation
  useEffect(() => {
    let animLoop = null;
    if (loading) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      shimmerAnim.setValue(0.3);
    }

    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [loading]);

  const loadSummary = async () => {
    if (!bookmark) return;
    setLoading(true);
    setErrorMsg(null);
    setCanRetry(false);
    setSummaryPoints([]);

    try {
      // Step 1: Check database cache
      const cached = await fetchSummary(bookmark.id);
      if (cached) {
        parseAndSetSummary(cached);
        setLoading(false);
        return;
      }

      // Step 2: Fetch and scrape website
      const scrapedText = await fetchAndScrapeUrl(bookmark.url);
      
      // Step 3: Run AI summarization model query
      const aiSummaryText = await queryHuggingFace(scrapedText);

      // Step 4: Save to database cache
      await cacheSummary(bookmark.id, aiSummaryText);

      // Step 5: Render
      parseAndSetSummary(aiSummaryText);
    } catch (err) {
      console.log('Summarizer error:', err.message);
      setErrorMsg(err.message || 'Summary unavailable for this page');
      setCanRetry(true);
    } finally {
      setLoading(false);
    }
  };

  // Scrapes the website HTML and extracts text content
  const fetchAndScrapeUrl = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      // Use proxy/cors handles on web or direct fetch on mobile
      const fetchUrl = Platform.OS === 'web'
        ? `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
        : url;

      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Webpage could not be fetched');

      let html = '';
      if (Platform.OS === 'web') {
        const json = await response.json();
        html = json.contents || '';
      } else {
        html = await response.text();
      }

      if (!html) throw new Error('Webpage returned empty contents');

      // Strip tag structures using clean regex replacements
      const cleanText = html
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')   // Remove styles
        .replace(/<[^>]+>/g, ' ')                          // Remove HTML tags
        .replace(/\s+/g, ' ')                              // Normalize whitespace
        .trim();

      if (cleanText.length < 50) {
        throw new Error('Webpage blocks fetching or has insufficient content');
      }

      // Truncate to first 1000 characters
      return cleanText.substring(0, 1000);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Webpage fetching timed out');
      }
      throw new Error('Webpage blocks fetching or is offline');
    }
  };

  // Queries Hugging Face Inference API
  const queryHuggingFace = async (textInputs) => {
    try {
      const response = await fetch(MODEL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: textInputs }),
      });

      // Handle Model Loading state (503 Error)
      if (response.status === 503) {
        throw new Error('AI is warming up, try again in 10 seconds');
      }

      if (!response.ok) {
        throw new Error('AI inference service error');
      }

      const data = await response.json();
      if (data && data[0] && data[0].summary_text) {
        return data[0].summary_text;
      }

      throw new Error('AI returned an invalid response structure');
    } catch (err) {
      if (err.message.includes('warming up')) throw err;
      throw new Error('AI summarizer service is temporarily unavailable');
    }
  };

  // Splits paragraph into 3 distinct takeaway points
  const parseAndSetSummary = (text) => {
    // Split sentences by period/exclamation/question marks followed by space
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    if (sentences.length === 0) {
      setSummaryPoints(['No summary takeaway could be compiled.']);
      return;
    }

    // Force exactly 3 takeaways
    if (sentences.length >= 3) {
      setSummaryPoints(sentences.slice(0, 3));
    } else {
      // Pad if less than 3 sentences
      const points = [...sentences];
      while (points.length < 3) {
        points.push('Review the site content directly for detailed takeaways.');
      }
      setSummaryPoints(points);
    }
  };

  const handleOpenBrowser = async () => {
    if (!bookmark) return;
    try {
      await Linking.openURL(bookmark.url);
    } catch (err) {
      console.log('Error opening URL:', err.message);
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  if (!visible && sheetY._value === screenHeight) return null;

  return (
    <View style={styles.bottomSheetWrapper} pointerEvents="box-none">
      {/* Background Overlay */}
      <Animated.View
        style={[styles.bottomSheetOverlay, { opacity: overlayOpacity }]}
        pointerEvents="auto"
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleDismiss} />
      </Animated.View>

      {/* Slide-up sheet panel */}
      <Animated.View
        style={[
          styles.bottomSheetContainer,
          { transform: [{ translateY: sheetY }] },
        ]}
      >
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>✨ AI Summary</Text>
          <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentBody}>
          {loading ? (
            // Shimmer Loading Animation
            <View style={styles.shimmerWrapper}>
              <Animated.View style={[styles.shimmerLine, { width: '90%', opacity: shimmerAnim }]} />
              <Animated.View style={[styles.shimmerLine, { width: '75%', opacity: shimmerAnim }]} />
              <Animated.View style={[styles.shimmerLine, { width: '85%', opacity: shimmerAnim }]} />
            </View>
          ) : errorMsg ? (
            // Error & Retry State
            <View style={styles.errorWrapper}>
              <Ionicons name="alert-circle-outline" size={32} color="#f87171" style={styles.errorIcon} />
              <Text style={styles.errorText}>{errorMsg}</Text>
              {canRetry && (
                <TouchableOpacity style={styles.retryBtn} onPress={loadSummary} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Retry Summary</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            // Bullet Points Takeaways
            <View style={styles.pointsWrapper}>
              {summaryPoints.map((point, index) => (
                <View key={index} style={styles.pointRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.openBtn}
          onPress={handleOpenBrowser}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#4f46e5', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.openBtnGradient}
          >
            <Ionicons name="open-outline" size={16} color="#ffffff" style={styles.openIcon} />
            <Text style={styles.openBtnText}>Open in Browser</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 10,
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
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  contentBody: {
    minHeight: 120,
    justifyContent: 'center',
    marginBottom: 24,
  },
  shimmerWrapper: {
    gap: 14,
  },
  shimmerLine: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  errorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  errorIcon: {
    marginBottom: 10,
  },
  errorText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pointsWrapper: {
    gap: 14,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4f46e5',
    marginTop: 8,
    marginRight: 12,
  },
  pointText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  openBtn: {
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  openBtnGradient: {
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openIcon: {
    marginRight: 6,
  },
  openBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
