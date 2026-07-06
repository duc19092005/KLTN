import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';
import { useToast } from '../../../providers/ToastProvider';

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
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Chỉ định phòng khám</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Chọn nơi tiếp nhận lượt khám</h2>
          </div>
          {loadingDepartments && <span className="text-xs font-bold text-slate-400">Đang tải phòng khám...</span>}
        </div>

        <form onSubmit={handleSearchSpecialty} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            placeholder="Nhập chuyên khoa, triệu chứng hoặc tên phòng khám..."
            className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
          />
          <button
            type="submit"
            disabled={loadingDepartments}
            className="min-h-[44px] rounded-xl border border-cyan-100 bg-cyan-50 px-5 py-3 text-sm font-black text-cyan-700 transition-colors hover:bg-cyan-100 disabled:opacity-50"
          >
            {loadingDepartments ? <LoadingIndicator size="sm" /> : 'Lọc'}
          </button>
        </form>

        {departments.length === 0 && !loadingDepartments && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-bold text-slate-600">Không có phòng khám phù hợp.</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Thử đổi từ khóa chuyên khoa, triệu chứng hoặc tên phòng khám.</p>
          </div>
        )}

        <div className="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
          {departments.map((department) => {
            const doctors = department.staffs || [];
            const primaryDoctor = doctors[0];
            const isSelected = selectedDepartment?.id === department.id;
            return (
              <button
                type="button"
                key={department.id}
                onClick={() => setSelectedDepartment(department)}
                className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-cyan-300 bg-cyan-50 shadow-sm ring-2 ring-cyan-100' : 'border-slate-100 bg-slate-50/80 hover:border-cyan-200 hover:bg-cyan-50/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-black ${isSelected ? 'text-cyan-800' : 'text-slate-950'}`}>
                      {department.name}
                    </p>
                    <p className="mt-0.5 text-xs font-mono font-black text-cyan-700">{department.departmentCode || 'PK'}</p>
                  </div>
                  {isSelected && <span className="rounded-full bg-cyan-600 px-2.5 py-1 text-[10px] font-black text-white">Đã chọn</span>}
                </div>

                <p className="mt-2 text-xs font-semibold text-slate-500">{department.specialty || 'Đa khoa'}</p>
                <div className="mt-4 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Bác sĩ phụ trách</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{doctors.length} BS</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-100 to-sky-50 ring-2 ring-white">
                      {primaryDoctor?.avatarUrl ? (
                        <img src={primaryDoctor.avatarUrl} alt={primaryDoctor.fullName || 'Bác sĩ'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-black text-cyan-700">BS</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-black text-slate-950">
                        {primaryDoctor ? `BS. ${primaryDoctor.fullName}` : 'Chưa phân công bác sĩ'}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {primaryDoctor?.specialty || department.specialty || 'Khám tổng quát'}
                      </p>
                    </div>
                    <span className="hidden rounded-xl border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-black text-cyan-700 sm:inline-flex">Sẵn sàng</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">
          Quay lại
        </button>
        <button onClick={handleCreateVisit} disabled={creating || !selectedDepartment} className="flex-1 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-60">
          {creating ? <LoadingIndicator size="sm" tone="white" /> : 'Xác nhận tạo lượt khám'}
        </button>
      </div>
    </div>
  );
}
