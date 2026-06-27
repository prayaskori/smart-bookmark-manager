import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase credentials provided by the user
const supabaseUrl = 'https://dmnekbvexwxpziuopcso.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtbmVrYnZleHd4cHppdW9wY3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzgwNzQsImV4cCI6MjA4NjY1NDA3NH0.l7U1PcApsqn36jCdYDMZWbQeBdY77KQsxPkzAtJxt4Q';

// Initialize and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents redirection issues on React Native
  },
});
