export const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001/api').replace(/\/$/, '');
export const SCANNER_DEVICE_LABEL = process.env.EXPO_PUBLIC_SCANNER_DEVICE_LABEL || 'KLTN NFC Mobile';
