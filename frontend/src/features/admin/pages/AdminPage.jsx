import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';


function getStaffItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);

  const stats = useMemo(() => [
    { label: 'Phòng ban', value: departments.length, hint: 'Đơn vị chuyên môn', icon: '🏥' },
    { label: 'Nhân sự', value: staffs.length, hint: 'Hồ sơ nhân sự', icon: '👥' },
    { label: 'Đang hoạt động', value: staffs.filter((s) => s.user?.status === 'ACTIVE').length, hint: 'Tài khoản ACTIVE', icon: '✅' },
    { label: 'Ngưng hoạt động', value: staffs.filter((s) => s.user?.status === 'INACTIVE').length, hint: 'Tài khoản bị ẩn/khóa', icon: '⛔' },
  ], [departments, staffs]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [departmentRes, staffRes] = await Promise.all([departmentService.list(), staffService.search()]);
        setDepartments(Array.isArray(departmentRes.data) ? departmentRes.data : departmentRes.data?.items || []);
        setStaffs(getStaffItems(staffRes.data));
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || 'Không tải được thống kê');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="overview" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-8 shadow-sm">
          <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.24em] mb-3">System analytics</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Tổng quan hệ thống</h2>
          <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">
            Trang thống kê nhanh tình trạng phòng ban, nhân sự, tài khoản hoạt động và các hồ sơ đang chờ kích hoạt trong Hospital OS.
          </p>
        </section>

        {loading ? <LoadingIndicator size="lg" label="Đang tải thống kê..." /> : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((item) => <StatCard key={item.label} {...item} />)}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card title="Phòng ban gần đây" action="Quản lý" onAction={() => navigate('/admin/departments')}>
                <div className="space-y-3">
                  {departments.slice(0, 6).map((dep) => (
                    <div key={dep.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-950">{dep.name}</strong>
                        <span className="text-xs font-black text-blue-700">{dep.manager?.fullName || 'Chưa có phụ trách'}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{dep.description || 'Chưa có mô tả'}</p>
                    </div>
                  ))}
                  {!departments.length && <Empty title="Chưa có phòng ban" desc="Hãy tạo phòng ban để bắt đầu quản lý nhân sự." />}
                </div>
              </Card>

              <Card title="Nhân sự mới nhất" action="Quản lý" onAction={() => navigate('/admin/staff')}>
                <div className="space-y-3">
                  {staffs.slice(0, 6).map((staff) => <StaffMini key={staff.id} staff={staff} />)}
                  {!staffs.length && <Empty title="Chưa có nhân sự" desc="Hãy tạo hồ sơ nhân sự theo phòng ban." />}
                </div>
              </Card>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, hint, icon }) {
  return <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-xs font-bold text-slate-500">{label}</p><strong className="block text-3xl font-black text-slate-950 mt-2">{String(value).padStart(2, '0')}</strong></div><span className="text-2xl">{icon}</span></div><p className="mt-3 text-xs font-semibold text-blue-600">{hint}</p></article>;
}
function Card({ title, action, onAction, children }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-black text-slate-950">{title}</h3><button onClick={onAction} className="text-sm font-black text-blue-600">{action}</button></div>{children}</section>; }
function StaffMini({ staff }) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><strong className="block text-slate-950">{staff.fullName}</strong><span className="text-xs text-slate-500">{staff.department?.name || 'Chưa gán phòng ban'}</span></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }