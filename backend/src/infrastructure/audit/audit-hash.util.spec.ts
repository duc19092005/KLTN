import { canonicalize, computeEntryHash, computeRecordHash, GENESIS_PREV_HASH } from './audit-hash.util';

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
