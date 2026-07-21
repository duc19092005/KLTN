import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import VisitQueue from '../components/VisitQueue';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';

export default function ReceptionistQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <DashboardLayout user={user} navItems={FRONTDESK_NAV_ITEMS} activeItem="visit-queue" onNavigate={(id) => navigate(frontdeskRouteFor(id))} onLogout={logout}>
      <div className="max-w-[1600px] mx-auto space-y-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Hàng đợi</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Lượt khám</h1>
              <p className="mt-1 text-xs font-semibold text-slate-500">Theo dõi và điều phối bệnh nhân đang chờ khám.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate('/receptionist/intake')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700">Tiếp nhận</button>
              <button type="button" onClick={() => setRefreshKey((v) => v + 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Làm mới</button>
            </div>
          </div>
        </section>
        <VisitQueue refreshTrigger={refreshKey} />
      </div>
    </DashboardLayout>
  );
}
