import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { authApi } from './src/config/api';
import { AuthenticatedApp } from './src/screens/AuthenticatedApp';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthScreen() {
  const { status, user, error, signIn, signUp, checkSession, logout, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const submitCredentials = () => {
    if (isSignUp) {
      if (password !== confirmPassword) {
        setGoogleError('Passwords do not match.');
        return;
      }
      if (fullName.trim().length < 2) {
        setGoogleError('Enter your full name to create an account.');
        return;
      }
      if (password.length < 8) {
        setGoogleError('Your password must be at least 8 characters.');
        return;
      }
      void signUp(fullName, email, password);
      return;
    }
    void signIn(email, password);
  };

  const openGoogleSignIn = async () => {
    setGoogleError(null);
    try {
      await Linking.openURL(authApi.googleSignInUrl());
      setGooglePending(true);
    } catch {
      setGoogleError('Could not open Google sign-in. Please try again.');
    }
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Connecting to GP Autos</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'authenticated' && user) {
    return <AuthenticatedApp />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <BrandMark />
          <View style={styles.formArea}>
            <Text style={styles.eyebrow}>{isSignUp ? 'JOIN THE GP AUTOS COMMUNITY' : 'YOUR NEXT DRIVE STARTS HERE'}</Text>
            <Text style={styles.title}>{isSignUp ? 'Create your account.' : 'Welcome back.'}</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'Set up your account to continue with GP Autos.' : 'Sign in to continue with GP Autos.'}
            </Text>

            {isSignUp ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>FULL NAME</Text>
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  autoComplete="name"
                  onChangeText={setFullName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="next"
                  style={styles.input}
                  textContentType="name"
                  value={fullName}
                />
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={(value) => {
                  setEmail(value);
                    setGoogleError(null);
                  clearError();
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.placeholder}
                returnKeyType="next"
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                onChangeText={(value) => {
                  setPassword(value);
                  setGoogleError(null);
                  clearError();
                }}
                onSubmitEditing={() => {
                  if (!isSignUp) submitCredentials();
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.placeholder}
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                value={password}
              />
            </View>

            {isSignUp ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <TextInput
                  accessibilityLabel="Confirm password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onChangeText={setConfirmPassword}
                  onSubmitEditing={submitCredentials}
                  placeholder="Re-enter your password"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.input}
                  textContentType="newPassword"
                  value={confirmPassword}
                />
              </View>
            ) : null}

            {error || googleError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>{googleError ?? error}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!email.trim() || !password || (isSignUp && (!fullName.trim() || !confirmPassword))}
              onPress={submitCredentials}
              style={({ pressed }) => [
                styles.primaryButton,
                (!email.trim() || !password || (isSignUp && (!fullName.trim() || !confirmPassword))) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
              <Text style={styles.buttonArrow}>→</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void openGoogleSignIn()}
              style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.googleMark}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>
            <Text style={styles.googleNote}>
              Google sign-in opens in your browser. After finishing, return here to check your session.
            </Text>

            {googlePending ? (
              <Pressable accessibilityRole="button" onPress={() => void checkSession()} style={styles.sessionCheckButton}>
                <Text style={styles.sessionCheckText}>I finished Google sign-in · Check session</Text>
              </Pressable>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsSignUp(!isSignUp);
                  setGooglePending(false);
                  setGoogleError(null);
                  clearError();
                }}
              >
                <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.footer}>GP AUTOS  /  DRIVE WITH CONFIDENCE</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <Text style={styles.brandName}>GP<Text style={styles.brandAccent}>AUTOS</Text></Text>
    </View>
  );
}

const colors = {
  background: '#071116',
  panel: '#101f26',
  panelBorder: '#21353b',
  accent: '#63e6dc',
  text: '#f2f7f6',
  muted: '#93a7a9',
  placeholder: '#607579',
  danger: '#ff9c9c',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 22,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  brandName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  brandAccent: { color: colors.accent },
  formArea: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 62,
    paddingBottom: 48,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.1,
    marginBottom: 15,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 7,
    marginBottom: 34,
  },
  fieldGroup: { marginBottom: 19 },
  label: {
    color: '#9eb2b3',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 9,
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderRadius: 7,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    height: 54,
    paddingHorizontal: 15,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 7,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#071718', fontSize: 15, fontWeight: '800' },
  buttonArrow: {
    color: '#071718',
    fontSize: 21,
    fontWeight: '500',
    marginLeft: 12,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    marginTop: 23,
    marginBottom: 15,
  },
  divider: { backgroundColor: colors.panelBorder, flex: 1, height: 1 },
  dividerText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
  },
  googleMark: { color: colors.text, fontSize: 17, fontWeight: '800', marginRight: 11 },
  googleButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  googleNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
    textAlign: 'center',
  },
  sessionCheckButton: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  sessionCheckText: { color: colors.accent, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 21,
  },
  switchText: { color: colors.muted, fontSize: 13 },
  switchLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#496065',
    borderRadius: 7,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginTop: 26,
  },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  footer: {
    color: '#52676b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 'auto',
    paddingTop: 22,
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: colors.muted, fontSize: 14 },
  homeScreen: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 22,
  },
  homeContent: { flex: 1, justifyContent: 'center' },
  homeTitle: { color: colors.text, fontSize: 27, fontWeight: '500' },
  memberName: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: '700',
    marginTop: 4,
  },
  profilePanel: {
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 31,
    padding: 17,
  },
  profileLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  profileEmail: { color: colors.text, fontSize: 15 },
});
