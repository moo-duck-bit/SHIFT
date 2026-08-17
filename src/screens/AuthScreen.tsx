import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors, spacing, radius, typography } from '../config/design';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Text from '../components/ui/Text';
import Card from '../components/ui/Card';
import { validateForm } from '../utils/validation';

type Props = {
  onAuth: () => void;
};

export default function AuthScreen({ onAuth }: Props) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; pwd?: string }>({});

  const pwdRef = useRef<TextInput>(null);

  // Clean form validation with error handling
  const validateAndSetErrors = (): boolean => {
    try {
      const validation = validateForm(email, pwd);
      
      if (!validation.isValid) {
        // Clear previous errors
        setErrors({});
        
        // Set specific field errors
        if (email.trim().length === 0) {
          setErrors(prev => ({ ...prev, email: 'Please enter your email' }));
          return false;
        }
        
        if (pwd.length === 0) {
          setErrors(prev => ({ ...prev, pwd: 'Please enter your password' }));
          return false;
        }
        
        if (pwd.length < 6) {
          setErrors(prev => ({ ...prev, pwd: 'Password must be at least 6 characters' }));
          return false;
        }
        
        // Generic validation error
        Alert.alert('Input Error', validation.error || 'Please check your input');
        return false;
      }
      
      setErrors({});
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      Alert.alert('Error', 'An error occurred during input validation');
      return false;
    }
  };

  // Clean authentication handler
  const handleAuth = async () => {
    if (!validateAndSetErrors()) return;

    setLoading(true);
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, pwd);
        Alert.alert('Sign Up Complete', 'Registration completed successfully');
      } else {
        await signInWithEmailAndPassword(auth, email, pwd);
      }
      onAuth();
    } catch (error: any) {
      console.error('Auth error:', error);
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  // Clean error handling
  const handleAuthError = (error: any) => {
    let msg = 'Authentication failed';
    
    switch (error.code) {
      case 'auth/user-not-found':
        msg = 'User not found. Please sign up';
        break;
      case 'auth/wrong-password':
        msg = 'Incorrect password';
        break;
      case 'auth/email-already-in-use':
        msg = 'Email already in use. Please sign in';
        break;
      case 'auth/weak-password':
        msg = 'Password is too weak';
        break;
      case 'auth/invalid-email':
        msg = 'Invalid email format';
        break;
    }
    
    Alert.alert('Authentication Error', msg);
  };

  // Clean toggle handler
  const handleToggleMode = () => {
    try {
      setIsSignUp(!isSignUp);
      setErrors({});
    } catch (error) {
      console.error('Toggle mode error:', error);
    }
  };

  return (
    <LinearGradient
      colors={[colors.surface.background, colors.surface.card]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text variant="display" align="center" style={styles.logo}>
              Shift
            </Text>
            <Text variant="bodyLarge" color="secondary" align="center">
              Track and manage your short-form usage
            </Text>
          </View>

          {/* Form Card */}
          <Card variant="elevated" padding="lg" style={styles.formCard}>
            <Text variant="h3" align="center" style={styles.formTitle}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
            
            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                }}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => pwdRef.current?.focus()}
                error={errors.email}
                required
              />
              
              <Input
                ref={pwdRef}
                label="Password"
                value={pwd}
                onChangeText={(text) => {
                  setPwd(text);
                  if (errors.pwd) setErrors(prev => ({ ...prev, pwd: undefined }));
                }}
                placeholder="Enter your password (6+ characters)"
                secureTextEntry
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleAuth}
                error={errors.pwd}
                hint={isSignUp ? "Minimum 6 characters required" : undefined}
                required
              />

              <Button
                title={loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                onPress={handleAuth}
                style={styles.authBtn}
              />

              <Button
                title={isSignUp ? 'Already have an account? Sign In' : 'Don\'t have an account? Sign Up'}
                variant="ghost"
                size="md"
                fullWidth
                onPress={handleToggleMode}
              />
            </View>
          </Card>

          {/* Footer */}
          <View style={styles.footer}>
            <Text variant="caption" color="tertiary" align="center">
              Safe and easy short-form usage management
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// Clean, organized styles following Toss design
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  keyboardView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  
  header: {
    marginBottom: spacing.xxl,
  },
  
  logo: {
    letterSpacing: 3,
    marginBottom: spacing.md,
    color: colors.primary[400],
  },
  
  formCard: {
    marginBottom: spacing.xl,
  },
  
  formTitle: {
    marginBottom: spacing.xl,
  },
  
  form: {
    gap: spacing.lg,
  },
  
  authBtn: {
    marginTop: spacing.md,
  },
  
  footer: {
    marginTop: spacing.xl,
  },
}); 