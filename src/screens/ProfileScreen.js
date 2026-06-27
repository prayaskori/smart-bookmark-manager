import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TAG_COLORS = {
  Work: '#3b82f6',     // Blue
  Learning: '#10b981', // Green
  Tools: '#f97316',    // Orange
  Reading: '#8b5cf6',   // Purple
  Other: '#6b7280',    // Grey
};

export default function ProfileScreen() {
  const [userEmail, setUserEmail] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [stats, setStats] = useState({ total: 0, tags: { Work: 0, Learning: 0, Tools: 0, Reading: 0, Other: 0 } });
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const fetchProfileAndStats = async () => {
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) throw new Error('Not logged in.');

          if (isActive) {
            setUserEmail(user.email);
            if (user.created_at) {
              const formattedDate = new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              });
              setMemberSince(formattedDate);
            }
          }

          // Query counts
          const { data, error } = await supabase
            .from('bookmarks')
            .select('tag')
            .eq('user_id', user.id);

          if (error) throw error;

          if (isActive) {
            const counts = { Work: 0, Learning: 0, Tools: 0, Reading: 0, Other: 0 };
            (data || []).forEach((item) => {
              const t = item.tag || 'Other';
              if (counts[t] !== undefined) {
                counts[t]++;
              } else {
                counts['Other']++;
              }
            });

            setStats({
              total: (data || []).length,
              tags: counts,
            });
          }
        } catch (error) {
          console.log('Profile Stats fetch error:', error.message);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      fetchProfileAndStats();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleLogout = async () => {
    const performSignOut = async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      } catch (error) {
        if (Platform.OS === 'web') {
          alert('Sign Out Error: ' + error.message);
        } else {
          Alert.alert('Sign Out Error', error.message || 'Could not sign out.');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to sign out?');
      if (confirm) {
        await performSignOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: performSignOut,
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Fetching profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userCard}>
          <LinearGradient
            colors={['#4f46e5', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <Ionicons name="person" size={32} color="#ffffff" />
          </LinearGradient>
          <Text style={styles.emailText}>{userEmail}</Text>
          <Text style={styles.memberText}>Member since {memberSince}</Text>
        </View>

        {/* Stats Summary Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Saved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {Object.values(stats.tags).filter((count) => count > 0).length}
            </Text>
            <Text style={styles.statLabel}>Active Tags</Text>
          </View>
        </View>

        {/* Tag Breakdown Bar Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          <View style={styles.divider} />

          {Object.keys(TAG_COLORS).map((t) => {
            const count = stats.tags[t] || 0;
            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
            const color = TAG_COLORS[t];

            return (
              <View key={t} style={styles.chartRow}>
                <View style={styles.chartLabelWrapper}>
                  <View style={[styles.tagDot, { backgroundColor: color }]} />
                  <Text style={styles.chartLabelText}>{t}</Text>
                  <Text style={styles.chartCountText}>({count})</Text>
                </View>

                <View style={styles.barContainer}>
                  <View style={styles.barBackground}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barPercentText}>{Math.round(percentage)}%</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Sign Out Action Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#f87171" style={styles.logoutIcon} />
          <Text style={styles.logoutBtnText}>Sign Out Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0f',
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
  scrollContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'stretch',
    width: '100%',
  },
  userCard: {
    alignItems: 'center',
    marginBottom: 28,
    alignSelf: 'center',
  },
  avatarGradient: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ rotate: '45deg' }],
  },
  emailText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  memberText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
    marginBottom: 28,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#13131a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  statNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#13131a',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 16,
  },
  chartRow: {
    marginBottom: 16,
  },
  chartLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  chartLabelText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
    marginRight: 6,
  },
  chartCountText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1e1e2e',
    overflow: 'hidden',
    marginRight: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barPercentText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f87171',
    backgroundColor: 'transparent',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '800',
  },
});
