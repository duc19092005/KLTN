import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

type StatusPanelProps = {
  title: string;
  body: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
};

export function StatusPanel({ title, body, tone = 'info', icon }: StatusPanelProps) {
  return (
    <View style={[styles.panel, styles[tone]]}>
      {icon}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  body: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  info: {
    backgroundColor: colors.surfaceAlt,
    borderColor: '#bae6fd',
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: '#a7f3d0',
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: '#fde68a',
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#fecdd3',
  },
});
