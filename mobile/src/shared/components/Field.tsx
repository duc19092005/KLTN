import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../theme/theme';

type FieldProps = TextInputProps & {
  label: string;
};

export function Field({ label, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
