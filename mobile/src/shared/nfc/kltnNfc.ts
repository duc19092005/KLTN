import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { KLTNNfcCard, ReceptionistPairingPayload } from '../types/nfc';

type NdefRecordLike = {
  payload?: unknown;
};

type TagLike = {
  ndefMessage?: unknown;
};

let nfcStarted = false;

export async function scanKLTNNfcCard(): Promise<KLTNNfcCard> {
  const rawText = await readFirstNdefText('Ap the CCCD demo vao mat lung dien thoai');
  return parseKLTNNfcCard(rawText);
}

export function parseKLTNNfcCard(rawText: string): KLTNNfcCard {
  const parsed = parseJsonObject(rawText);
  if (
    parsed.type !== 'KLTN_CCCD' ||
    parsed.version !== 1 ||
    typeof parsed.citizenId !== 'string' ||
    typeof parsed.fullName !== 'string' ||
    typeof parsed.dateOfBirth !== 'string' ||
    typeof parsed.gender !== 'string' ||
    typeof parsed.address !== 'string'
  ) {
    throw new Error('The NFC card is not a valid KLTN_CCCD v1 payload.');
  }

  if (!['MALE', 'FEMALE', 'OTHER'].includes(parsed.gender)) {
    throw new Error('The NFC card gender value is not supported.');
  }

  return {
    type: 'KLTN_CCCD',
    version: 1,
    citizenId: parsed.citizenId.trim(),
    fullName: parsed.fullName.trim(),
    dateOfBirth: parsed.dateOfBirth,
    gender: parsed.gender as KLTNNfcCard['gender'],
    address: parsed.address.trim(),
    issuedAt: typeof parsed.issuedAt === 'string' ? parsed.issuedAt : undefined,
  };
}

export function parseReceptionistPairingPayload(rawText: string): ReceptionistPairingPayload {
  const parsed = parseJsonObject(rawText);
  if (
    parsed.type !== 'KLTN_NFC_SESSION' ||
    parsed.version !== 1 ||
    typeof parsed.sessionId !== 'string' ||
    typeof parsed.mobileToken !== 'string'
  ) {
    throw new Error('Pairing payload must include KLTN_NFC_SESSION v1, sessionId, and mobileToken.');
  }

  return {
    type: 'KLTN_NFC_SESSION',
    version: 1,
    sessionId: parsed.sessionId.trim(),
    mobileToken: parsed.mobileToken.trim(),
  };
}

async function readFirstNdefText(alertMessage: string): Promise<string> {
  await ensureNfcReady();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage });
    const tag = (await NfcManager.getTag()) as TagLike | null;
    const record = getFirstNdefRecord(tag);
    const text = decodeNdefTextRecord(record);
    if (!text) throw new Error('No readable NDEF text record was found on this NFC card.');
    return text;
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

async function ensureNfcReady() {
  if (!nfcStarted) {
    await NfcManager.start();
    nfcStarted = true;
  }

  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error('This device does not support NFC.');

  const enabled = await NfcManager.isEnabled();
  if (!enabled) throw new Error('NFC is disabled. Please enable NFC in device settings.');
}

function getFirstNdefRecord(tag: TagLike | null): NdefRecordLike {
  const message = tag?.ndefMessage;
  if (!Array.isArray(message) || message.length === 0) {
    throw new Error('The NFC tag does not contain an NDEF message.');
  }
  return message[0] as NdefRecordLike;
}

function decodeNdefTextRecord(record: NdefRecordLike): string {
  const payload = normalizePayload(record.payload);
  if (payload.length === 0) return '';

  const languageCodeLength = payload[0] & 0x3f;
  const textBytes = payload.slice(1 + languageCodeLength);
  return bytesToUtf8(textBytes).trim();
}

function normalizePayload(payload: unknown): number[] {
  if (Array.isArray(payload)) return payload.map((value) => Number(value)).filter(Number.isFinite);
  if (payload instanceof Uint8Array) return Array.from(payload);
  return [];
}

function bytesToUtf8(bytes: number[]): string {
  try {
    return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

function parseJsonObject(rawText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Payload is not a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid JSON payload.');
  }
}
