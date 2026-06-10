import {
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHash,
  computeEntryHashV2,
  computeRecordHash,
  GENESIS_PREV_HASH,
  getAuditHashKey,
} from './audit-hash.util';

describe('audit-hash.util canonicalize', () => {
  it('sorts object keys deterministically', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('sorts nested object keys deterministically', () => {
    const left = { z: { b: true, a: 'x' }, a: 1 };
    const right = { a: 1, z: { a: 'x', b: true } };

    expect(canonicalize(left)).toBe(canonicalize(right));
    expect(canonicalize(left)).toBe('{"a":1,"z":{"a":"x","b":true}}');
  });

  it('serializes Date values to ISO strings', () => {
    expect(canonicalize({ at: new Date('2026-06-10T00:00:00.000Z') })).toBe(
      '{"at":"2026-06-10T00:00:00.000Z"}',
    );
  });

  it('preserves array order while canonicalizing elements', () => {
    expect(canonicalize([{ b: 2, a: 1 }, { a: 3 }])).toBe('[{"a":1,"b":2},{"a":3}]');
  });

  it('rejects undefined instead of converting it to null', () => {
    expect(() => canonicalize({ phone: undefined })).toThrow('Unsupported undefined at $.phone');
  });

  it('rejects BigInt values', () => {
    expect(() => canonicalize({ seq: BigInt(1) })).toThrow('Unsupported BigInt at $.seq');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ value: NaN })).toThrow('Unsupported non-finite number at $.value');
    expect(() => canonicalize({ value: Infinity })).toThrow('Unsupported non-finite number at $.value');
    expect(() => canonicalize({ value: -Infinity })).toThrow('Unsupported non-finite number at $.value');
  });

  it('rejects Map and Set values', () => {
    expect(() => canonicalize({ m: new Map([['a', 1]]) })).toThrow('Unsupported Map at $.m');
    expect(() => canonicalize({ s: new Set([1]) })).toThrow('Unsupported Set at $.s');
  });

  it('rejects cyclic objects with a useful path', () => {
    const value: any = { id: 'root' };
    value.self = value;

    expect(() => canonicalize(value)).toThrow('Unsupported cyclic object at $.self');
  });

  it('rejects invalid Date values', () => {
    expect(() => canonicalize({ at: new Date('not-a-date') })).toThrow('Unsupported invalid Date at $.at');
  });

  it('rejects binary and typed-array values', () => {
    expect(() => canonicalize({ raw: Buffer.from('abc') })).toThrow('Unsupported binary data at $.raw');
    expect(() => canonicalize({ raw: new Uint8Array([1, 2, 3]) })).toThrow('Unsupported binary data at $.raw');
  });

  it('rejects class instances and Decimal-like non-plain objects', () => {
    class SnapshotClass {
      constructor(public readonly id: string) {}
    }
    class DecimalLike {
      constructor(private readonly value: string) {}
      toString() {
        return this.value;
      }
    }

    expect(() => canonicalize({ value: new SnapshotClass('snapshot-1') })).toThrow(
      'Unsupported non-plain object SnapshotClass at $.value',
    );
    expect(() => canonicalize({ amount: new DecimalLike('1.23') })).toThrow(
      'Unsupported non-plain object DecimalLike at $.amount',
    );
  });

  it('allows null-prototype plain objects', () => {
    const value = Object.create(null) as Record<string, unknown>;
    value.b = 2;
    value.a = 1;

    expect(canonicalize(value)).toBe('{"a":1,"b":2}');
  });

  it('computes deterministic record hashes with explicit salt and pepper', () => {
    const left = computeRecordHash({ b: 2, a: 1 }, 'salt', 'pepper');
    const right = computeRecordHash({ a: 1, b: 2 }, 'salt', 'pepper');

    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });

  it('computes deterministic entry hashes with explicit pepper', () => {
    const core = {
      seq: 1,
      actorId: 'actor-1',
      action: 'CREATE',
      entity: 'Department',
      entityId: 'dept-1',
      dataHash: 'a'.repeat(64),
      createdAtIso: '2026-06-10T00:00:00.000Z',
    };

    const left = computeEntryHash(core, GENESIS_PREV_HASH, 'pepper');
    const right = computeEntryHash({ ...core }, GENESIS_PREV_HASH, 'pepper');

    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });

  it('requires AUDIT_PEPPER in production when using configured pepper', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalPepper = process.env.AUDIT_PEPPER;
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_PEPPER;

    try {
      expect(() => computeRecordHash({ id: 'audit-1' }, 'salt')).toThrow(
        'AUDIT_PEPPER is required in production for audit hash integrity',
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalPepper === undefined) delete process.env.AUDIT_PEPPER;
      else process.env.AUDIT_PEPPER = originalPepper;
    }
  });

  it('allows missing AUDIT_PEPPER outside production for local development', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalPepper = process.env.AUDIT_PEPPER;
    process.env.NODE_ENV = 'development';
    delete process.env.AUDIT_PEPPER;

    try {
      expect(computeRecordHash({ id: 'audit-1' }, 'salt')).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalPepper === undefined) delete process.env.AUDIT_PEPPER;
      else process.env.AUDIT_PEPPER = originalPepper;
    }
  });
});

describe('audit-hash.util v2 HMAC payloads', () => {
  const key = 'audit-hash-key-for-tests-with-32-chars';
  const before = { fullName: 'abc', status: 'ACTIVE' };
  const after = { status: 'ACTIVE', fullName: 'def' };
  const diffJson = {
    schema: 'KLTN_AUDIT_DIFF_V1',
    fieldsChanged: ['fullName'],
    changes: [{ field: 'fullName', before: 'abc', after: 'def', sensitivity: 'PII' }],
  };

  it('computes deterministic domain-separated before, after, and diff hashes', () => {
    const beforeHash = computeBeforeHashV2('StaffProfile', 'staff-1', { status: 'ACTIVE', fullName: 'abc' }, key);
    const beforeHashReordered = computeBeforeHashV2('StaffProfile', 'staff-1', before, key);
    const afterHash = computeAfterHashV2('StaffProfile', 'staff-1', after, key);
    const diffHash = computeDiffHashV2(diffJson, key);

    expect(beforeHash).toBe(beforeHashReordered);
    expect(beforeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(afterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(diffHash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set([beforeHash, afterHash, diffHash]).size).toBe(3);
  });

  it('computes dataHash from plaintext hashes and never requires ciphertext', () => {
    const beforeHash = computeBeforeHashV2('StaffProfile', 'staff-1', before, key);
    const afterHash = computeAfterHashV2('StaffProfile', 'staff-1', after, key);
    const diffHash = computeDiffHashV2(diffJson, key);

    const left = computeDataHashV2(
      { entity: 'StaffProfile', entityId: 'staff-1', action: 'UPDATE', beforeHash, afterHash, diffHash, fieldsChanged: ['fullName'] },
      key,
    );
    const right = computeDataHashV2(
      { entity: 'StaffProfile', entityId: 'staff-1', action: 'UPDATE', beforeHash, afterHash, diffHash, fieldsChanged: ['fullName'] },
      key,
    );

    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });

  it('computes entryHash V2 from canonical entry payload and changes when component hashes change', () => {
    const beforeHash = computeBeforeHashV2('StaffProfile', 'staff-1', before, key);
    const afterHash = computeAfterHashV2('StaffProfile', 'staff-1', after, key);
    const diffHash = computeDiffHashV2(diffJson, key);
    const dataHash = computeDataHashV2(
      { entity: 'StaffProfile', entityId: 'staff-1', action: 'UPDATE', beforeHash, afterHash, diffHash, fieldsChanged: ['fullName'] },
      key,
    );

    const entryHash = computeEntryHashV2({
      seq: 7,
      prevHash: GENESIS_PREV_HASH,
      entity: 'StaffProfile',
      entityId: 'staff-1',
      action: 'UPDATE',
      actorId: 'admin-1',
      beforeHash,
      afterHash,
      diffHash,
      dataHash,
      createdAtIso: '2026-06-10T00:00:00.000Z',
    });
    const tampered = computeEntryHashV2({
      seq: 7,
      prevHash: GENESIS_PREV_HASH,
      entity: 'StaffProfile',
      entityId: 'staff-1',
      action: 'UPDATE',
      actorId: 'admin-1',
      beforeHash,
      afterHash: beforeHash,
      diffHash,
      dataHash,
      createdAtIso: '2026-06-10T00:00:00.000Z',
    });

    expect(entryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tampered).not.toBe(entryHash);
  });

  it('requires AUDIT_HASH_KEY in production for configured V2 hashes', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.AUDIT_HASH_KEY;
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_HASH_KEY;

    try {
      expect(() => computeDiffHashV2(diffJson)).toThrow('AUDIT_HASH_KEY is required for Blockchain Audit V2');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey === undefined) delete process.env.AUDIT_HASH_KEY;
      else process.env.AUDIT_HASH_KEY = originalKey;
    }
  });

  it('requires explicit opt-in for the local insecure HMAC key', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.AUDIT_HASH_KEY;
    const originalAllow = process.env.ALLOW_INSECURE_AUDIT_CRYPTO;
    process.env.NODE_ENV = 'development';
    delete process.env.AUDIT_HASH_KEY;
    process.env.ALLOW_INSECURE_AUDIT_CRYPTO = 'true';

    try {
      expect(getAuditHashKey()).toBe('dev-only-insecure-audit-hash-key-change-me-32-bytes');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey === undefined) delete process.env.AUDIT_HASH_KEY;
      else process.env.AUDIT_HASH_KEY = originalKey;
      if (originalAllow === undefined) delete process.env.ALLOW_INSECURE_AUDIT_CRYPTO;
      else process.env.ALLOW_INSECURE_AUDIT_CRYPTO = originalAllow;
    }
  });

  it('rejects short V2 HMAC keys', () => {
    const originalKey = process.env.AUDIT_HASH_KEY;
    process.env.AUDIT_HASH_KEY = 'too-short';

    try {
      expect(() => getAuditHashKey()).toThrow('AUDIT_HASH_KEY must be at least 32 characters');
    } finally {
      if (originalKey === undefined) delete process.env.AUDIT_HASH_KEY;
      else process.env.AUDIT_HASH_KEY = originalKey;
    }
  });

  it('keeps V1 record hashing available for legacy rows', () => {
    expect(computeRecordHash({ legacy: true }, 'salt', 'pepper')).toMatch(/^[0-9a-f]{64}$/);
  });
});
