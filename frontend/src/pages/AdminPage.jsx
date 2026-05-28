import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';

const adminNavItems = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'identity', label: 'Định danh Admin', icon: 'shield' },
  { id: 'users', label: 'Tài khoản', icon: 'users' },
  { id: 'records', label: 'Hồ sơ xác thực', icon: 'file' },
  { id: 'audit', label: 'Audit log', icon: 'activity' },
  { id: 'settings', label: 'Cấu hình', icon: 'settings' },
];

const stats = [
  { label: 'Ví đã authorize', value: '01', trend: '+100%', trendUp: true },
  { label: 'Face template', value: 'Active', trend: 'MFA ready', trendUp: true },
  { label: 'ZKP identity', value: 'Issued', trend: 'Recovery saved', trendUp: true },
  { label: 'Risk score', value: 'Low', trend: '0 cảnh báo', trendUp: true },
];

const verificationSteps = [
  { title: 'Invite verified', detail: 'Admin được kích hoạt bằng token hợp lệ.', done: true },
  { title: 'Face liveness', detail: 'Đã lưu embedding sau kiểm tra sống thật.', done: true },
  { title: 'Wallet on-chain', detail: 'Địa chỉ ví được authorize trên IdentityRegistry.', done: true },
  { title: 'ZKP secret', detail: 'Định danh bảo mật đã được cấp cho admin.', done: true },
];

const auditEvents = [
  { time: '17:42', title: 'Wallet login accepted', meta: 'Signature verified + on-chain authorized' },
  { time: '17:41', title: 'Face verification passed', meta: 'Embedding distance below threshold' },
  { time: '17:39', title: 'IdentityRegistry synced', meta: 'Local Hardhat contract healthy' },
  { time: '17:36', title: 'Admin session refreshed', meta: 'JWT cookie validated' },
];

function shortenAddress(address = '') {
  if (!address) return 'Chưa kết nối';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <DashboardLayout user={user} navItems={adminNavItems} activeItem="overview" onLogout={logout}>
      {/* Bao bọc toàn bộ nội dung với nền xám nhạt để nổi bật các card trắng */}
      <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-slate-800">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* HERO SECTION */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex-1 space-y-4">
              <p className="text-sm font-semibold text-blue-600 tracking-wider uppercase">Zero-Knowledge Admin Workspace</p>
              <h2 className="text-3xl font-bold text-slate-900">Xin chào, {user?.username || 'Admin'}</h2>
              <p className="text-slate-500 max-w-2xl leading-relaxed">
                Bảng điều khiển theo dõi trạng thái định danh, ví blockchain và các hoạt động bảo mật của hệ thống xác thực Admin.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors" type="button">
                  Kiểm tra hệ thống
                </button>
                <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-medium transition-colors" type="button">
                  Xuất báo cáo
                </button>
              </div>
            </div>
            {/* MVP Orbit Card: Thiết kế lại tinh gọn hơn */}
            <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-4 border-blue-50 bg-blue-100 shrink-0">
              <div className="absolute inset-0 rounded-full border border-blue-200 animate-ping opacity-20"></div>
              <div className="text-center z-10">
                <div className="text-xl font-black text-blue-700">ZKP</div>
                <div className="text-xs font-medium text-blue-600 mt-1">Health 99.9%</div>
              </div>
            </div>
          </section>

          {/* STATS GRID */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((item) => (
              <article key={item.label} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <span className="text-sm font-medium text-slate-500">{item.label}</span>
                <strong className="block text-2xl font-bold text-slate-900 mt-2 mb-1">{item.value}</strong>
                <span className={`inline-flex items-center text-sm font-medium ${item.trendUp ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {item.trendUp && <span className="mr-1">↑</span>} {item.trend}
                </span>
              </article>
            ))}
          </section>

          {/* TWO COLUMNS: STATUS & AUDIT */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Identity Panel */}
            <article className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Identity stack</p>
                  <h3 className="text-lg font-bold text-slate-900">Trạng thái xác thực</h3>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                  Verified
                </span>
              </div>

              <div className="p-6 flex-1">
                <div className="bg-slate-50 rounded-lg p-4 mb-8 flex justify-between items-center border border-slate-100">
                  <span className="text-slate-600 font-medium">Wallet address</span>
                  <strong className="text-slate-900 font-mono" title={user?.walletAddress}>
                    {shortenAddress(user?.walletAddress)}
                  </strong>
                </div>

                <div className="space-y-6">
                  {verificationSteps.map((step, index) => (
                    <div key={step.title} className="relative flex gap-4">
                      {/* Line connecting dots */}
                      {index !== verificationSteps.length - 1 && (
                        <div className="absolute left-2 top-6 w-0.5 h-full bg-slate-200"></div>
                      )}
                      {/* Dot */}
                      <div className={`relative z-10 w-4 h-4 rounded-full mt-1 shrink-0 ${step.done ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'}`} />
                      <div>
                        <strong className="text-sm font-bold text-slate-900 block">{step.title}</strong>
                        <p className="text-sm text-slate-500 mt-1">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {/* Audit Panel */}
            <article className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Realtime audit</p>
                  <h3 className="text-lg font-bold text-slate-900">Hoạt động gần đây</h3>
                </div>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
                  Xem tất cả
                </button>
              </div>

              <div className="p-6 flex-1">
                <div className="space-y-6">
                  {auditEvents.map((event) => (
                    <div key={`${event.time}-${event.title}`} className="flex gap-4 group">
                      <time className="text-sm font-medium text-slate-400 w-12 pt-0.5 shrink-0">{event.time}</time>
                      <div className="border-l-2 border-slate-200 pl-4 group-hover:border-blue-400 transition-colors">
                        <strong className="text-sm font-bold text-slate-900 block">{event.title}</strong>
                        <p className="text-sm text-slate-500 mt-1">{event.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          {/* MODULE GRID */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xl mb-4">◈</div>
              <h3 className="font-bold text-slate-900 mb-2">Quản lý tài khoản</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Chuẩn bị cho phân quyền Admin, Doctor, Patient và các vai trò mở rộng.</p>
            </article>
            <article className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
              <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center text-xl mb-4">◎</div>
              <h3 className="font-bold text-slate-900 mb-2">Biometric policy</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Cấu hình ngưỡng face matching, liveness pose và chính sách đăng nhập.</p>
            </article>
            <article className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 cursor-pointer transition-all">
              <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center text-xl mb-4">✦</div>
              <h3 className="font-bold text-slate-900 mb-2">Blockchain registry</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Theo dõi ví đã authorize và đồng bộ trạng thái contract IdentityRegistry.</p>
            </article>
          </section>

        </div>
      </div>
    </DashboardLayout>
  );
}