import { useNavigate } from 'react-router-dom';
import { useThemeLang } from '../contexts/ThemeLangContext';

// --- ICONS ---
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const WalletIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" /><path d="M23 11a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z" /><circle cx="18" cy="12" r="1" />
  </svg>
);

const FaceIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" /><path d="M3 21v-1a9 9 0 0 1 18 0v1" /><path d="M9 11.5 11 13.5 15 9.5" />
  </svg>
);

const ZKPIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="12" rx="10" ry="4" /><path d="M2 12c0 4 4.5 8 10 8s10-4 10-8" /><path d="M2 12c0-4 4.5-8 10-8s10 4 10 8" />
  </svg>
);

const features = [
  {
    icon: <WalletIcon />,
    color: 'var(--brand-blue)',
    title: 'Web3 Wallet Auth',
    desc: 'Đăng nhập phi tập trung. Xác thực admin thông qua chữ ký MetaMask, verify trực tiếp trên Smart Contract.',
  },
  {
    icon: <FaceIcon />,
    color: 'var(--brand-teal)',
    title: 'Biometric Liveness',
    desc: 'Bảo mật thực thể sống với MediaPipe AI. Ngăn chặn triệt để các hình thức tấn công deepfake hay ảnh tĩnh.',
  },
  {
    icon: <ZKPIcon />,
    color: 'var(--brand-amber)',
    title: 'Zero-Knowledge Proof',
    desc: 'Xác minh danh tính nhưng không tiết lộ dữ liệu. Bằng chứng Groth16 được khởi tạo bảo mật ngay trên trình duyệt.',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeLang();
  const isDark = theme === 'dark';

  return (
    <div className={`landing-wrapper ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        /* --- DESIGN TOKENS --- */
        .theme-light {
          --bg-base: #ffffff;
          --bg-nav: rgba(255, 255, 255, 0.8);
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --border-color: rgba(0, 0, 0, 0.08);
          --card-bg: rgba(255, 255, 255, 0.6);
          --grid-color: rgba(0, 0, 0, 0.04);
          --brand-blue: #2563eb;
          --brand-teal: #0d9488;
          --brand-amber: #d97706;
          --btn-primary: linear-gradient(135deg, #2563eb, #4f46e5);
          --btn-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.3);
        }

        .theme-dark {
          --bg-base: #020617; /* Slate 950 */
          --bg-nav: rgba(2, 6, 23, 0.8);
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --border-color: rgba(255, 255, 255, 0.1);
          --card-bg: rgba(255, 255, 255, 0.03);
          --grid-color: rgba(255, 255, 255, 0.04);
          --brand-blue: #60a5fa;
          --brand-teal: #2dd4bf;
          --brand-amber: #fbbf24;
          --btn-primary: linear-gradient(135deg, #3b82f6, #6366f1);
          --btn-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4);
        }

        /* --- GLOBAL STYLES --- */
        .landing-wrapper {
          min-height: 100vh;
          background-color: var(--bg-base);
          color: var(--text-primary);
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          transition: background-color 0.4s ease, color 0.4s ease;
          position: relative;
        }

        /* Ambient Background Pattern */
        .ambient-grid {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-size: 40px 40px;
          background-image: radial-gradient(circle at center, var(--grid-color) 1px, transparent 1px);
          mask-image: linear-gradient(to bottom, white 10%, transparent 90%);
          -webkit-mask-image: linear-gradient(to bottom, white 10%, transparent 90%);
        }
        .ambient-glow {
          position: absolute; top: -10%; left: 50%; transform: translateX(-50%);
          width: 80vw; height: 60vh; z-index: 0; pointer-events: none;
          background: radial-gradient(ellipse, rgba(79, 70, 229, 0.15) 0%, transparent 60%);
          filter: blur(80px);
        }

        /* --- COMPONENTS --- */
        .glass-nav {
          position: fixed; top: 0; width: 100%; z-index: 50;
          height: 64px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 5%; background: var(--bg-nav);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-color);
        }

        .logo-box {
          display: flex; align-items: center; gap: 12px;
          font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em;
        }

        .pill-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px; border-radius: 99px;
          background: var(--card-bg); border: 1px solid var(--border-color);
          backdrop-filter: blur(8px); font-size: 0.85rem; font-weight: 600;
          margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .text-gradient {
          background: linear-gradient(to right, #3b82f6, #2dd4bf);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .btn-primary {
          padding: 12px 28px; border-radius: 12px; border: none;
          background: var(--btn-primary); color: #fff;
          font-size: 0.95rem; font-weight: 600; cursor: pointer;
          box-shadow: var(--btn-shadow);
          transition: transform 0.2s, box-shadow 0.2s, filter 0.2s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }

        .btn-secondary {
          padding: 12px 28px; border-radius: 12px; cursor: pointer;
          background: transparent; color: var(--text-primary);
          border: 1px solid var(--border-color);
          font-size: 0.95rem; font-weight: 600; transition: all 0.2s;
        }
        .btn-secondary:hover { background: var(--card-bg); }

        /* Feature Cards */
        .feat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        
        .feat-card {
          padding: 32px; border-radius: 20px;
          background: var(--card-bg); border: 1px solid var(--border-color);
          backdrop-filter: blur(10px);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s;
        }
        .feat-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
          border-color: var(--brand-blue);
        }
        .feat-icon-wrapper {
          width: 56px; height: 56px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 24px; background: var(--bg-base);
          border: 1px solid var(--border-color);
        }

        /* Animations */
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-up { animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .delay-1 { animation-delay: 0.1s; } .delay-2 { animation-delay: 0.2s; } .delay-3 { animation-delay: 0.3s; }
      `}</style>

      {/* BACKGROUND FX */}
      <div className="ambient-grid" />
      <div className="ambient-glow" />

      {/* NAVBAR */}
      <nav className="glass-nav">
        <div className="logo-box">
          <div style={{ background: 'var(--brand-blue)', color: '#fff', padding: '6px', borderRadius: '10px' }}>
            <ShieldIcon viewBox="0 0 24 24" width="20" height="20" />
          </div>
          <span>ZKP Identity</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
            {isDark
              ? <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
              : <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            }
          </button>
          <button className="btn-primary" onClick={() => navigate('/login')} style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
            Đăng nhập
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={{ position: 'relative', zIndex: 10, paddingTop: '160px', paddingBottom: '100px', textAlign: 'center', paddingX: '5%' }}>
        <div className="animate-up">
          <div className="pill-badge">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-blue)', boxShadow: '0 0 10px var(--brand-blue)' }} />
            Hệ thống bảo mật y tế đa lớp
          </div>
        </div>

        <h1 className="animate-up delay-1" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: '800px', margin: '0 auto 24px' }}>
          Bảo mật Danh tính <br />
          <span className="text-gradient">Không Tiết Lộ</span> Dữ liệu
        </h1>

        <p className="animate-up delay-2" style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Hệ thống xác thực 3 lớp tích hợp <strong>Zero-Knowledge Proofs</strong>, <strong>Sinh trắc học Liveness</strong> và kiến trúc <strong>Blockchain</strong> dành cho quản trị bệnh viện.
        </p>

        <div className="animate-up delay-3" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => navigate('/login')}>
            Truy cập Hệ thống
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
          <button className="btn-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
            Tìm hiểu kiến trúc
          </button>
        </div>
      </section>

      {/* FEATURES BENTO GRID */}
      <section id="features" style={{ position: 'relative', zIndex: 10, padding: '80px 5%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '16px' }}>
            Kiến trúc Bảo mật Đa lớp
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>Mỗi lớp bảo vệ độc lập, kết hợp tạo nên hàng rào bảo mật không thể vượt qua.</p>
        </div>

        <div className="feat-grid">
          {features.map((f, i) => (
            <div key={i} className="feat-card animate-up" style={{ animationDelay: `${0.1 * i}s` }}>
              <div className="feat-icon-wrapper" style={{ color: f.color }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TECH STACK SECTION */}
      <section style={{ padding: '80px 5%', maxWidth: '900px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '32px' }}>
          Được xây dựng trên các công nghệ lõi
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
          {['Circom & SnarkJS', 'Groth16 ZKP', 'Solidity', 'Hardhat', 'Ethers.js', 'MediaPipe AI', 'NestJS', 'PostgreSQL', 'React'].map((tech) => (
            <div key={tech} style={{
              padding: '10px 20px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
              background: 'var(--card-bg)', border: '1px solid var(--border-color)', backdropFilter: 'blur(4px)'
            }}>
              {tech}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section style={{ padding: '100px 5%', textAlign: 'center', position: 'relative', zIndex: 10, borderTop: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '24px' }}>
          Sẵn sàng bảo vệ hệ thống?
        </h2>
        <button className="btn-primary" onClick={() => navigate('/login')}>
          Bắt đầu Xác thực Danh tính
        </button>
      </section>

      {/* FOOTER METADATA */}
      <footer style={{ padding: '32px 5%', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', position: 'relative', zIndex: 10 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>ZKP Identity</span>
        <span>© 2026 Hệ thống KLTN.</span>
      </footer>
    </div>
  );
}