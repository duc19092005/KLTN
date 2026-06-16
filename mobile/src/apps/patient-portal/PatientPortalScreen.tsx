import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { loginPatientWithNfc } from '../../shared/api/client';
import { ActionButton } from '../../shared/components/ActionButton';
import { StatusPanel } from '../../shared/components/StatusPanel';
import { scanKLTNNfcCard } from '../../shared/nfc/kltnNfc';
import { colors, spacing } from '../../shared/theme/theme';
import { PatientNfcLoginResponse } from '../../shared/types/nfc';

export function PatientPortalScreen() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<PatientNfcLoginResponse | null>(null);
  const [error, setError] = useState('');

  const login = async () => {
    setBusy(true);
    setError('');
    setData(null);
    try {
      const card = await scanKLTNNfcCard();
      const response = await loginPatientWithNfc(card);
      setData(response);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Khong dang nhap duoc bang NFC.');
    } finally {
      setBusy(false);
    }
  };

  const verification = data?.verification;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.kicker}>Patient portal</Text>
        <Text style={styles.title}>Dang nhap bang CCCD NFC</Text>
        <Text style={styles.subtitle}>Benh nhan quet the, backend truy van DB va doi chieu blockchain nhu flow Home cu.</Text>
        <ActionButton
          label="Dang nhap bang NFC"
          loading={busy}
          onPress={login}
          icon={<Ionicons name="radio-outline" size={20} color="#ffffff" />}
        />
      </View>

      {error && (
        <StatusPanel
          tone="danger"
          title="Dang nhap that bai"
          body={error}
          icon={<Ionicons name="warning-outline" size={22} color={colors.danger} />}
        />
      )}

      {!data && !error && (
        <StatusPanel
          title="Chua co ho so"
          body="Nhan dang nhap, ap the NFC trang da ghi KLTN_CCCD JSON de xem lich su kham va trang thai integrity."
          icon={<Ionicons name="information-circle-outline" size={22} color={colors.primary} />}
        />
      )}

      {verification && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{verification.patient.fullName}</Text>
          <Text style={styles.patientCode}>{verification.patient.patientCode}</Text>
          <View style={styles.integrityBar}>
            <Ionicons name="git-branch-outline" size={18} color={colors.success} />
            <Text style={styles.integrityText}>
              Patient integrity: {verification.patientIntegrity.status}
            </Text>
          </View>
        </View>
      )}

      {verification && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lich su kham ({verification.totalVisits})</Text>
          {verification.visits.length === 0 ? (
            <Text style={styles.empty}>Benh nhan chua co luot kham nao.</Text>
          ) : (
            verification.visits.map((visit) => {
              const status = visit.blockchainVerification?.status || 'UNANCHORED';
              const verified = status === 'VERIFIED';
              return (
                <View key={visit.visitCode} style={styles.visit}>
                  <View style={styles.visitTop}>
                    <View style={styles.visitCopy}>
                      <Text style={styles.visitCode}>{visit.visitCode}</Text>
                      <Text style={styles.visitTitle}>{visit.conclusion?.finalDiagnosis || visit.status}</Text>
                      <Text style={styles.visitMeta}>
                        {visit.department?.name || 'Chua xep khoa'} | {visit.doctor?.fullName || 'Chua phan cong'}
                      </Text>
                    </View>
                    <View style={[styles.badge, verified ? styles.badgeOk : styles.badgeWarn]}>
                      <Text style={[styles.badgeText, verified ? styles.badgeTextOk : styles.badgeTextWarn]}>{status}</Text>
                    </View>
                  </View>
                  {visit.conclusion && (
                    <View style={styles.conclusion}>
                      <Text style={styles.conclusionLabel}>Phac do</Text>
                      <Text style={styles.conclusionText}>{visit.conclusion.treatmentPlan || 'Chua ghi nhan'}</Text>
                      {visit.conclusion.hash256 && <Text style={styles.hash}>{visit.conclusion.hash256}</Text>}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.screen,
    gap: 16,
  },
  hero: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    gap: 12,
    borderRadius: spacing.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  patientCode: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  integrityBar: {
    borderRadius: 14,
    backgroundColor: colors.successSoft,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  integrityText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  visit: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8eef4',
    backgroundColor: '#fbfdff',
    padding: 14,
    gap: 12,
  },
  visitTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  visitCopy: {
    flex: 1,
    gap: 4,
  },
  visitCode: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  visitTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  visitMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeOk: {
    backgroundColor: colors.successSoft,
    borderColor: '#a7f3d0',
  },
  badgeWarn: {
    backgroundColor: colors.warningSoft,
    borderColor: '#fde68a',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  badgeTextOk: {
    color: colors.success,
  },
  badgeTextWarn: {
    color: colors.warning,
  },
  conclusion: {
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: '#e8eef4',
    paddingTop: 10,
  },
  conclusionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  conclusionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  hash: {
    color: '#475569',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
});
