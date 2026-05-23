import { useState } from 'react';
import { useThemeLang } from '../contexts/ThemeLangContext';
import { useAuth } from '../contexts/AuthContext';

const dict = {
  vi: {
    title: 'Cài đặt',
    navProfile: 'Hồ sơ', navSecurity: 'Bảo mật', navPreferences: 'Tùy chọn', navIntegrations: 'Tích hợp',
    profileTitle: 'Hồ sơ người dùng',
    labelName: 'Họ và tên', labelRole: 'Chức vụ', labelEmail: 'Địa chỉ Email', labelPhone: 'Số điện thoại',
    saveChanges: 'Lưu thay đổi', saved: 'Đã lưu!',
    secTitle: 'Bảo mật & Xác thực',
    mfaTitle: 'Xác thực 2 yếu tố', mfaDesc: 'Bảo vệ tài khoản với MFA bảo mật cao.', mfaEnabled: 'Đã bật', mfaManage: 'Quản lý MFA',
    apiTitle: 'API Keys', apiDesc: 'Quản lý token truy cập cho chẩn đoán tự động.', apiUsed: 'Dùng lần cuối: 2 giờ trước', apiRevoke: 'Thu hồi Key',
    sessionTitle: 'Phiên đăng nhập', sessionDesc: 'Quản lý các thiết bị đang đăng nhập.', sessionManage: 'Xem phiên',
    prefTitle: 'Tùy chọn hệ thống',
    themeLabel: 'Giao diện', themeDark: 'Tối', themeLight: 'Sáng',
    langLabel: 'Ngôn ngữ',
    notifLabel: 'Thông báo hệ thống', notifDesc: 'Nhận thông báo khi có sự kiện quan trọng.',
    intTitle: 'Tích hợp & Kết nối',
    blockchainLabel: 'Blockchain Node', blockchainDesc: 'Kết nối đến Ethereum / Hyperledger node.',
    blockchainStatus: 'Đang kết nối',
    aiLabel: 'AI Model API', aiDesc: 'Endpoint của máy chủ mô hình AI lâm sàng.',
    auditLabel: 'Hệ thống Kiểm toán', auditDesc: 'Tự động ghi nhật ký mọi hành động quản trị.',
    auditEnabled: 'Đang hoạt động',
  },
  en: {
    title: 'Settings',
    navProfile: 'Profile', navSecurity: 'Security', navPreferences: 'Preferences', navIntegrations: 'Integrations',
    profileTitle: 'User Profile',
    labelName: 'Full Name', labelRole: 'Role', labelEmail: 'Email Address', labelPhone: 'Phone Number',
    saveChanges: 'Save Changes', saved: 'Saved!',
    secTitle: 'Security & Authentication',
    mfaTitle: 'Two-Factor Auth', mfaDesc: 'Protect your account with high-security MFA.', mfaEnabled: 'Enabled', mfaManage: 'Manage MFA',
    apiTitle: 'API Keys', apiDesc: 'Manage access tokens for automated diagnostics.', apiUsed: 'Last used: 2h ago', apiRevoke: 'Revoke Keys',
    sessionTitle: 'Active Sessions', sessionDesc: 'Manage devices currently logged in.', sessionManage: 'View Sessions',
    prefTitle: 'System Preferences',
    themeLabel: 'Appearance', themeDark: 'Dark', themeLight: 'Light',
    langLabel: 'Language',
    notifLabel: 'System Notifications', notifDesc: 'Receive alerts for important system events.',
    intTitle: 'Integrations & Connections',
    blockchainLabel: 'Blockchain Node', blockchainDesc: 'Connect to Ethereum / Hyperledger node.',
    blockchainStatus: 'Connected',
    aiLabel: 'AI Model API', aiDesc: 'Endpoint for the clinical AI model server.',
    auditLabel: 'Audit System', auditDesc: 'Automatically log all administrative actions.',
    auditEnabled: 'Active',
  },
};

export default function SettingsView() {
  const { theme, toggleTheme, lang, toggleLang } = useThemeLang();
  const { user } = useAuth();
  const T = dict[lang] ?? dict.en;
  const isDark = theme === 'dark';

  const [activeSection, setActiveSection] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [notifOn, setNotifOn] = useState(true);
  const [auditOn, setAuditOn] = useState(true);
  const [formData, setFormData] = useState({
    name: user?.username || 'Admin',
    email: user?.email || 'admin@zkp.id',
    phone: '+84 900 000 000',
  });

  // ── theme tokens ──
  const bg       = isDark ? 'bg-[#091e42] border-white/5'   : 'bg-white border-slate-200';
  const bgInner  = isDark ? 'bg-[#051a3e] border-white/5'   : 'bg-slate-50 border-slate-200';
  const text     = isDark ? 'text-on-surface'                : 'text-slate-900';
  const muted    = isDark ? 'text-on-surface-variant'        : 'text-slate-500';
  const inputCls = isDark
    ? 'bg-[#001233] border-white/10 text-on-surface placeholder-white/30 focus:border-primary focus:ring-primary/30'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20';
  const divider  = isDark ? 'border-white/5' : 'border-slate-200';
  const accent   = isDark ? 'bg-primary-container text-on-primary-container hover:bg-primary-container/90'
                          : 'bg-blue-600 text-white hover:bg-blue-700';
  const ghostBtn = isDark
    ? 'border-white/15 text-on-surface hover:bg-white/5'
    : 'border-slate-300 text-slate-700 hover:bg-slate-100';

  const navItems = [
    { id: 'profile',      icon: 'person',    label: T.navProfile },
    { id: 'security',     icon: 'security',  label: T.navSecurity },
    { id: 'preferences',  icon: 'tune',      label: T.navPreferences },
    { id: 'integrations', icon: 'hub',       label: T.navIntegrations },
  ];

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // ── Toggle switch ──
  const Toggle = ({ on, onToggle }) => (
    <button
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? (isDark ? 'bg-primary' : 'bg-blue-600') : (isDark ? 'bg-white/20' : 'bg-slate-300')}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ── Inner Nav ── */}
      <nav className="col-span-12 md:col-span-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-all ${
                isActive
                  ? isDark
                    ? 'bg-[#091e42] border border-white/5 text-primary shadow-sm'
                    : 'bg-white border border-slate-200 text-blue-600 shadow-sm'
                  : isDark
                    ? 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? (isDark ? 'text-primary' : 'text-blue-600') : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ── Content Panel ── */}
      <div className="col-span-12 md:col-span-9 space-y-6">

        {/* ── PROFILE ── */}
        {activeSection === 'profile' && (
          <div className={`rounded-2xl border p-8 ${bg}`}>
            <h3 className={`text-lg font-semibold mb-6 ${text}`}>{T.profileTitle}</h3>
            <div className="flex items-start gap-8 flex-col sm:flex-row">
              {/* Avatar */}
              <div className="relative group cursor-pointer flex-shrink-0">
                <div className={`w-24 h-24 rounded-2xl border flex items-center justify-center text-4xl font-bold select-none ${isDark ? 'bg-primary-container text-on-primary-container border-white/10' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                  {formData.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                </div>
              </div>

              {/* Form */}
              <form className="flex-1 space-y-4 w-full" onSubmit={handleSave}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${muted}`}>{T.labelName}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${muted}`}>{T.labelRole}</label>
                    <input
                      type="text"
                      value="Admin"
                      disabled
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm cursor-not-allowed opacity-50 ${isDark ? 'bg-white/5 border-white/5 text-on-surface-variant' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${muted}`}>{T.labelEmail}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${inputCls}`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${muted}`}>{T.labelPhone}</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${inputCls}`}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  {saved && (
                    <span className={`mr-4 flex items-center gap-1.5 text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      {T.saved}
                    </span>
                  )}
                  <button type="submit" className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${accent}`}>
                    {T.saveChanges}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {activeSection === 'security' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* MFA */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between ${bg}`}>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`material-symbols-outlined ${isDark ? 'text-tertiary' : 'text-emerald-600'}`}>lock</span>
                    <h3 className={`text-base font-semibold ${text}`}>{T.mfaTitle}</h3>
                  </div>
                  <p className={`text-sm mb-4 ${muted}`}>{T.mfaDesc}</p>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold ${isDark ? 'bg-tertiary/10 text-tertiary' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-tertiary' : 'bg-emerald-500'}`} />
                    {T.mfaEnabled}
                  </span>
                </div>
                <button className={`mt-6 w-full border rounded-lg py-2 text-sm font-medium transition-colors ${ghostBtn}`}>
                  {T.mfaManage}
                </button>
              </div>

              {/* API Keys */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between ${bg}`}>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`material-symbols-outlined ${isDark ? 'text-secondary' : 'text-blue-500'}`}>key</span>
                    <h3 className={`text-base font-semibold ${text}`}>{T.apiTitle}</h3>
                  </div>
                  <p className={`text-sm mb-4 ${muted}`}>{T.apiDesc}</p>
                  <span className={`text-xs font-mono ${muted}`}>{T.apiUsed}</span>
                </div>
                <button className={`mt-6 w-full border rounded-lg py-2 text-sm font-medium transition-colors ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-600 hover:bg-red-50'}`}>
                  {T.apiRevoke}
                </button>
              </div>

              {/* Sessions */}
              <div className={`rounded-2xl border p-6 flex flex-col justify-between sm:col-span-2 ${bg}`}>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`material-symbols-outlined ${isDark ? 'text-primary' : 'text-blue-600'}`}>devices</span>
                    <h3 className={`text-base font-semibold ${text}`}>{T.sessionTitle}</h3>
                  </div>
                  <p className={`text-sm mb-4 ${muted}`}>{T.sessionDesc}</p>
                  {/* Mock session list */}
                  {[
                    { device: 'Chrome – Linux', ip: '127.0.0.1', time: lang === 'vi' ? 'Hiện tại' : 'Current', current: true },
                    { device: 'Firefox – Windows', ip: '192.168.1.5', time: lang === 'vi' ? '3 giờ trước' : '3h ago', current: false },
                  ].map((s, i) => (
                    <div key={i} className={`flex items-center justify-between py-3 border-b last:border-0 ${divider}`}>
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-[18px] ${s.current ? (isDark ? 'text-primary' : 'text-blue-600') : muted}`}>computer</span>
                        <div>
                          <div className={`text-sm font-medium ${text}`}>{s.device}</div>
                          <div className={`text-xs ${muted}`}>{s.ip} · {s.time}</div>
                        </div>
                      </div>
                      {!s.current && (
                        <button className={`text-xs px-3 py-1 rounded-lg border transition-colors ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-600 hover:bg-red-50'}`}>
                          {lang === 'vi' ? 'Đăng xuất' : 'Sign out'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PREFERENCES ── */}
        {activeSection === 'preferences' && (
          <div className={`rounded-2xl border p-8 space-y-6 ${bg}`}>
            <h3 className={`text-lg font-semibold ${text}`}>{T.prefTitle}</h3>

            {/* Appearance */}
            <div className={`flex items-center justify-between py-4 border-b ${divider}`}>
              <div>
                <div className={`text-sm font-semibold ${text}`}>{T.themeLabel}</div>
                <div className={`text-xs mt-0.5 ${muted}`}>{theme === 'dark' ? T.themeDark : T.themeLight}</div>
              </div>
              <button
                onClick={toggleTheme}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${ghostBtn}`}
              >
                <span className="material-symbols-outlined text-[18px]">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                {theme === 'dark' ? T.themeLight : T.themeDark}
              </button>
            </div>

            {/* Language */}
            <div className={`flex items-center justify-between py-4 border-b ${divider}`}>
              <div>
                <div className={`text-sm font-semibold ${text}`}>{T.langLabel}</div>
                <div className={`text-xs mt-0.5 ${muted}`}>{lang === 'vi' ? 'Tiếng Việt' : 'English'}</div>
              </div>
              <button
                onClick={toggleLang}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${ghostBtn}`}
              >
                <span className="material-symbols-outlined text-[18px]">language</span>
                {lang === 'vi' ? 'EN' : 'VI'}
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between py-4">
              <div>
                <div className={`text-sm font-semibold ${text}`}>{T.notifLabel}</div>
                <div className={`text-xs mt-0.5 ${muted}`}>{T.notifDesc}</div>
              </div>
              <Toggle on={notifOn} onToggle={() => setNotifOn(!notifOn)} />
            </div>
          </div>
        )}

        {/* ── INTEGRATIONS ── */}
        {activeSection === 'integrations' && (
          <div className={`rounded-2xl border p-8 space-y-5 ${bg}`}>
            <h3 className={`text-lg font-semibold mb-2 ${text}`}>{T.intTitle}</h3>

            {/* Blockchain */}
            <div className={`rounded-xl border p-5 ${bgInner}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#001233]' : 'bg-slate-100'}`}>
                    <span className={`material-symbols-outlined ${isDark ? 'text-primary' : 'text-blue-600'}`}>account_balance_wallet</span>
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${text}`}>{T.blockchainLabel}</div>
                    <div className={`text-xs mt-0.5 ${muted}`}>{T.blockchainDesc}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'} animate-pulse`} />
                  {T.blockchainStatus}
                </span>
              </div>
              <div className="mt-4">
                <input
                  readOnly
                  value="http://localhost:8545"
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-mono transition-all focus:outline-none ${isDark ? 'bg-[#001233] border-white/10 text-on-surface-variant' : 'bg-white border-slate-200 text-slate-600'}`}
                />
              </div>
            </div>

            {/* AI Model API */}
            <div className={`rounded-xl border p-5 ${bgInner}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#001233]' : 'bg-slate-100'}`}>
                  <span className={`material-symbols-outlined ${isDark ? 'text-secondary' : 'text-blue-500'}`}>smart_toy</span>
                </div>
                <div>
                  <div className={`text-sm font-semibold ${text}`}>{T.aiLabel}</div>
                  <div className={`text-xs mt-0.5 ${muted}`}>{T.aiDesc}</div>
                </div>
              </div>
              <input
                readOnly
                value="http://localhost:3001/api/ai-model"
                className={`w-full border rounded-lg px-3 py-2 text-xs font-mono ${isDark ? 'bg-[#001233] border-white/10 text-on-surface-variant' : 'bg-white border-slate-200 text-slate-600'}`}
              />
            </div>

            {/* Audit */}
            <div className={`rounded-xl border p-5 ${bgInner}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#001233]' : 'bg-slate-100'}`}>
                    <span className={`material-symbols-outlined ${isDark ? 'text-tertiary' : 'text-emerald-600'}`}>fact_check</span>
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${text}`}>{T.auditLabel}</div>
                    <div className={`text-xs mt-0.5 ${muted}`}>{T.auditDesc}</div>
                  </div>
                </div>
                <Toggle on={auditOn} onToggle={() => setAuditOn(!auditOn)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
