import React, { useState, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Platform,
} from 'react-native';
import { colors, typography, radius, spacing } from '../../config/design';

// Clean interface with single responsibility
interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  style?: ViewStyle;
}

// Forward ref for better accessibility and form management
const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  required = false,
  style,
  onFocus,
  onBlur,
  ...rest
}, ref) => {
  const [focused, setFocused] = useState(false);

  // Clean event handlers with error boundaries
  const handleFocus = (event: any) => {
    try {
      setFocused(true);
      onFocus?.(event);
    } catch (err) {
      console.error('Input focus error:', err);
    }
  };

  const handleBlur = (event: any) => {
    try {
      setFocused(false);
      onBlur?.(event);
    } catch (err) {
      console.error('Input blur error:', err);
    }
  };

  // Clean style computation functions
  const getContainerStyle = (): ViewStyle => {
    const baseStyle = styles.container;
    const focusedStyle = focused ? styles.focused : {};
    const errorStyle = error ? styles.error : {};
    
    return {
      ...baseStyle,
      ...focusedStyle,
      ...errorStyle,
    };
  };

  const renderLabel = () => {
    if (!label) return null;
    
    return (
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
    );
  };

  const renderError = () => {
    if (!error) return null;
    
    return <Text style={styles.errorText}>{error}</Text>;
  };

  const renderHint = () => {
    if (!hint || error) return null;
    
    return <Text style={styles.hintText}>{hint}</Text>;
  };

  return (
    <View style={[styles.wrapper, style]}>
      {renderLabel()}
      
      <View style={getContainerStyle()}>
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />
      </View>
      
      {renderError()}
      {renderHint()}
    </View>
  );
});

Input.displayName = 'Input';

// Clean, organized styles following Toss design principles
const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  
  required: {
    color: colors.error,
  },
  
  container: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  
  focused: {
    borderColor: colors.primary[500],
    backgroundColor: colors.surface.elevated,
  },
  
  error: {
    borderColor: colors.error,
    backgroundColor: colors.surface.card,
  },
  
  input: {
    ...typography.body,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
    minHeight: Platform.OS === 'android' ? 24 : 20,
    
    // Consistent text rendering across platforms
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  
  hintText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});

export default Input; 