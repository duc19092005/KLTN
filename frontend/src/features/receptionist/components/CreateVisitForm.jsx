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
      const res = await visitService.create({
        patientId: patient.id,
        departmentId: selectedDepartment.id,
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
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[12px] font-bold text-slate-600">Đề xuất chuyên khoa / phòng khám</label>
          <form onSubmit={handleSearchSpecialty} className="mb-3 flex gap-2">
            <input
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              placeholder="Chuyên khoa, triệu chứng hoặc phòng khám..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
            />
            <button type="submit" disabled={loadingDepartments} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              {loadingDepartments ? <LoadingIndicator size="sm" /> : 'Lọc'}
            </button>
          </form>

          {departments.length === 0 && !loadingDepartments && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Không có phòng khám nào đang hoạt động hoặc phù hợp.
            </div>
          )}

          <div className="grid max-h-[240px] grid-cols-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
            {departments.map((department) => {
              const doctors = department.staffs || [];
              const primaryDoctor = doctors[0];
              const isSelected = selectedDepartment?.id === department.id;
              return (
                <button
                  type="button"
                  key={department.id}
                  onClick={() => setSelectedDepartment(department)}
                  className={`rounded-xl border p-3 text-left transition-colors ${isSelected ? 'border-cyan-400 bg-cyan-50 shadow-sm ring-1 ring-cyan-400' : 'border-slate-200 bg-white hover:border-cyan-300'}`}
                >
                  <p className={`text-sm font-black ${isSelected ? 'text-cyan-800' : 'text-slate-800'}`}>
                    {department.name} ({department.departmentCode || 'PK'})
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{department.specialty || 'Đa khoa'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-200">
                      {primaryDoctor?.avatarUrl ? (
                        <img src={primaryDoctor.avatarUrl} alt={primaryDoctor.fullName || 'Bác sĩ'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-500">BS</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-xs font-bold text-slate-700">
                        {primaryDoctor ? `BS. ${primaryDoctor.fullName}` : 'Chưa có bác sĩ'}
                      </p>
                      <p className="text-[10px] text-slate-500">{doctors.length} bác sĩ trong phòng</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100">
            Quay lại
          </button>
          <button onClick={handleCreateVisit} disabled={creating || !selectedDepartment} className="flex-1 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-md transition-colors hover:bg-cyan-700 disabled:opacity-60">
            {creating ? <LoadingIndicator size="sm" tone="white" /> : 'Xác nhận tạo lượt khám'}
          </button>
        </div>
      </div>
    </div>
  );
}
