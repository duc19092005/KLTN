import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { paraclinicalAuthService } from '../apis/paraclinicalService';
import FaceCapture from '../../auth/components/FaceCapture';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

export default function ParaclinicalLoginPage() {
  const { updateSession } = useAuth();
  const toast = useToast();
  const [phase, setPhase] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tempToken, setTempToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dynamically load Google Fonts and Material Symbols link as requested by UI design
  useEffect(() => {
    const link1 = document.createElement('link');
    link1.rel = 'stylesheet';
    link1.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
    document.head.appendChild(link1);

    const link2 = document.createElement('link');
    link2.rel = 'stylesheet';
    link2.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link2);

    return () => {
      document.head.removeChild(link1);
      document.head.removeChild(link2);
    };
  }, []);

  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await paraclinicalAuthService.login(username.trim(), password);
      setTempToken(res.data.tempToken);
      setPhase(2);
      toast.success('Xác thực mật khẩu thành công. Vui lòng quét khuôn mặt.');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceCapture = useCallback(async (embedding) => {
    setLoading(true);
    setError('');
    try {
      const res = await paraclinicalAuthService.verifyShiftFace(tempToken, embedding);
      toast.success(`Xin chào ${res.data.user?.staffName || 'KTV'}! Đăng nhập thành công.`);
      updateSession(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Xác thực khuôn mặt thất bại');
      setLoading(false);
    }
  }, [tempToken, toast, updateSession]);

  const handleFaceError = useCallback((msg) => {
    setError(msg);
  }, []);

  return (
    <div className="bg-[#f8f9ff] font-sans text-[#0b1c30] flex flex-col min-h-screen relative antialiased">
      {/* TopNavBar */}
      <header className="bg-white text-[#00346f] text-2xl font-semibold w-full px-10 h-16 border-b border-[#c2c6d3] flex justify-between items-center max-w-[1440px] mx-auto absolute top-0 left-0 right-0 z-50">
        <div className="text-xl font-bold text-[#00346f] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#00346f]" style={{ fontVariationSettings: "'FILL' 1" }}>
            medical_services
          </span>
          Med Identity OS
        </div>
        <nav className="hidden md:flex gap-6 items-center">
          <a className="text-[#424751] text-sm hover:text-[#00346f] transition-colors" href="#">Support Center</a>
          <a className="text-[#424751] text-sm hover:text-[#00346f] transition-colors" href="#">Staff Directory</a>
          <a className="text-[#424751] text-sm hover:text-[#00346f] transition-colors" href="#">Emergency Access</a>
        </nav>
        <button className="hidden md:flex items-center gap-2 text-[#00346f] text-xs font-semibold border border-[#c2c6d3] px-4 py-2 rounded hover:bg-slate-50 transition-colors">
          Contact IT Support
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow relative flex items-center justify-center min-h-screen pt-16 pb-16">
        {/* Background Image with blur-backdrop */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://lh3.googleusercontent.com/aida/AP1WRLsSC7Aea1GbDeIYOUkQs3QridL9h0zqY-TAzujGBooDLubULOzH6ca-6vg3dhOwedYT7DZBR3BGTlDyz-kTJcAnTTCnyoX7p1pNXk4D2O7PH4GWvNCu92tHV9IGuHUdKxCY0NgVvwhnHqnLMrPU2sA8e-MMdlSTcEB0JLp4ZmwwWohj_3BtvczEMBF9E_sik1101wjt8l6lM2kvSILf7D2vcygF9IqpQOgoErew-GxBDfGoyUNqUtmTyro5')",
            filter: 'blur(4px)',
          }}
        >
          <div className="absolute inset-0 bg-[#f8f9ff]/40 backdrop-blur-[8px]"></div>
        </div>

        {/* Login Card */}
        <div
          className="relative z-10 w-full max-w-md mx-4 md:mx-auto bg-white border border-[#c2c6d3] rounded-2xl overflow-hidden shadow-2xl"
          style={{ boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.08)' }}
        >
          {/* Header within card */}
          <div className="bg-[#f8f9ff] p-6 border-b border-[#c2c6d3] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[#e5eeff] flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#00346f] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                local_hospital
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#004a99] m-0">Hệ Thống Đăng Nhập CLS</h1>
            <p className="text-xs text-[#424751] mt-2">Dành cho Cán bộ Y tế & Kỹ thuật viên</p>
          </div>

          <div className="p-6 md:p-8">
            {/* Step Tabs */}
            <div className="flex border-b border-[#c2c6d3] mb-6">
              <button
                type="button"
                onClick={() => { if (phase === 2 && !loading) { setPhase(1); setError(''); } }}
                className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-all outline-none ${
                  phase === 1
                    ? 'text-[#00346f] border-[#00346f]'
                    : 'text-[#424751] border-transparent hover:text-[#00346f]'
                }`}
              >
                1. Mật khẩu
              </button>
              <button
                type="button"
                disabled={phase === 1}
                className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-all outline-none ${
                  phase === 2
                    ? 'text-[#00346f] border-[#00346f]'
                    : 'text-[#424751]/50 border-transparent cursor-not-allowed'
                }`}
              >
                2. Quét khuôn mặt
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 mb-5 text-xs font-bold text-red-700 text-center">
                {error}
              </div>
            )}

            {phase === 1 ? (
              <form onSubmit={handleCredentialSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#0b1c30]" htmlFor="machine_account">
                    Tài khoản phòng máy
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-[#737783] text-lg">
                      desktop_windows
                    </span>
                    <input
                      className="w-full pl-10 pr-4 py-3 border border-[#c2c6d3] rounded-xl bg-white text-sm focus:border-[#004a99] focus:ring-2 focus:ring-[#004a99]/10 transition-all outline-none placeholder-[#737783]/60"
                      id="machine_account"
                      name="machine_account"
                      placeholder="vd: mri_department"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#0b1c30]" htmlFor="password">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-[#737783] text-lg">
                      lock
                    </span>
                    <input
                      className="w-full pl-10 pr-4 py-3 border border-[#c2c6d3] rounded-xl bg-white text-sm focus:border-[#004a99] focus:ring-2 focus:ring-[#004a99]/10 transition-all outline-none placeholder-[#737783]/60"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  className="w-full bg-[#004a99] text-white py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#00346f] active:bg-[#001b3f] disabled:opacity-75 transition-colors mt-2"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <LoadingIndicator size="sm" tone="white" />
                  ) : (
                    <>
                      Xác thực tài khoản
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="text-center bg-[#e5eeff]/50 rounded-xl p-3.5 border border-[#c2c6d3]/40">
                  <p className="text-xs font-bold text-[#004a99] mb-1">Bước 2: Xác nhận danh tính KTV</p>
                  <p className="text-[11px] text-[#424751]">
                    Vui lòng hướng khuôn mặt vào camera để xác thực lịch trực hiện tại.
                  </p>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center py-10">
                    <LoadingIndicator size="lg" tone="blue" />
                    <p className="mt-4 text-xs font-bold text-[#004a99]">Đang đối chiếu dữ liệu khuôn mặt...</p>
                  </div>
                ) : (
                  <FaceCapture
                    onCapture={handleFaceCapture}
                    onError={handleFaceError}
                    captureMode="verify"
                    label="Đang so khớp khuôn mặt..."
                  />
                )}

                <button
                  type="button"
                  onClick={() => { setPhase(1); setTempToken(null); setError(''); }}
                  disabled={loading}
                  className="w-full rounded-xl border border-[#c2c6d3] py-2.5 text-xs font-bold text-[#424751] hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  ← Quay lại nhập mật khẩu
                </button>
              </div>
            )}
          </div>

          {/* Footer within card */}
          <div className="bg-[#e5eeff] p-4 border-t border-[#c2c6d3] flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[#00687a] text-lg">security</span>
            <span className="text-[11px] font-semibold text-[#424751]">
              Hệ thống bảo mật sinh trắc học • Xác thực ca trực CLS
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#eff4ff] text-[#424751] flex flex-col md:flex-row justify-between items-center w-full px-10 py-5 max-w-[1440px] mx-auto border-t border-[#c2c6d3] z-10 relative">
        <div className="text-xs font-medium text-[#0b1c30] mb-4 md:mb-0">
          © {new Date().getFullYear()} Clinical Laboratory Services. All rights reserved.
        </div>
        <nav className="flex gap-4 md:gap-6 items-center">
          <a className="text-xs font-medium hover:text-[#00346f] transition-colors" href="#">Security Policy</a>
          <a className="text-xs font-medium hover:text-[#00346f] transition-colors" href="#">HIPAA Compliance</a>
          <a className="text-xs font-medium hover:text-[#00346f] transition-colors" href="#">Version 4.2.0-stable</a>
        </nav>
      </footer>
    </div>
  );
}
