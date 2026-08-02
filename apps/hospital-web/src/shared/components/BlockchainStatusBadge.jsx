import React from 'react';
import { ShieldCheck, AlertTriangle, Clock3 } from 'lucide-react';

/**
 * Unified "data integrity" badge for any record whose authenticity is anchored on the blockchain.
 *
 * The backend list/verify endpoints return a per-row `blockchainStatus`:
 *   - VERIFIED    : DB hash recomputed AND matches the on-chain Merkle root -> trustworthy.
 *   - TAMPERED    : recomputed hash does NOT match what was anchored -> data was altered. WARN HARD.
 *   - UNANCHORED  : not yet committed on-chain (still inside the ~5 min batch window, or anchoring
 *                   pending). NOT proven yet -> caution, not a failure.
 *
 * Previously most lists collapsed this to binary (!== 'TAMPERED' => "Healthy"), which wrongly
 * painted UNANCHORED rows green. This component renders all three states honestly so an operator
 * can tell "verified on-chain" apart from "not verified yet".
 */
const STATUS_MAP = {
  VERIFIED: {
    label: 'Đã xác thực',
    cls: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    Icon: ShieldCheck,
    pulse: false,
  },
  TAMPERED: {
    label: 'Cảnh báo: Bị sửa đổi',
    cls: 'border-rose-200 bg-rose-50 text-rose-700',
    Icon: AlertTriangle,
    pulse: true,
  },
  UNANCHORED: {
    label: 'Chờ neo (chưa xác thực)',
    cls: 'border-amber-100 bg-amber-50 text-amber-700',
    Icon: Clock3,
    pulse: false,
  },
  // Just-edited rows: a new BlockchainLogger entry exists with the matching hash,
  // but the next Merkle batch (every 5 minutes) hasn't fired yet. Different from UNANCHORED
  // because integrity IS provable end-to-end the moment the next batch is mined.
  PENDING_ANCHOR: {
    label: 'Đang chờ neo on-chain',
    cls: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    Icon: Clock3,
    pulse: false,
  },
};

export default function BlockchainStatusBadge({ status, prefix = '', size = 'sm' }) {
  const s = STATUS_MAP[status] || STATUS_MAP.UNANCHORED;
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const iconSize = size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const Icon = s.Icon;
  return (
    <span
      title={`Trạng thái toàn vẹn dữ liệu: ${s.label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border font-black ${pad} ${s.cls} ${s.pulse ? 'animate-pulse' : ''}`}
    >
      <Icon className={iconSize} strokeWidth={2.5} />
      {prefix}{s.label}
    </span>
  );
}

