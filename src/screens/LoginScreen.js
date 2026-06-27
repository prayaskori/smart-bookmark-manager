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
} from 'react-native';
import { supabase } from '../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animated scale value for the main action button
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const validateInputs = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter both your email address and password.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g., name@domain.com).');
      return false;
    }
    if (isSignUp) {
      if (password.length < 10) {
        Alert.alert('Weak Password', 'Password must be at least 10 characters long.');
        return false;
      }
      if (!/[A-Z]/.test(password)) {
        Alert.alert('Weak Password', 'Password must contain at least one uppercase letter.');
        return false;
      }
      if (!/[a-z]/.test(password)) {
        Alert.alert('Weak Password', 'Password must contain at least one lowercase letter.');
        return false;
      }
      if (!/[0-9]/.test(password)) {
        Alert.alert('Weak Password', 'Password must contain at least one number.');
        return false;
      }
      if (!/[!@#$%^&*(),.?":{}|<>\-_]/.test(password)) {
        Alert.alert('Weak Password', 'Password must contain at least one special character (e.g., !, @, #, $, etc.).');
        return false;
      }
    } else {
      if (password.length < 6) {
        Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
        return false;
      }
    }
    return true;
  };

  const handleAuth = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) throw error;

        if (data.session) {
          Alert.alert('Welcome!', 'Your account has been created successfully!');
        } else {
          Alert.alert(
            'Verification Required',
            'A confirmation link has been sent to your email. Please verify your email to log in.'
          );
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          if (error.message && error.message.includes('Invalid login credentials')) {
            Alert.alert(
              'Password Mismatch',
              'The password you entered is incorrect or does not match the registered email. Please check your credentials and try again.'
            );
          } else {
            Alert.alert(
              'Authentication Failed',
              error.message || 'An error occurred during authentication.'
            );
          }
          return;
        }
      }
    } catch (error) {
      Alert.alert('Authentication Failed', error.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Decorative Blurred Orbs */}
      <View style={styles.backgroundContainer} pointerEvents="none">
        <LinearGradient
          colors={['rgba(79, 70, 229, 0.22)', 'rgba(49, 46, 129, 0)']}
          style={[styles.orb, styles.orbLeft]}
        />
        <LinearGradient
          colors={['rgba(124, 58, 237, 0.18)', 'rgba(76, 29, 149, 0)']}
          style={[styles.orb, styles.orbRight]}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header / Logo */}
            <View style={styles.logoHeader}>
              <LinearGradient
                colors={['#4f46e5', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradientCircle}
              >
                <Ionicons name="bookmark" size={34} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.titleText}>Bookmark Manager</Text>
              <Text style={styles.subtitleText}>
                Save, organize, and sync your favorite links in real-time
              </Text>
            </View>

            {/* Main Form Card */}
            <View style={styles.formCard}>
              {/* Premium Segmented Switch Tab */}
              <View style={styles.segmentedTabContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, !isSignUp && styles.tabButtonActive]}
                  onPress={() => setIsSignUp(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, isSignUp && styles.tabButtonActive]}
                  onPress={() => setIsSignUp(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Input fields */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#9ca3af"
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#6b7280"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputBox}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#9ca3af"
                    style={styles.fieldIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeToggle}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Button wrapped in Animated View for Spring Scale Effect */}
              <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleAuth}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#4f46e5', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Helpful Hint */}
              <Text style={styles.helperText}>
                {isSignUp
                  ? 'Password must be at least 10 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character.'
                  : 'Welcome back! Sign in to automatically sync your saved links.'}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    minHeight: Platform.OS === 'web' ? '100vh' : '100%',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 150,
    width: 300,
    height: 300,
  },
  orbLeft: {
    top: '10%',
    left: '-20%',
  },
  orbRight: {
    bottom: '20%',
    right: '-20%',
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconGradientCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
    transform: [{ rotate: '45deg' }],
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  formCard: {
    backgroundColor: '#13131a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  segmentedTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0c0c12',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#1e1e2e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d1d5db',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
    backgroundColor: '#1e1e2e',
  },
  fieldIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
  },
  eyeToggle: {
    padding: 4,
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'visible',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 16,
  },
  actionButtonGradient: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
