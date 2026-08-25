import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { visitService } from '../apis/visitService';
import { patientService } from '../apis/patientService';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';
import { getVisitStatus } from '../constants/visitStatus';
import { useToast } from '../../../providers/ToastProvider';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { FileText, Search, Plus, User, Calendar, Phone, CreditCard, X, ChevronRight, Activity } from 'lucide-react';

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getVisitDepartmentName(visit) { return visit.department?.name || visit.department?.departmentCode || 'Chưa có phòng'; }
function getVisitStaffName(visit) { return visit.staff?.fullName || visit.staff?.user?.username || 'N/A'; }
const PAGE_SIZE = 10;

export default function ReceptionistRecordsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [patientRes, visitRes] = await Promise.all([patientService.search({ limit: 100 }), visitService.search({ limit: 100 })]);
        if (!mounted) return;
        setPatients(getItems(patientRes.data));
        setVisits(getItems(visitRes.data));
      } catch (err) {
        if (mounted) toast.error(err.response?.data?.message || 'Không tải được hồ sơ');
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { setPage(1); }, [query]);

  const filteredPatients = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return patients;
    return patients.filter((patient) => [patient.fullName, patient.patientCode, patient.phone, patient.citizenId].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [patients, query]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const pagedPatients = filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visitsOf = (patient) => visits.filter((visit) => visit.patientId === patient.id || visit.patient?.id === patient.id);

  return (
    <DashboardLayout
      user={user}
      navItems={FRONTDESK_NAV_ITEMS}
      activeItem="patient-records"
      onNavigate={(id) => navigate(frontdeskRouteFor(id))}
      onLogout={logout}
    >
      <div className="mx-auto max-w-[1600px] space-y-6 antialiased pb-12">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <FileText className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Lễ tân
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Danh mục hồ sơ bệnh nhân</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Quản lý Hồ sơ Bệnh nhân
                </h1>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto items-center">
              <div className="relative w-full sm:w-[320px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tra cứu BN, Mã CCCD, SĐT..."
                  className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <button
                type="button"
                onClick={() => navigate('/receptionist/intake')}
                className="h-11 w-full sm:w-auto rounded-xl bg-sky-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Tiếp nhận bệnh nhân</span>
              </button>
            </div>
          </div>
        </section>

        {/* PATIENT LIST TABLE / CARDS */}
        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải danh sách hồ sơ..." />
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Danh sách bệnh nhân đăng ký</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  Hiển thị {filteredPatients.length} trên tổng số {patients.length} hồ sơ bệnh nhân
                </p>
              </div>
            </div>

            {pagedPatients.length ? (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="ui-table min-w-full text-left">
                    <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5">Bệnh nhân</th>
                        <th className="px-6 py-3.5">Số CCCD</th>
                        <th className="px-6 py-3.5">Số điện thoại</th>
                        <th className="px-6 py-3.5">Lượt khám</th>
                        <th className="px-6 py-3.5">Trạng thái gần nhất</th>
                        <th className="px-6 py-3.5">Độ tin cậy dữ liệu</th>
                        <th className="px-6 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedPatients.map((patient) => (
                        <PatientRow
                          key={patient.id}
                          patient={patient}
                          visits={visitsOf(patient)}
                          onOpen={() => setSelectedPatient(patient)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-4 lg:hidden">
                  {pagedPatients.map((patient) => (
                    <PatientCard
                      key={patient.id}
                      patient={patient}
                      visits={visitsOf(patient)}
                      onOpen={() => setSelectedPatient(patient)}
                    />
                  ))}
                </div>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  total={filteredPatients.length}
                  onPrev={() => setPage((v) => Math.max(1, v - 1))}
                  onNext={() => setPage((v) => Math.min(totalPages, v + 1))}
                />
              </>
            ) : (
              <Empty title="Không có dữ liệu bệnh nhân phù hợp." />
            )}
          </section>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          visits={visitsOf(selectedPatient)}
          onClose={() => setSelectedPatient(null)}
          onCreateVisit={() => navigate('/receptionist/intake', { state: { patient: selectedPatient } })}
        />
      )}
    </DashboardLayout>
  );
}

function PatientRow({ patient, visits, onOpen }) {
  const latestVisit = visits[0];
  const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null;
  return (
    <tr className="bg-white transition-colors hover:bg-sky-50/30">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
            {patient.fullName?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">{patient.fullName}</p>
            <p className="text-[11px] font-semibold text-sky-600">Mã BN: {patient.patientCode}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-xs font-semibold text-slate-700">{patient.citizenId || '—'}</td>
      <td className="px-6 py-4 text-xs font-semibold text-slate-700">{patient.phone || '—'}</td>
      <td className="px-6 py-4 text-xs font-extrabold text-sky-700">{visits.length} lượt</td>
      <td className="px-6 py-4">
        {latestStatus ? <StatusBadge st={latestStatus} /> : <span className="text-xs font-medium text-slate-400">Chưa có</span>}
      </td>
      <td className="px-6 py-4">
        {latestVisit?.blockchainStatus ? (
          <BlockchainStatusBadge status={latestVisit.blockchainStatus} size="xs" />
        ) : (
          <span className="text-xs font-medium text-slate-400">—</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          Xem chi tiết
        </button>
      </td>
    </tr>
  );
}

function PatientCard({ patient, visits, onOpen }) {
  const latestVisit = visits[0];
  const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null;
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-900">{patient.fullName}</p>
          <p className="text-[11px] font-semibold text-slate-500">{patient.patientCode} • SĐT: {patient.phone || 'Chưa có'}</p>
        </div>
        {latestStatus ? <StatusBadge st={latestStatus} /> : <span className="text-xs font-bold text-slate-400">{visits.length} lượt</span>}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Xem chi tiết hồ sơ
      </button>
    </article>
  );
}

function PatientDetailModal({ patient, visits, onClose, onCreateVisit }) {
  const [activeTab, setActiveTab] = useState('profile');
  const latestVisit = visits[0];
  const latestStatus = latestVisit ? getVisitStatus(latestVisit.status) : null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 antialiased">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeIn">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-600 text-white font-black text-lg flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
              {patient.fullName?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700">
                  {patient.patientCode}
                </span>
                {latestStatus && <StatusBadge st={latestStatus} />}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{patient.fullName}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* MODAL TABS */}
        <div className="shrink-0 border-b border-slate-100 px-6 py-3 bg-slate-50/50">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'profile'
                  ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Thông tin chi tiết bệnh nhân
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('visits')}
              className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'visits'
                  ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Lịch sử các lần khám bệnh ({visits.length})
            </button>
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto bg-slate-50/40 p-6">
          {activeTab === 'profile' ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Hồ sơ hành chính</h3>
                <button
                  type="button"
                  onClick={onCreateVisit}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-all"
                >
                  + Tiếp nhận lượt khám mới
                </button>
              </div>
              <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                {[
                  ['Ngày sinh', patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'],
                  ['Giới tính', patient.gender === 'MALE' ? 'Nam' : patient.gender === 'FEMALE' ? 'Nữ' : 'Chưa cập nhật'],
                  ['Số CCCD', patient.citizenId || 'Chưa cập nhật'],
                  ['Số điện thoại', patient.phone || 'Chưa cập nhật'],
                  ['Mã thẻ BHYT', patient.insuranceNumber || 'Chưa cập nhật'],
                  ['Liên hệ khẩn cấp', patient.emergencyContact || 'Chưa cập nhật'],
                  ['Địa chỉ cư trú', patient.address || 'Chưa cập nhật'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[160px_1fr] gap-3 px-5 py-3.5 text-xs">
                    <dt className="font-bold text-slate-500">{label}</dt>
                    <dd className="break-words font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <section className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Lịch sử lượt khám ({visits.length})</h3>
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="divide-y divide-slate-100">
                  {visits.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} />
                  ))}
                  {!visits.length && <Empty title="Chưa có lượt khám nào cho bệnh nhân này." compact />}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function VisitRow({ visit }) {
  const st = getVisitStatus(visit.status);
  return (
    <div className="grid grid-cols-1 gap-2 bg-white p-4 hover:bg-slate-50 md:grid-cols-[1fr_auto_130px_140px] md:items-center transition-colors">
      <div>
        <strong className="text-xs font-bold text-slate-900">{visit.visitCode}</strong>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          Phòng: {getVisitDepartmentName(visit)} • BS. {getVisitStaffName(visit)}
        </p>
      </div>
      <BlockchainStatusBadge status={visit.blockchainStatus} size="xs" />
      <StatusBadge st={st} />
      <span className="text-[11px] font-medium text-slate-400 md:text-right">
        {visit.createdAt
          ? new Date(visit.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
          : 'N/A'}
      </span>
    </div>
  );
}

function StatusBadge({ st }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {st.shortLabel || st.label}
    </span>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">
        Trang {page} / {totalPages} • Tổng số {total} hồ sơ bệnh nhân
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Trang trước
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

function Empty({ title, compact = false }) {
  return (
    <div className={`text-center text-xs font-bold text-slate-400 ${compact ? 'p-6' : 'p-12'}`}>
      {title}
    </div>
  );
}
