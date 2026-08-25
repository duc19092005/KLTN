export type PageIntegrityStatus =
  | 'VERIFIED'
  | 'TAMPERED'
  | 'UNANCHORED'
  | 'PENDING_ANCHOR'
  | 'VERIFICATION_UNAVAILABLE';

export type PageIntegrityTarget = {
  id: string;
  entity: string;
  entityId: string;
  currentAfterHash: string;
  storedHash?: string | null;
  recomputedHash?: string | null;
  dbMatches?: boolean;
};

export type PageIntegrityResult = {
  id: string;
  entity: string;
  entityId: string;
  status: PageIntegrityStatus;
  dbMatches: boolean;
  chainMatches: boolean;
  onChainHash: string | null;
  storedHash: string | null;
  recomputedHash: string | null;
  batchId: number | null;
  seq: number | null;
};
