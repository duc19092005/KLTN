import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import VisitQueue from '../components/VisitQueue';
import { RECEPTIONIST_NAV_ITEMS, receptionistRouteFor } from '../constants/navigation';

export default function ReceptionistQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <DashboardLayout user={user} navItems={RECEPTIONIST_NAV_ITEMS} activeItem="visit-queue" onNavigate={(id) => navigate(receptionistRouteFor(id))} onLogout={logout}>
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-indigo-50 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.24em] mb-3">Live Visit Queue</p>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Hàng đợi khám</h1>
              <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">Theo dõi riêng danh sách bệnh nhân đã tạo lượt khám, trạng thái phòng khám và bác sĩ phụ trách.</p>
            </div>
            <button onClick={() => setRefreshKey((v) => v + 1)} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700">Làm mới hàng đợi</button>
          </div>
        </section>
        <VisitQueue refreshTrigger={refreshKey} />
      </div>
    </DashboardLayout>
  );
}
