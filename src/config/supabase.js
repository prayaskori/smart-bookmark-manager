import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Polyfill is only required for native mobile platforms, not standard web browsers
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

// Supabase credentials provided by the user
const supabaseUrl = 'https://dmnekbvexwxpziuopcso.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtbmVrYnZleHd4cHppdW9wY3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzgwNzQsImV4cCI6MjA4NjY1NDA3NH0.l7U1PcApsqn36jCdYDMZWbQeBdY77KQsxPkzAtJxt4Q';

// Determine the storage provider dynamically based on environment
const storageProvider = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.localStorage : undefined)
  : AsyncStorage;

// Initialize and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageProvider,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents redirection issues on React Native
  },
});
