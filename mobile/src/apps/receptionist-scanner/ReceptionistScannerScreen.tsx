import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { submitReceptionistNfcResult } from '../../shared/api/client';
import { ActionButton } from '../../shared/components/ActionButton';
import { Field } from '../../shared/components/Field';
import { StatusPanel } from '../../shared/components/StatusPanel';
import { SCANNER_DEVICE_LABEL } from '../../shared/env';
import { parseReceptionistPairingPayload, scanKLTNNfcCard } from '../../shared/nfc/kltnNfc';
import { colors, spacing } from '../../shared/theme/theme';
import { KLTNNfcCard } from '../../shared/types/nfc';

export function ReceptionistScannerScreen() {
  const [pairingText, setPairingText] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [mobileToken, setMobileToken] = useState('');
  const [lastCard, setLastCard] = useState<KLTNNfcCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; title: string; body: string }>({
    tone: 'info',
    title: 'Cho phien quet tu web le tan',
    body: 'Tao NFC session tren web, dan pairing payload hoac nhap sessionId va mobileToken tai day.',
  });

  const canScan = useMemo(() => sessionId.trim().length > 0 && mobileToken.trim().length > 0, [sessionId, mobileToken]);

  const applyPairingPayload = () => {
    try {
      const payload = parseReceptionistPairingPayload(pairingText);
      setSessionId(payload.sessionId);
      setMobileToken(payload.mobileToken);
      setMessage({
        tone: 'success',
        title: 'Da nap phien quet',
        body: 'Co the quet the NFC CCCD va gui ket qua ve web le tan.',
      });
    } catch (error) {
      setMessage({
        tone: 'danger',
        title: 'Pairing payload khong hop le',
        body: error instanceof Error ? error.message : 'Khong doc duoc pairing payload.',
      });
    }
  };

  const scanAndSubmit = async () => {
    if (!canScan) return;
    setBusy(true);
    setMessage({
      tone: 'info',
      title: 'Dang cho the NFC',
      body: 'Ap the trang da ghi KLTN_CCCD JSON vao lung dien thoai.',
    });

    try {
      const card = await scanKLTNNfcCard();
      setLastCard(card);
      await submitReceptionistNfcResult({
        sessionId: sessionId.trim(),
        mobileToken: mobileToken.trim(),
        scannerDeviceLabel: SCANNER_DEVICE_LABEL,
        card,
      });
      setMessage({
        tone: 'success',
        title: 'Da gui CCCD ve web le tan',
        body: `${card.fullName} (${card.citizenId}) da duoc stream qua SSE cho phien hien tai.`,
      });
    } catch (error) {
      setMessage({
        tone: 'danger',
        title: 'Quet NFC that bai',
        body: error instanceof Error ? error.message : 'Khong the gui ket qua NFC.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="id-card-outline" size={26} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Receptionist scanner</Text>
          <Text style={styles.title}>Quet CCCD bang the NFC trang</Text>
          <Text style={styles.subtitle}>Dung cho flow intake, giu song song voi nhap CCCD thu cong tren web.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Field
          label="Pairing payload tu web"
          value={pairingText}
          onChangeText={setPairingText}
          placeholder='{"type":"KLTN_NFC_SESSION","version":1,...}'
          multiline
          style={styles.multiline}
        />
        <ActionButton
          label="Nap pairing payload"
          tone="secondary"
          onPress={applyPairingPayload}
          icon={<Ionicons name="link-outline" size={20} color={colors.primary} />}
        />
      </View>

      <View style={styles.card}>
        <Field label="Session ID" value={sessionId} onChangeText={setSessionId} placeholder="UUID tu /api/nfc-sessions" />
        <Field label="Mobile token" value={mobileToken} onChangeText={setMobileToken} placeholder="Token tu pairingPayload" />
        <ActionButton
          label="Quet NFC va gui ve web"
          disabled={!canScan}
          loading={busy}
          onPress={scanAndSubmit}
          icon={<Ionicons name="scan-outline" size={20} color="#ffffff" />}
        />
      </View>

      <StatusPanel
        tone={message.tone}
        title={message.title}
        body={message.body}
        icon={<Ionicons name={message.tone === 'danger' ? 'warning-outline' : 'shield-checkmark-outline'} size={22} color={colors.primary} />}
      />

      {lastCard && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>The vua doc</Text>
          <InfoRow label="Ho ten" value={lastCard.fullName} />
          <InfoRow label="CCCD" value={lastCard.citizenId} />
          <InfoRow label="Ngay sinh" value={lastCard.dateOfBirth} />
          <InfoRow label="Gioi tinh" value={lastCard.gender} />
          <InfoRow label="Dia chi" value={lastCard.address} />
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.screen,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  card: {
    gap: 14,
    borderRadius: spacing.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    paddingTop: 10,
    gap: 4,
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
