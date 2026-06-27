import React, { useState, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, Alert } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './src/config/supabase';
import LoginScreen from './src/screens/LoginScreen';
import BookmarkListScreen from './src/screens/BookmarkListScreen';
import AddBookmarkScreen from './src/screens/AddBookmarkScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Premium Custom Dark Theme configuration for React Navigation
const PremiumDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0a0a0f',
    card: '#13131a',
    text: '#ffffff',
    border: '#ffffff10',
  },
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
            } catch (error) {
              Alert.alert('Sign Out Error', error.message || 'Could not sign out.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Syncing session...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <NavigationContainer theme={PremiumDarkTheme}>
        {session ? (
          <Tab.Navigator
            screenOptions={({ navigation }) => ({
              headerRight: () => (
                <TouchableOpacity
                  onPress={handleLogout}
                  style={styles.logoutButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
              ),
              headerTitleStyle: styles.headerTitle,
              headerStyle: styles.header,
              tabBarActiveTintColor: '#7c3aed', // Purple active tint
              tabBarInactiveTintColor: '#9ca3af', // Gray inactive tint
              tabBarStyle: styles.tabBar,
              tabBarLabelStyle: styles.tabBarLabel,
              headerTitleAlign: 'left',
              headerShadowVisible: false,
            })}
          >
            <Tab.Screen
              name="Bookmarks"
              component={BookmarkListScreen}
              options={{
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons
                    name={focused ? 'bookmark' : 'bookmark-outline'}
                    size={size}
                    color={color}
                  />
                ),
              }}
            />
            <Tab.Screen
              name="Add"
              component={AddBookmarkScreen}
              options={{
                title: 'Add Bookmark',
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons
                    name={focused ? 'add-circle' : 'add-circle-outline'}
                    size={size}
                    color={color}
                  />
                ),
              }}
            />
            <Tab.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons
                    name={focused ? 'person' : 'person-outline'}
                    size={size}
                    color={color}
                  />
                ),
                headerRight: () => null, // Hide default sign-out header since profile screen has full sign out
              }}
            />
          </Tab.Navigator>
        ) : (
          <LoginScreen />
        )}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
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
  logoutButton: {
    marginRight: 28,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  header: {
    backgroundColor: '#13131a',
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff10',
  },
  tabBar: {
    backgroundColor: '#13131a',
    borderTopWidth: 1,
    borderTopColor: '#ffffff10',
    height: 64,
    paddingBottom: 10,
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
