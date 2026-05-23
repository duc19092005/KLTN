import { createContext, useState, useContext, useEffect } from 'react';

const ThemeLangContext = createContext();

export const useThemeLang = () => useContext(ThemeLangContext);

export const ThemeLangProvider = ({ children }) => {
  // Theme: 'dark' or 'light'
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  // Language: 'vi' or 'en'
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'vi');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleLang = () => setLang(prev => prev === 'vi' ? 'en' : 'vi');

  const value = {
    theme,
    toggleTheme,
    lang,
    toggleLang,
    // Basic translations
    t: (key) => translations[lang][key] || key
  };

  return (
    <ThemeLangContext.Provider value={value}>
      {children}
    </ThemeLangContext.Provider>
  );
};

const translations = {
  vi: {
    // Login page
    'login.title': 'Hệ thống quản lý bệnh viện',
    'login.subtitle': 'Đăng nhập bảo mật đa lớp với Zero-Knowledge Proof',
    'login.adminTab': 'Admin (Ví Web3)',
    'login.doctorTab': 'Bác sĩ',
    'login.username': 'Tên đăng nhập',
    'login.password': 'Mật khẩu',
    'login.btn': 'Đăng nhập',
    'login.forgotPassword': 'Quên mật khẩu?',
    'login.forgotPasswordMsg': 'Tính năng quên mật khẩu đang được phát triển.',

    // Admin wallet login
    'login.connectWallet': 'Kết nối ví',
    'login.connectWalletBtn': 'Kết nối MetaMask & Đăng nhập',
    'login.inviteCode': 'Mã mời (Lần đầu)',
    'login.walletDesc': 'Kết nối ví MetaMask để xác thực danh tính. Hệ thống sẽ kiểm tra ví trên blockchain trước khi cấp phiên đăng nhập.',
    'login.walletSteps': '1. Mở MetaMask → 2. Chọn ví đã đăng ký → 3. Ký xác nhận → 4. Quét khuôn mặt',
    'login.inviteDesc': 'Nếu đây là lần đầu tiên bạn đăng nhập, hãy nhập mã mời (invite token) đã được Super Admin gửi cho bạn.',
    'login.inviteLabel': 'Mã mời (Invite Token)',
    'login.inviteBtn': 'Xác nhận mã mời',
    'login.signing': 'Đang ký xác nhận...',
    'login.connecting': 'Đang kết nối ví...',
    'login.generatingSecret': 'Đang tạo mã bí mật...',
    'login.noMetamask': 'MetaMask chưa được cài đặt. Vui lòng cài extension MetaMask.',
    'login.walletRejected': 'Bạn đã từ chối ký xác nhận trong MetaMask.',
    'login.walletFailed': 'Đăng nhập bằng ví thất bại.',
    'login.securityBadge': 'Bảo mật bởi ZKP + Blockchain + Sinh trắc học',

    // Auth page
    'auth.layer2': 'Xác thực Lớp 2',
    'auth.layer2.subtitle': 'Bảo vệ quyền truy cập',
    'auth.recoverWallet': 'Khôi phục địa chỉ ví',
    'auth.wallet': 'Xác thực bằng Ví',
    'auth.face': 'Xác thực bằng Khuôn mặt',

    // Dashboard
    'dashboard.title': 'Hệ thống Quản lý Bệnh viện',
    'dashboard.tab.doctor': '👨‍⚕️ Quản lý bác sĩ',
    'dashboard.tab.diagnosis': '📋 Quản lý chuẩn đoán',
    'dashboard.tab.blockchain': '🔗 Giao dịch Blockchain',
    'dashboard.tab.ai': '🤖 Quản lý AI Model',
    'dashboard.action.recovery': '🔑 Khôi phục Ví',

    // Navbar
    'navbar.dashboard': '📊 Bảng điều khiển',
    'navbar.recovery': '🔑 Khôi phục',
    'navbar.logout': 'Đăng xuất',
  },
  en: {
    // Login page
    'login.title': 'Hospital Management System',
    'login.subtitle': 'Multi-layer secure login with Zero-Knowledge Proof',
    'login.adminTab': 'Admin (Web3 Wallet)',
    'login.doctorTab': 'Doctor',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.btn': 'Login',
    'login.forgotPassword': 'Forgot password?',
    'login.forgotPasswordMsg': 'Forgot password feature is under development.',

    // Admin wallet login
    'login.connectWallet': 'Connect Wallet',
    'login.connectWalletBtn': 'Connect MetaMask & Login',
    'login.inviteCode': 'Invite Code (First-time)',
    'login.walletDesc': 'Connect your MetaMask wallet to authenticate. The system verifies your wallet on the blockchain before granting access.',
    'login.walletSteps': '1. Open MetaMask → 2. Select registered wallet → 3. Sign verification → 4. Face scan',
    'login.inviteDesc': 'If this is your first time logging in, enter the invite token sent to you by the Super Admin.',
    'login.inviteLabel': 'Invite Token',
    'login.inviteBtn': 'Verify Invite Code',
    'login.signing': 'Signing verification...',
    'login.connecting': 'Connecting wallet...',
    'login.generatingSecret': 'Generating secret code...',
    'login.noMetamask': 'MetaMask not installed. Please install the MetaMask browser extension.',
    'login.walletRejected': 'You rejected the signing request in MetaMask.',
    'login.walletFailed': 'Wallet login failed.',
    'login.securityBadge': 'Secured by ZKP + Blockchain + Biometrics',

    // Auth page
    'auth.layer2': 'Layer 2 Authentication',
    'auth.layer2.subtitle': 'Protecting system access',
    'auth.recoverWallet': 'Recover Wallet Address',
    'auth.wallet': 'Verify with Wallet',
    'auth.face': 'Verify with Face',

    // Dashboard
    'dashboard.title': 'Hospital Management System',
    'dashboard.tab.doctor': '👨‍⚕️ Doctor Management',
    'dashboard.tab.diagnosis': '📋 Diagnosis Management',
    'dashboard.tab.blockchain': '🔗 Blockchain Transactions',
    'dashboard.tab.ai': '🤖 AI Model Management',
    'dashboard.action.recovery': '🔑 Wallet Recovery',

    // Navbar
    'navbar.dashboard': '📊 Dashboard',
    'navbar.recovery': '🔑 Recovery',
    'navbar.logout': 'Logout',
  }
};
