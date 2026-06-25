import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
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
    minHeight: 62,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    borderWidth: 1.5,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryDark,
  },
  label: {
    fontSize: 16,
    fontWeight: '900',
  },
  primaryLabel: {
    color: '#ffffff',
  },
  secondaryLabel: {
    color: colors.primaryDark,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.995 }],
  },
});
