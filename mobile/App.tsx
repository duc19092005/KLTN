import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, Pressable, View } from 'react-native';
import { ReceptionistScannerScreen } from './src/apps/receptionist-scanner/ReceptionistScannerScreen';
import { PatientPortalScreen } from './src/apps/patient-portal/PatientPortalScreen';
import { BACKEND_URL } from './src/shared/env';
import { colors } from './src/shared/theme/theme';

export default function App() {
  const [surface, setSurface] = useState<'receptionist' | 'patient'>('receptionist');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>KLTN NFC</Text>
          <Text style={styles.backend} numberOfLines={1}>{BACKEND_URL}</Text>
        </View>
      </View>
      <View style={styles.segment}>
        <SegmentButton label="Le tan" active={surface === 'receptionist'} onPress={() => setSurface('receptionist')} />
        <SegmentButton label="Benh nhan" active={surface === 'patient'} onPress={() => setSurface('patient')} />
      </View>
      {surface === 'receptionist' ? <ReceptionistScannerScreen /> : <PatientPortalScreen />}
    </SafeAreaView>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.segmentButton, active && styles.segmentButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brand: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  backend: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});
