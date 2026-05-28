import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';

const STATUS_MAP = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  WAITING_TEST_RESULT: { label: 'Chờ KQ XN', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-800 border-slate-200' },
};

export default function VisitQueue({ refreshTrigger }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await visitService.search({ limit: 20 });
      const data = res.data;
      setVisits(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error('Failed to load visits', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, [refreshTrigger]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="text-sm font-black text-slate-900">Hàng Đợi Lượt Khám</h3>
          <p className="text-[11px] text-slate-500 font-medium">Danh sách bệnh nhân đang xử lý</p>
        </div>
        <button onClick={loadVisits} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors" title="Làm mới">
          {loading ? <LoadingIndicator size="sm" /> : '↻'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visits.length === 0 && !loading && (
          <div className="text-center py-10 text-slate-400 text-sm">Chưa có lượt khám nào trong hàng đợi.</div>
        )}
        
        {visits.map(visit => {
          const patient = visit.patient;
          const room = visit.clinicalRoom;
          const doctor = visit.doctor?.staffProfile;
          const st = STATUS_MAP[visit.status] || STATUS_MAP.WAITING;

          return (
            <div key={visit.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-cyan-200 hover:shadow-md hover:shadow-cyan-50 transition-all flex flex-col gap-3 group">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{visit.visitCode}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 group-hover:text-cyan-700 transition-colors">{patient?.fullName}</h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {patient?.patientCode} · {patient?.gender === 'MALE' ? 'Nam' : patient?.gender === 'FEMALE' ? 'Nữ' : 'Khác'} · {patient?.birthDate ? new Date(patient.birthDate).getFullYear() : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold mb-1">
                    {new Date(visit.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="w-8 h-8 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center font-black text-xs shrink-0">
                  {room?.roomCode?.substring(0, 2) || 'RM'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-700 truncate">{room?.roomName}</p>
                  <p className="text-[10px] text-slate-500 truncate">BS. {doctor?.fullName || 'Chưa rõ'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
