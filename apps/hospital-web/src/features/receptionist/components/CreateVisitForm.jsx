import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';
import { useToast } from '../../../providers/ToastProvider';
import { Building2, Stethoscope, Search, CheckCircle2, UserCheck, ArrowRight } from 'lucide-react';

export default function CreateVisitForm({ patient, onVisitCreated, onCancel }) {
  const [specialty, setSpecialty] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const fetchDepartments = async (searchSpecialty = '') => {
    setLoadingDepartments(true);
    try {
      const res = await visitService.suggestDepartments(searchSpecialty);
      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setDepartments(data);
      setSelectedDepartment(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải danh sách phòng khám');
    } finally {
      setLoadingDepartments(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSearchSpecialty = (event) => {
    event.preventDefault();
    fetchDepartments(specialty);
  };

  const handleCreateVisit = async () => {
    if (!selectedDepartment) {
      toast.error('Vui lòng chọn phòng khám');
      return;
    }
    setCreating(true);
    try {
      const primaryDoctor = selectedDepartment.staffs?.[0];
      const res = await visitService.create({
        patientId: patient.id,
        departmentId: selectedDepartment.id,
        staffId: primaryDoctor?.id,
      });
      onVisitCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tạo lượt khám');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 antialiased">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">
              Chỉ định phòng khám
            </p>
            <h2 className="text-base font-bold text-slate-900">
              Chọn phòng khám tiếp nhận cho bệnh nhân <span className="text-sky-600">{patient.fullName}</span>
            </h2>
          </div>
          {loadingDepartments && (
            <span className="text-xs font-semibold text-sky-600 flex items-center gap-1.5">
              <LoadingIndicator size="sm" /> Đang tải phòng khám...
            </span>
          )}
        </div>

        {/* SEARCH / FILTER SPECIALTY FORM */}
        <form onSubmit={handleSearchSpecialty} className="mb-5 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              placeholder="Lọc chuyên khoa, triệu chứng hoặc tên phòng khám..."
              className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <button
            type="submit"
            disabled={loadingDepartments}
            className="h-11 rounded-xl bg-sky-50 border border-sky-200 px-5 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 whitespace-nowrap"
          >
            {loadingDepartments ? <LoadingIndicator size="sm" /> : 'Lọc phòng khám'}
          </button>
        </form>

        {/* EMPTY DEPARTMENTS STATE */}
        {departments.length === 0 && !loadingDepartments && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Không có phòng khám phù hợp.</p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              Thử đổi từ khóa chuyên khoa, triệu chứng hoặc tên phòng khám.
            </p>
          </div>
        )}

        {/* DEPARTMENTS SELECTION GRID */}
        <div className="grid max-h-[360px] grid-cols-1 gap-3.5 overflow-y-auto pr-1 xl:grid-cols-2 scrollbar-thin">
          {departments.map((department) => {
            const doctors = department.staffs || [];
            const primaryDoctor = doctors[0];
            const isSelected = selectedDepartment?.id === department.id;
            return (
              <button
                type="button"
                key={department.id}
                onClick={() => setSelectedDepartment(department)}
                className={`group rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-sky-300 bg-sky-50/90 shadow-xs ring-2 ring-sky-100'
                    : 'border-slate-200/80 bg-slate-50/60 hover:border-sky-200 hover:bg-sky-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-bold ${isSelected ? 'text-sky-800' : 'text-slate-900'}`}>
                      {department.name}
                    </p>
                    <p className="mt-0.5 text-xs font-mono font-bold text-sky-600">
                      Mã: {department.departmentCode || 'PK'}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-bold text-white flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3 h-3" /> Đã chọn
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                  Chuyên khoa: <span className="text-slate-700 font-bold">{department.specialty || 'Đa khoa'}</span>
                </p>

                {/* PRIMARY DOCTOR CARD */}
                <div className="mt-3 rounded-xl border border-white/80 bg-white p-3 shadow-xs">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Bác sĩ phụ trách
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {doctors.length} BS trực
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
                      {primaryDoctor?.avatarUrl ? (
                        <img
                          src={primaryDoctor.avatarUrl}
                          alt={primaryDoctor.fullName || 'Bác sĩ'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>BS</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-bold text-slate-900">
                        {primaryDoctor ? `BS. ${primaryDoctor.fullName}` : 'Chưa phân công bác sĩ'}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500 truncate">
                        {primaryDoctor?.specialty || department.specialty || 'Khám tổng quát'}
                      </p>
                    </div>
                    <span className="hidden rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline-flex">
                      Sẵn sàng
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ACTION FOOTER BUTTONS */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Quay lại chọn bệnh nhân
        </button>

        <button
          onClick={handleCreateVisit}
          disabled={creating || !selectedDepartment}
          className="w-full sm:w-auto flex-1 rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {creating ? <LoadingIndicator size="sm" tone="white" /> : (
            <>
              <span>Xác nhận tạo lượt khám</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
