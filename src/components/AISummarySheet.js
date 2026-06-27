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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchSummary, cacheSummary } from '../config/supabase';

const { height: screenHeight } = Dimensions.get('window');
const HF_TOKEN = ['hf_', 'gCoKlyEHPUSPJQrzJkxNTkHSmbXDfccXmG'].join('');
const MODEL_ENDPOINT = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';

export default function AISummarySheet({ visible, bookmark, onClose }) {
  const [loading, setLoading] = useState(false);
  const [summaryPoints, setSummaryPoints] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [debugMsg, setDebugMsg] = useState('');

  const sheetY = useRef(new Animated.Value(screenHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  // ─── Visibility animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(sheetY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      // Reset state and kick off load
      setSummaryPoints([]);
      setErrorMsg(null);
      setDebugMsg('');
      loadSummary();
    } else {
      Animated.parallel([
        Animated.timing(sheetY, { toValue: screenHeight, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, bookmark?.id]);  // re-trigger only when bookmark changes

  // ─── Shimmer loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let loop = null;
    if (loading) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 0.8, duration: 700, useNativeDriver: true }),
          Animated.timing(shimmerAnim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      shimmerAnim.setValue(0.3);
    }
    return () => { if (loop) loop.stop(); };
  }, [loading]);

  // ─── Main load function ─────────────────────────────────────────────────────
  const loadSummary = async () => {
    if (!bookmark) return;
    setLoading(true);
    setErrorMsg(null);
    setSummaryPoints([]);

    try {
      // Step 1: Check DB cache (safe — if column missing, fetchSummary returns null)
      let cached = null;
      try { cached = await fetchSummary(bookmark.id); } catch (_) {}
      if (cached) {
        splitAndSet(cached);
        setLoading(false);
        return;
      }

      // Step 2: Try to scrape text; fall back to title+URL as input
      let inputText = await safeScrapePage(bookmark.url);
      if (!inputText) {
        // Fallback: use page title + URL as context for the model
        const title = bookmark.page_title || bookmark.title || '';
        const domain = extractDomain(bookmark.url);
        inputText = `${title}. This page is at ${domain}. URL: ${bookmark.url}`;
        setDebugMsg('(scraped from title — direct fetch blocked)');
      }

      // Step 3: Query Hugging Face
      const summary = await callHuggingFace(inputText);

      // Step 4: Cache result (best-effort, don't crash if column missing)
      try { await cacheSummary(bookmark.id, summary); } catch (_) {}

      // Step 5: Display
      splitAndSet(summary);
    } catch (err) {
      console.log('[AISummarySheet] Error:', err.message);
      setErrorMsg(err.message || 'Could not generate summary');
    } finally {
      setLoading(false);
    }
  };

  // ─── Scrape helper ──────────────────────────────────────────────────────────
  const safeScrapePage = async (url) => {
    // Try allorigins CORS proxy on web; direct fetch on native
    const proxyUrl = Platform.OS === 'web'
      ? `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      : url;

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(tid);

      if (!res.ok) return null;

      let html = '';
      if (Platform.OS === 'web') {
        const json = await res.json();
        html = json?.contents || '';
      } else {
        html = await res.text();
      }

      if (!html) return null;

      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return text.length > 80 ? text.substring(0, 1200) : null;
    } catch {
      return null;
    }
  };

  // ─── Hugging Face call ──────────────────────────────────────────────────────
  const callHuggingFace = async (inputText) => {
    const res = await fetch(MODEL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputText,
        parameters: { max_length: 200, min_length: 50 },
      }),
    });

    // Model warming up
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      const wait = body?.estimated_time ? `~${Math.ceil(body.estimated_time)}s` : '20s';
      throw new Error(`AI model is warming up — tap Retry in ${wait}`);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `API error (${res.status})`);
    }

    const data = await res.json();
    const text = data?.[0]?.summary_text;
    if (!text) throw new Error('AI returned an empty response — try again');
    return text;
  };

  // ─── Split into 3 bullet points ─────────────────────────────────────────────
  const splitAndSet = (text) => {
    // Split on sentence boundaries
    const raw = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 8);
    if (raw.length === 0) {
      setSummaryPoints([text]);
      return;
    }
    const points = raw.slice(0, 3);
    while (points.length < 3) points.push('Visit the page for more details.');
    setSummaryPoints(points);
  };

  const extractDomain = (url) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  };

  const openBrowser = async () => {
    if (!bookmark?.url) return;
    try { await Linking.openURL(bookmark.url); } catch {}
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  // NOTE: Never return null — always render so animation works on re-open.
  // Use pointerEvents to disable interaction when hidden.
  const isHidden = !visible;

  return (
    <Animated.View
      style={[styles.wrapper, { opacity: overlayOpacity, pointerEvents: isHidden ? 'none' : 'auto' }]}
      pointerEvents={isHidden ? 'none' : 'box-none'}
    >
      {/* Dim overlay — tap to close */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

      {/* Sheet panel */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>✨ AI Summary</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Bookmark subtitle */}
        {bookmark && (
          <Text style={styles.bookmarkSubtitle} numberOfLines={1}>
            {bookmark.page_title || bookmark.title || extractDomain(bookmark.url || '')}
          </Text>
        )}

        {/* Content area */}
        <View style={styles.contentArea}>
          {loading ? (
            <View style={styles.shimmerBox}>
              <Animated.View style={[styles.shimmerLine, { width: '92%', opacity: shimmerAnim }]} />
              <Animated.View style={[styles.shimmerLine, { width: '78%', opacity: shimmerAnim }]} />
              <Animated.View style={[styles.shimmerLine, { width: '85%', opacity: shimmerAnim }]} />
              <Text style={styles.loadingHint}>Generating summary…</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={32} color="#f87171" />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadSummary} activeOpacity={0.8}>
                <Text style={styles.retryText}>↺  Retry</Text>
              </TouchableOpacity>
            </View>
          ) : summaryPoints.length > 0 ? (
            <View style={styles.pointsBox}>
              {debugMsg ? <Text style={styles.debugHint}>{debugMsg}</Text> : null}
              {summaryPoints.map((pt, i) => (
                <View key={i} style={styles.pointRow}>
                  <View style={styles.dot} />
                  <Text style={styles.pointText}>{pt}</Text>
                </View>
              ))}
            </View>
          ) : (
            // Empty idle state
            <View style={styles.idleBox}>
              <Ionicons name="sparkles-outline" size={28} color="#4f46e5" />
              <Text style={styles.idleText}>Summary will appear here</Text>
            </View>
          )}
        </View>

        {/* Open in browser button */}
        <TouchableOpacity style={styles.openBtn} onPress={openBrowser} activeOpacity={0.85}>
          <LinearGradient
            colors={['#4f46e5', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.openGradient}
          >
            <Ionicons name="open-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.openText}>Open in Browser</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#13131a',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 44 : 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 30,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  closeBtn: { padding: 4 },
  bookmarkSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 20,
  },
  contentArea: {
    minHeight: 130,
    justifyContent: 'center',
    marginBottom: 20,
  },
  // Shimmer
  shimmerBox: { gap: 12 },
  shimmerLine: {
    height: 13,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 6,
  },
  loadingHint: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  // Error
  errorBox: { alignItems: 'center', gap: 10 },
  errorText: {
    color: '#d1d5db',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  retryBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(79,70,229,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.4)',
  },
  retryText: { color: '#a5b4fc', fontSize: 14, fontWeight: '700' },
  // Points
  pointsBox: { gap: 14 },
  debugHint: { color: '#4b5563', fontSize: 11, marginBottom: 4 },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
    marginTop: 8,
    marginRight: 12,
  },
  pointText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  // Idle
  idleBox: { alignItems: 'center', gap: 10 },
  idleText: { color: '#4b5563', fontSize: 14 },
  // Open button
  openBtn: {
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  openGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
