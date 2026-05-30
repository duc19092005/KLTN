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
      <div className="max-w-7xl mx-auto space-y-5">
        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.18em]">Hàng đợi</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Lượt khám</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/receptionist/intake')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700">+ Tiếp nhận</button>
              <button onClick={() => setRefreshKey((v) => v + 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">↻</button>
            </div>
          </div>
        </section>
        <VisitQueue refreshTrigger={refreshKey} />
      </div>
    </DashboardLayout>
  );
}
