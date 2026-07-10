export function presentAiModel<T extends Record<string, any>>(model: T) {
  const { ipHashEncrypted, ipHashPlain, encryptionKeyId, ...safe } = model;
  return {
    ...safe,
    secretConfigured: Boolean(ipHashEncrypted),
    secretFingerprint: ipHashPlain || null,
  };
}
