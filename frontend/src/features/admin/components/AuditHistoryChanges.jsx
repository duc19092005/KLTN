import React, { useState } from 'react';

const FIELD_LABELS = {
  name: 'Tên',
  departmentCode: 'Mã phòng ban',
  description: 'Mô tả',
  type: 'Loại',
  status: 'Trạng thái',
  isDeleted: 'Trạng thái hiển thị',
  fullName: 'Họ tên',
  employeeCode: 'Mã nhân sự',
  phone: 'Số điện thoại',
  gender: 'Giới tính',
  citizenId: 'Số CCCD',
  birthDate: 'Ngày sinh',
  address: 'Địa chỉ',
  avatarUrl: 'Ảnh đại diện',
  departmentId: 'Phòng ban',
  position: 'Chức danh',
  specialty: 'Chuyên khoa',
  licenseNumber: 'Số CCHN',
  qualification: 'Học hàm/Học vị',
  yearsExperience: 'Số năm kinh nghiệm',
  modelName: 'Tên mô hình',
  modelVersion: 'Phiên bản',
  recommendedSpecialty: 'Chuyên khoa gợi ý',
  provider: 'Nền tảng',
  apiEndpoint: 'Điểm cuối API',
  ipHashPlain: 'Dấu vân tay cấu hình',
  createdBy: 'Người tạo',
};

function cleanField(field) {
  if (!field) return 'Trường dữ liệu';
  const parts = String(field).split('.');
  return parts[parts.length - 1];
}

function fieldLabel(field) {
  const key = cleanField(field);
  return FIELD_LABELS[key] || key;
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === '[REDACTED]') return 'Đã ẩn trong bản ghi cũ';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function extractChanges(log) {
  const changes = log.diffJson?.changes || log.diff?.changes || log.diff;
  if (Array.isArray(changes) && changes.length) {
    return changes.map((change) => ({
      field: change.field || change.fieldPath,
      before: change.before,
      after: change.after,
    }));
  }

  if (Array.isArray(log.fieldsChanged) && log.fieldsChanged.length) {
    return log.fieldsChanged.map((field) => ({ field, before: undefined, after: undefined }));
  }

  return [];
}

export default function AuditHistoryChanges({ log }) {
  const [open, setOpen] = useState(false);
  const changes = extractChanges(log);

  if (!changes.length) {
    return (
      <p className="text-[11px] font-semibold text-slate-400">
        Không có trường dữ liệu thay đổi trong bản ghi này.
      </p>
    );
  }

  const preview = changes.slice(0, 3).map((change) => fieldLabel(change.field)).join(', ');

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100/70"
      >
        <span>
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
            Trường thay đổi ({changes.length})
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-600">
            {preview}{changes.length > 3 ? ` +${changes.length - 3} trường khác` : ''}
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700">
          {open ? 'Thu gọn' : 'Xem chi tiết'}
        </span>
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-slate-100 p-2">
          {changes.slice(0, 6).map((change, index) => (
            <div key={`${change.field || 'field'}-${index}`} className="rounded-lg bg-white px-2 py-1.5 text-[11px] shadow-sm ring-1 ring-slate-100">
              <div className="font-black text-slate-700">{fieldLabel(change.field)}</div>
              {(change.before !== undefined || change.after !== undefined) && (
                <div className="mt-0.5 grid gap-1 font-mono text-[10px] text-slate-500 sm:grid-cols-2">
                  <span className="break-all">Trước: <b className="text-rose-700">{displayValue(change.before)}</b></span>
                  <span className="break-all">Sau: <b className="text-emerald-700">{displayValue(change.after)}</b></span>
                </div>
              )}
            </div>
          ))}
          {changes.length > 6 && (
            <p className="text-[10px] font-bold text-slate-400">+{changes.length - 6} trường khác</p>
          )}
        </div>
      )}
    </div>
  );
}
