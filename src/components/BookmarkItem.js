import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, Image, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';

const TAG_COLORS = {
  Work: '#3b82f6',     // Blue
  Learning: '#10b981', // Green
  Tools: '#f97316',    // Orange
  Reading: '#8b5cf6',   // Purple
  Other: '#6b7280',    // Grey
};

export default function BookmarkItem({ item, onDelete, onLongPress }) {
  const [imgErr, setImgErr] = useState(false);

  // Mount animations: Slide up and fade in
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={20} color="#ffffff" />
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const handleOpenLink = async () => {
    let url = item.url;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open URL: ${url}`);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while opening the URL');
    }
  };

  // Helper to extract clean domain name
  const getDomain = (urlStr) => {
    try {
      const cleanUrl = urlStr.replace(/^(https?:\/\/)?(www\.)?/i, '');
      return cleanUrl.split('/')[0];
    } catch (e) {
      return urlStr;
    }
  };

  // Helper to format date as "Jun 27"
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const tagColor = TAG_COLORS[item.tag] || TAG_COLORS.Other;

  return (
    <Swipeable renderRightActions={renderRightActions} friction={1.5} rightThreshold={40}>
      <Animated.View
        style={[
          styles.cardContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={styles.card}>
          {/* Left Side Accent Tag Bar */}
          <View style={[styles.accentBar, { backgroundColor: tagColor }]} />

          <TouchableOpacity
            style={styles.content}
            onPress={handleOpenLink}
            onLongPress={() => onLongPress && onLongPress(item)}
            delayLongPress={500}
            activeOpacity={0.7}
          >
            <View style={styles.row}>
              {/* Site Favicon Icon / Image */}
              {!imgErr && item.favicon_url ? (
                <Image
                  source={{ uri: item.favicon_url }}
                  style={styles.favicon}
                  onError={() => setImgErr(true)}
                />
              ) : (
                <View style={[styles.iconCircle, { borderColor: tagColor + '30', backgroundColor: tagColor + '10' }]}>
                  <Ionicons name="link-outline" size={16} color={tagColor} />
                </View>
              )}

              {/* Text info layout */}
              <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.page_title || item.title || 'Untitled Bookmark'}
                  </Text>
                </View>
                
                <View style={styles.metaRow}>
                  <Text style={styles.domain} numberOfLines={1}>
                    {getDomain(item.url)}
                  </Text>
                  <Text style={styles.dotSeparator}>•</Text>
                  <Text style={styles.date}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Tag Pill Badge + Chevron */}
          <View style={styles.rightActionsWrapper}>
            <View style={[styles.tagBadge, { backgroundColor: tagColor + '20', borderColor: tagColor + '40' }]}>
              <Text style={[styles.tagBadgeText, { color: tagColor }]}>{item.tag || 'Other'}</Text>
            </View>
            <View style={styles.chevronWrapper}>
              <Ionicons name="chevron-forward" size={16} color="#4b5563" />
            </View>
          </View>
        </View>
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0a0a0f',
    paddingVertical: 5,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#13131a',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favicon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#1e1e2e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  domain: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  dotSeparator: {
    color: '#4b5563',
    marginHorizontal: 6,
    fontSize: 12,
  },
  date: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  rightActionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chevronWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    borderRadius: 14,
    marginVertical: 5,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
