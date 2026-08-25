import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { doctorService } from '../apis/doctorService';
import { useToast } from '../../../providers/ToastProvider';
import AuditHistoryChanges from './AuditHistoryChanges';

const STATUS_TONE = {
  VERIFIED: { label: 'Xác thực khớp với blockchain', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  TAMPERED: { label: 'CẢNH BÁO: Dữ liệu đã bị sửa đổi!', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  PENDING_ANCHOR: { label: 'Đang chờ neo on-chain', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  UNANCHORED: { label: 'Chưa được neo trên blockchain', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  VERIFICATION_UNAVAILABLE: { label: 'Tạm thời chưa xác minh được blockchain', cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const ACTION_LABEL = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

const SPECIALTY_LABEL = {
  GENERAL_INTERNAL_MEDICINE: 'Nội tổng quát',
  GENERAL_SURGERY: 'Ngoại tổng quát',
  PEDIATRICS: 'Nhi khoa',
  OBSTETRICS_GYNECOLOGY: 'Sản phụ khoa',
  CARDIOLOGY: 'Tim mạch',
  ENT: 'Tai Mũi Họng',
  DENTOMAXILLOFACIAL: 'Răng Hàm Mặt',
  OPHTHALMOLOGY: 'Mắt',
  DERMATOLOGY: 'Da liễu',
  NEUROLOGY: 'Thần kinh',
  ORTHOPEDICS: 'Chấn thương chỉnh hình',
  GASTROENTEROLOGY: 'Tiêu hóa',
  ENDOCRINOLOGY: 'Nội tiết',
  ONCOLOGY: 'Ung bướu',
  RESPIRATORY: 'Hô hấp',
};

function getSpecialtyLabel(value) {
  return SPECIALTY_LABEL[value] || value || 'N/A';
}

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'N/A';
}

function genderLabel(value) {
  if (value === 'MALE' || value === 'Nam') return 'Nam';
  if (value === 'FEMALE' || value === 'Nữ') return 'Nữ';
  return value || 'Chưa cập nhật';
}

export default function DoctorDetailModal({ doctorId, onClose }) {
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'history'

  const load = async () => {
    setLoading(true);
    try {
      const [res, historyRes] = await Promise.all([
        doctorService.get(doctorId),
        doctorService.history(doctorId),
      ]);
      setDetail(res.data);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.items || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được chi tiết bác sĩ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (doctorId) load();
  }, [doctorId]);

  if (!doctorId) return null;

  const staff = detail?.staffProfile || {};
  const audit = detail?.audit || {};
  const tone = STATUS_TONE[audit.status] || STATUS_TONE.UNANCHORED;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {staff.avatarUrl ? (
              <img src={staff.avatarUrl} alt={staff.fullName} className="w-16 h-16 rounded-2xl object-cover border border-cyan-100" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-xl font-black text-cyan-500">
                BS
              </div>
            )}
            <div>
              <h3 className="text-2xl font-black text-slate-950">{staff.fullName || 'Hồ sơ Bác sĩ'}</h3>
              <p className="text-sm text-slate-500">{getSpecialtyLabel(detail?.specialty)} • {detail?.qualification}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Làm mới</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="shrink-0 px-6 py-2 border-b border-slate-100 flex gap-2">
          <button onClick={() => setActiveTab('info')} className={`px-4 py-2 text-xs font-black rounded-xl border transition-colors ${activeTab === 'info' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Hồ sơ & Xác thực blockchain
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-xs font-black rounded-xl border transition-colors ${activeTab === 'history' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Lịch sử cập nhật ({history.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-6">
          {loading ? (
            <LoadingIndicator size="lg" label="Đang tải dữ liệu bác sĩ..." />
          ) : activeTab === 'info' ? (
            <div className="space-y-6">
              {/* Blockchain Seal Banner */}
              <div className={`p-4 rounded-2xl border ${tone.cls} flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${tone.dot} shrink-0 animate-pulse`} />
                  <div>
                    <h4 className="font-black text-sm">{tone.label}</h4>
                    <p className="text-xs opacity-80 mt-0.5">Dữ liệu hồ sơ này được mã hóa và bảo chứng toàn vẹn trên mạng Ethereum/Sepolia.</p>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-inherit text-xs font-mono">
                  Lô neo: #{audit.batchId ?? 'N/A'}
                </div>
              </div>

              {/* Hashes Debug/Verification Panel */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                <h4 className="text-sm font-black text-slate-900 border-b pb-2 tracking-wide uppercase">Chi tiết băm & toàn vẹn</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <HashRow label="Hash lưu trong CSDL" value={audit.dbHash} match={audit.dbMatches} />
                    <HashRow label="Salt mã hóa" value={audit.dataSalt} />
                  </div>
                  <div className="space-y-1">
                    <HashRow label="Hash trên chuỗi" value={audit.onChainHash} match={audit.chainMatches} />
                    <HashRow label="Hash tính lại" value={audit.recomputedHash} match={audit.dbMatches && audit.chainMatches} />
                  </div>
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Demographic details */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-b pb-2 tracking-wide uppercase">Thông tin cá nhân</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Mã nhân viên" value={staff.employeeCode} />
                    <Field label="Vai trò" value={staff.position || 'Bác sĩ'} />
                    <Field label="Số điện thoại" value={staff.phone} />
                    <Field label="CCCD/CMND" value={staff.citizenId} />
                    <Field label="Giới tính" value={genderLabel(staff.gender)} />
                    <Field label="Ngày sinh" value={formatTime(staff.birthDate)?.split(' ')[1] || formatTime(staff.birthDate)} />
                    <Field label="Địa chỉ" value={staff.address} colSpan={2} />
                    <Field label="Phòng ban" value={staff.department ? `${staff.department.departmentCode} - ${staff.department.name}` : 'Chưa gán'} colSpan={2} />
                  </div>
                </div>

                {/* Professional details */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-b pb-2 tracking-wide uppercase">Thông tin chuyên môn</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Số CCHN" value={detail.licenseNumber} colSpan={2} />
                    <Field label="Chuyên khoa" value={getSpecialtyLabel(detail.specialty)} />
                    <Field label="Học hàm/Học vị" value={detail.qualification} />
                    <Field label="Kinh nghiệm" value={`${detail.yearsExperience ?? 0} năm`} />
                    <Field label="Phòng khám" value={staff.department ? `${staff.department.departmentCode} - ${staff.department.name}` : 'Chưa gán'} />
                    <Field label="Ngày tạo hồ sơ" value={formatTime(detail.createdAt)} colSpan={2} />
                    <Field label="Lần cập nhật cuối" value={formatTime(detail.updatedAt)} colSpan={2} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* History List */
            <div className="space-y-3">
              {history.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black ${log.action === 'CREATE' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : 'bg-cyan-50 text-cyan-700 border-cyan-100'}`}>
                        {ACTION_LABEL[log.action] || log.action}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{formatTime(log.createdAt)}</span>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${log.onChainStatus === 'ANCHORED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                      {log.onChainStatus === 'ANCHORED' ? 'Đã neo trên chuỗi' : 'Chờ neo'}
                    </span>
                  </div>
                  {log.txHash && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span>Giao dịch TX:</span>
                      <a href={`#`} className="text-cyan-600 font-bold hover:underline" onClick={(e) => e.preventDefault()}>{log.txHash}</a>
                    </div>
                  )}
                  {log.dataHash && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span>Hash neo:</span>
                      <span className="font-bold text-slate-700">{shortHash(log.dataHash)}</span>
                    </div>
                  )}
                  <AuditHistoryChanges log={log} />
                </div>
              ))}
              {!history.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <strong className="text-slate-700">Chưa có lịch sử thay đổi</strong>
                  <p className="mt-1 text-sm text-slate-500">Mọi chỉnh sửa dữ liệu của bác sĩ này sẽ được ghi lại và neo lên blockchain.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function HashRow({ label, value, match }) {
  return (
    <div className="flex justify-between items-center gap-2 py-0.5">
      <span className="text-slate-500 font-semibold">{label}:</span>
      <span className={`font-mono ${match === true ? 'text-emerald-600 font-bold' : match === false ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
        {shortHash(value)}
      </span>
    </div>
  );
}

function Field({ label, value, colSpan = 1 }) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <p className="mt-0.5 break-words text-sm font-bold text-slate-800">{value || '—'}</p>
    </div>
  );
}
