import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import { useAuth } from '../../../providers/AuthProvider';
import VisitQueue from '../components/VisitQueue';
import { FRONTDESK_NAV_ITEMS, frontdeskRouteFor } from '../constants/frontdeskNavigation';
import { Clock, Plus, RefreshCw, Users } from 'lucide-react';

export default function ReceptionistQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <DashboardLayout
      user={user}
      navItems={FRONTDESK_NAV_ITEMS}
      activeItem="visit-queue"
      onNavigate={(id) => navigate(frontdeskRouteFor(id))}
      onLogout={logout}
    >
      <div className="max-w-[1600px] mx-auto space-y-6 antialiased pb-12">
        {/* HERO HEADER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <Users className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Lễ tân
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Điều phối khám bệnh</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Hàng đợi lượt khám
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRefreshKey((v) => v + 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Làm mới danh sách</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/receptionist/intake')}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tiếp nhận mới</span>
              </button>
            </div>
          </div>
        </section>

        {/* VISIT QUEUE COMPONENT */}
        <VisitQueue refreshTrigger={refreshKey} />
      </div>
    </DashboardLayout>
  );
}
