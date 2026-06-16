import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

type ActionButtonProps = {
  label: string;
  icon?: ReactNode;
  tone?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function ActionButton({ label, icon, tone = 'primary', disabled, loading, onPress }: ActionButtonProps) {
  const secondary = tone === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.primary : '#ffffff'} /> : icon}
      <Text style={[styles.label, secondary ? styles.secondaryLabel : styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
  },
  primaryLabel: {
    color: '#ffffff',
  },
  secondaryLabel: {
    color: colors.text,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});
