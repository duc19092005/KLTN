import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLang } from '../contexts/ThemeLangContext';
import CreateDoctorModal from '../components/CreateDoctorModal';
import CreateAiModelModal from '../components/CreateAiModelModal';
import ManageAiModelModal from '../components/ManageAiModelModal';
import ViewAiModelDetailsModal from '../components/ViewAiModelDetailsModal';
import EditAiModelModal from '../components/EditAiModelModal';
import BackupDashboardView from '../components/BackupDashboardView';
import SupportView from '../components/SupportView';
import SettingsView from '../components/SettingsView';
import api from '../services/api';

const ADMIN_NAV = [
  { id: 'doctor',     icon: 'medical_services',      labelKey: 'tabDoctor' },
  { id: 'diagnosis',  icon: 'healing',               labelKey: 'tabDiagnosis' },
  { id: 'blockchain', icon: 'account_balance_wallet', labelKey: 'tabBlockchain' },
  { id: 'ai',         icon: 'smart_toy',             labelKey: 'tabAi' },
  { id: 'backup',     icon: 'backup',                labelKey: 'tabBackup' },
];

const dict = {
  vi: {
    title: "ZKP Identity",
    subtitle: "Hệ thống AI Lâm sàng",
    newAudit: "Kiểm toán Hệ thống",
    newDoctor: "Thêm Bác sĩ",
    newAi: "Thêm Model AI",
    
    tabDoctor: "Quản lý Bác sĩ",
    tabDiagnosis: "Quản lý chuẩn đoán",
    tabBlockchain: "Giao dịch Blockchain",
    tabAi: "Quản lý AI Model",
    tabBackup: "Sao lưu & Phục hồi",
    
    settings: "Cài đặt",
    settingsTab: "Cài đặt Hệ thống",
    support: "Hỗ trợ",
    supportTab: "Hỗ trợ & Trợ giúp",
    logout: "Đăng xuất",
    
    headerModels: "Mô hình AI",
    headerBlockchain: "Blockchain",
    headerAudits: "Kiểm toán",
    
    emptyTitle: "Chưa có dữ liệu",
    emptyDesc: "Chưa có dữ liệu. Hãy bắt đầu bằng cách thêm dữ liệu mới.",
    
    // Columns
    colModelId: "Mã Model",
    colModelName: "Tên Hệ Thống AI",
    colVersion: "Phiên Bản",
    colSpecialty: "Chuyên Khoa Đề Xuất",
    colBlockchain: "Blockchain",
    colTxHash: "Mã Giao Dịch (TX Hash)",
    colActions: "Thao tác",
    
    colDoctorId: "Mã Bác Sĩ",
    colDoctorName: "Họ và Tên",
    colDoctorSpecialty: "Chuyên Khoa",
    colDoctorPosition: "Chức Vụ",
    colStatus: "Trạng Thái",
    
    colDiagId: "Mã Bệnh Án",
    colPatient: "Bệnh Nhân",
    colDisease: "Bệnh Lý",
    colTreatment: "Điều Trị",
    colDoctorInCharge: "Bác Sĩ Phụ Trách",
    
    colTxId: "Tx ID",
    colTxAction: "Hành Động",
    colTxTime: "Ngày Giờ",
    colTxStatus: "Trạng Thái Mạng",
    
    loading: "Đang tải dữ liệu..."
  },
  en: {
    title: "ZKP Identity",
    subtitle: "Clinical AI Systems",
    newAudit: "New System Audit",
    newDoctor: "Add Doctor",
    newAi: "Add AI Model",
    
    tabDoctor: "Doctor Management",
    tabDiagnosis: "Diagnosis Management",
    tabBlockchain: "Blockchain Transactions",
    tabAi: "AI Model Management",
    tabBackup: "Backup & Recovery",
    
    settings: "Settings",
    settingsTab: "System Settings",
    support: "Support",
    supportTab: "Support & Help",
    logout: "Logout",
    
    headerModels: "Models",
    headerBlockchain: "Blockchain",
    headerAudits: "Audits",
    
    emptyTitle: "No data available",
    emptyDesc: "No data available. Start by adding new data.",
    
    // Columns
    colModelId: "Model ID",
    colModelName: "AI System Name",
    colVersion: "Version",
    colSpecialty: "Recommended Specialty",
    colBlockchain: "Blockchain",
    colTxHash: "TX Hash",
    colActions: "Actions",
    
    colDoctorId: "Doctor ID",
    colDoctorName: "Full Name",
    colDoctorSpecialty: "Specialty",
    colDoctorPosition: "Position",
    colStatus: "Status",
    
    colDiagId: "Diagnosis ID",
    colPatient: "Patient",
    colDisease: "Disease",
    colTreatment: "Treatment",
    colDoctorInCharge: "Doctor in Charge",
    
    colTxId: "Tx ID",
    colTxAction: "Action",
    colTxTime: "Timestamp",
    colTxStatus: "Network Status",
    
    loading: "Loading hospital data..."
  }
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, lang, toggleLang } = useThemeLang();

  const [activeTab, setActiveTab] = useState('doctor');
  const [data, setData] = useState({ doctors: [], diagnoses: [], transactions: [], aimodels: [], backups: { full: [], wal: [] } });
  const [loading, setLoading] = useState(true);
  const [showCreateDoctor, setShowCreateDoctor] = useState(false);
  const [showCreateAiModel, setShowCreateAiModel] = useState(false);
  const [showManageAiModel, setShowManageAiModel] = useState(false);
  const [manageAction, setManageAction] = useState('edit');
  const [selectedManageModel, setSelectedManageModel] = useState(null);
  const [showViewAiModel, setShowViewAiModel] = useState(false);
  const [showEditAiModel, setShowEditAiModel] = useState(false);
  const [selectedAiModelId, setSelectedAiModelId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { loadHospitalData(); }, []);

  const loadHospitalData = async () => {
    try {
      const [docRes, diagRes, txRes, aiRes, backupRes] = await Promise.all([
        api.get('/hospital/doctors'),
        api.get('/hospital/diagnoses'),
        api.get('/hospital/transactions'),
        api.get('/ai-model/list'),
        api.get('/backup/list').catch(() => ({ data: { full: [], wal: [] } })),
      ]);
      setData({
        doctors:      docRes.data,
        diagnoses:    diagRes.data,
        transactions: txRes.data,
        aimodels:     aiRes.data,
        backups:      backupRes.data,
      });
    } catch (err) {
      console.error('Failed to load hospital data:', err);
    } finally {
      setLoading(false);
    }
  };

  const tLocal = (key) => dict[lang]?.[key] || key;

  const countLabel = {
    doctor: lang === 'vi' 
      ? `${data.doctors.length} bác sĩ trong hệ thống` 
      : `${data.doctors.length} doctors in system`,
    diagnosis: lang === 'vi' 
      ? `${data.diagnoses.length} chuẩn đoán được ghi nhận` 
      : `${data.diagnoses.length} diagnoses recorded`,
    blockchain: lang === 'vi' 
      ? `${data.transactions.length} giao dịch trên blockchain` 
      : `${data.transactions.length} transactions on blockchain`,
    ai: lang === 'vi' 
      ? `${data.aimodels.length} mô hình AI đang quản lý` 
      : `${data.aimodels.length} AI models managed`,
    backup: lang === 'vi' 
      ? `Hệ thống sao lưu & khôi phục dữ liệu thời gian thực (RPO ~ 0)` 
      : `Real-time database backup & recovery system (RPO ~ 0)`,
    support: lang === 'vi'
      ? 'Truy cập tài liệu, khắc phục sự cố và hỗ trợ lâm sàng.'
      : 'Access documentation, troubleshooting, and clinical support.',
    settings: lang === 'vi'
      ? 'Quản lý hồ sơ, bảo mật, tùy chọn và tích hợp hệ thống.'
      : 'Manage profile, security, preferences and system integrations.',
  };

  const isEmpty = activeTab !== 'backup' && activeTab !== 'support' && activeTab !== 'settings' && (
                  (activeTab === 'doctor' && data.doctors.length === 0) ||
                  (activeTab === 'diagnosis' && data.diagnoses.length === 0) ||
                  (activeTab === 'blockchain' && data.transactions.length === 0) ||
                  (activeTab === 'ai' && data.aimodels.length === 0)
                  );

  const getEmptyStateIcon = () => {
    if (activeTab === 'doctor') return 'medical_services';
    if (activeTab === 'diagnosis') return 'healing';
    if (activeTab === 'blockchain') return 'account_balance_wallet';
    return 'smart_toy';
  };

  const handlePrimaryAction = () => {
    if (activeTab === 'doctor') {
      setShowCreateDoctor(true);
    } else if (activeTab === 'ai') {
      setShowCreateAiModel(true);
    } else {
      alert(lang === 'vi' ? 'Tính năng Kiểm toán Hệ thống đang được phát triển.' : 'System Audit feature is under development.');
    }
  };

  const getPrimaryActionLabel = () => {
    if (activeTab === 'doctor') return tLocal('newDoctor');
    if (activeTab === 'ai') return tLocal('newAi');
    return tLocal('newAudit');
  };

  const tableContent = activeTab === 'settings' ? (
    <SettingsView />
  ) : activeTab === 'support' ? (
    <SupportView />
  ) : activeTab === 'backup' ? (
    <BackupDashboardView
      data={data.backups}
      onRefresh={loadHospitalData}
    />
  ) : (
    <div className={`border rounded-xl overflow-hidden shadow-lg ${theme === 'dark' ? 'bg-surface-container-low border-white/5 shadow-black/20' : 'bg-white border-slate-200 shadow-slate-100'}`}>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${theme === 'dark' ? 'bg-surface-variant border-outline-variant/20' : 'bg-slate-100 border-slate-200'}`}>
            <span className={`material-symbols-outlined text-4xl ${theme === 'dark' ? 'text-on-surface-variant opacity-60' : 'text-slate-400'}`}>
              {getEmptyStateIcon()}
            </span>
          </div>
          <h3 className={`font-headline-md text-headline-md mb-2 ${theme === 'dark' ? 'text-on-surface' : 'text-slate-800'}`}>
            {tLocal('emptyTitle')}
          </h3>
          <p className={`font-body-md text-body-md max-w-md ${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'}`}>
            {tLocal('emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className={`border-b ${theme === 'dark' ? 'bg-surface-container-lowest border-outline-variant/10 text-on-surface-variant' : 'bg-slate-50 border-slate-200 text-slate-500'} font-label-md text-label-md uppercase tracking-wider`}>
              {activeTab === 'doctor' && (
                <tr>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDoctorId')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDoctorName')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDoctorSpecialty')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDoctorPosition')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colStatus')}</th>
                </tr>
              )}
              {activeTab === 'diagnosis' && (
                <tr>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDiagId')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colPatient')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDisease')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTreatment')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDoctorInCharge')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colStatus')}</th>
                </tr>
              )}
              {activeTab === 'blockchain' && (
                <tr>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTxId')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTxHash')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTxAction')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTxTime')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTxStatus')}</th>
                </tr>
              )}
              {activeTab === 'ai' && (
                <tr>
                  <th className="p-4 text-xs font-semibold">{tLocal('colModelId')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colModelName')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colVersion')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colSpecialty')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colBlockchain')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTxHash')}</th>
                  <th className="p-4 text-xs font-semibold text-right">{tLocal('colActions')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {activeTab === 'doctor' && data.doctors.map((d) => (
                <tr key={d.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">#{formatShortId(d.id)}</td>
                  <td className="p-4 text-sm align-middle font-semibold">{getDoctorName(d)}</td>
                  <td className="p-4 text-sm align-middle text-primary">{d.specialties || d.specialty || 'Chưa cập nhật'}</td>
                  <td className="p-4 text-sm align-middle">{d.position || 'Chưa cập nhật'}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getDoctorStatus(d) === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {getDoctorStatus(d)}
                    </span>
                  </td>
                </tr>
              ))}

              {activeTab === 'diagnosis' && data.diagnoses.map((d) => (
                <tr key={d.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">#{formatShortId(d.id)}</td>
                  <td className="p-4 text-sm align-middle font-semibold">{d.patientName}</td>
                  <td className="p-4 text-sm align-middle text-info">{d.disease}</td>
                  <td className="p-4 text-sm align-middle">{d.treatment}</td>
                  <td className="p-4 text-sm align-middle text-primary">{d.doctor?.doctorName || d.doctor?.name || 'Chưa cập nhật'}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}

              {activeTab === 'blockchain' && data.transactions.map((tx) => (
                <tr key={tx.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">#{formatShortId(tx.id)}</td>
                  <td className="p-4 text-sm align-middle font-mono text-xs opacity-60">{formatHash(tx.txHash || tx.transactionId)}</td>
                  <td className="p-4 text-sm align-middle font-semibold">{tx.action || 'Đăng ký dữ liệu'}</td>
                  <td className="p-4 text-sm align-middle">{formatDateTime(tx.timestamp || tx.confirmTime)}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getTransactionStatus(tx) === 'CONFIRMED' || getTransactionStatus(tx) === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {getTransactionStatus(tx)}
                    </span>
                  </td>
                </tr>
              ))}

              {activeTab === 'ai' && data.aimodels.map((m) => (
                <tr key={m.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">{m.modelId || formatShortId(m.id)}</td>
                  <td className="p-4 text-sm align-middle font-semibold text-info">{m.name || m.modelName}</td>
                  <td className="p-4 text-sm align-middle font-mono text-xs">{m.modelVersion || m.version || 'Chưa cập nhật'}</td>
                  <td className="p-4 text-sm align-middle">{m.recommendedSpecialty || 'Chưa cập nhật'}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getAiModelStatus(m) === 'ON_CHAIN' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {getAiModelStatus(m)}
                    </span>
                  </td>
                  <td className="p-4 text-sm align-middle font-mono text-xs opacity-60">{formatHash(m.blockchainTxHash)}</td>
                  <td className="p-4 text-sm align-middle text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAiModelId(m.modelId);
                        setShowViewAiModel(true);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      Chi tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAiModelId(m.modelId);
                        setShowEditAiModel(true);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
                    >
                      Chỉnh sửa
                    </button>
                    {getAiModelStatus(m) === 'ON_CHAIN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedManageModel(m);
                          setManageAction('deactivate');
                          setShowManageAiModel(true);
                        }}
                        className="px-2.5 py-1 text-xs font-medium rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                      >
                        Vô hiệu hóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-[#001233] text-[#d8e2ff]' : 'bg-slate-50 text-slate-800'}`}>
        <div className="text-center">
          <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4 ${theme === 'dark' ? 'border-primary' : 'border-blue-600'}`}></div>
          <div className="text-lg font-semibold">{tLocal('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`antialiased min-h-screen flex font-body-md text-body-md transition-colors duration-200 ${theme === 'dark' ? 'bg-[#001233] text-[#d8e2ff] dark' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* ── SideNavBar ── */}
      <nav className={`fixed left-0 top-0 h-full w-[260px] border-r flex flex-col z-40 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${theme === 'dark' ? 'bg-surface-container border-outline-variant/10' : 'bg-white border-slate-200'}`}>
        <div className="p-6 relative">
          <h1 className={`font-headline-md text-headline-md font-bold ${theme === 'dark' ? 'text-on-surface' : 'text-slate-900'}`}>{tLocal('title')}</h1>
          <p className={`${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'} font-label-md text-label-md mt-1`}>{tLocal('subtitle')}</p>
          
          {/* Close button for mobile */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-6 right-6 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Action Button inside Sidebar */}
        <div className="px-4 mb-6">
          <button 
            onClick={handlePrimaryAction}
            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-label-md text-label-md transition-colors shadow-sm ${theme === 'dark' ? 'bg-primary-container text-on-primary-container hover:bg-primary-container/90' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            <span className="material-symbols-outlined">add</span>
            {getPrimaryActionLabel()}
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-2">
          {ADMIN_NAV.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 text-left font-medium ${
                  isActive 
                    ? theme === 'dark'
                      ? 'bg-secondary-container/10 text-secondary border-l-4 border-secondary opacity-90'
                      : 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : theme === 'dark'
                      ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{tLocal(item.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer with user metadata */}
        <div className={`mt-auto border-t p-2 flex flex-col gap-1 ${theme === 'dark' ? 'border-outline-variant/10' : 'border-slate-200'}`}>
          <a 
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
              activeTab === 'settings'
                ? theme === 'dark'
                  ? 'bg-secondary-container/10 text-secondary border-l-4 border-secondary opacity-90'
                  : 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                : theme === 'dark'
                  ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span>{tLocal('settings')}</span>
          </a>
          <a 
            onClick={() => { setActiveTab('support'); setSidebarOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
              activeTab === 'support'
                ? theme === 'dark'
                  ? 'bg-secondary-container/10 text-secondary border-l-4 border-secondary opacity-90'
                  : 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                : theme === 'dark'
                  ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined">help</span>
            <span>{tLocal('support')}</span>
          </a>
          
          <div className="px-4 py-3 flex items-center gap-3 mt-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${theme === 'dark' ? 'bg-primary-container text-on-primary-container' : 'bg-blue-100 text-blue-700'}`}>
              {user?.username ? user.username.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-on-surface' : 'text-slate-800'}`}>
                {user?.username || 'Admin'}
              </span>
              <span className={`text-xs truncate ${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'}`}>
                {user?.email || 'admin@zkp.id'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col lg:ml-[260px] min-h-screen relative">
        
        {/* ── TopNavBar ── */}
        <header className={`sticky top-0 z-20 flex justify-between items-center h-16 px-4 md:px-8 border-b backdrop-blur-md transition-colors ${theme === 'dark' ? 'bg-[#001233]/85 border-outline-variant/10' : 'bg-white/85 border-slate-200'}`}>
          <div className="flex items-center">
            {/* Mobile menu trigger */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-full mr-2 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            <nav className="hidden md:flex items-center gap-6 font-label-md text-label-md">
              <a 
                onClick={() => setActiveTab('ai')}
                className={`cursor-pointer pb-1 transition-all ${
                  activeTab === 'ai'
                    ? theme === 'dark'
                      ? 'text-primary font-bold border-b-2 border-primary'
                      : 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : theme === 'dark'
                      ? 'text-on-surface-variant hover:text-on-surface'
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tLocal('headerModels')}
              </a>
              <a 
                onClick={() => setActiveTab('blockchain')}
                className={`cursor-pointer pb-1 transition-all ${
                  activeTab === 'blockchain'
                    ? theme === 'dark'
                      ? 'text-primary font-bold border-b-2 border-primary'
                      : 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : theme === 'dark'
                      ? 'text-on-surface-variant hover:text-on-surface'
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tLocal('headerBlockchain')}
              </a>
              <a 
                onClick={() => setActiveTab('doctor')}
                className={`cursor-pointer pb-1 transition-all ${
                  activeTab === 'doctor'
                    ? theme === 'dark'
                      ? 'text-primary font-bold border-b-2 border-primary'
                      : 'text-blue-600 font-bold border-b-2 border-blue-600'
                    : theme === 'dark'
                      ? 'text-on-surface-variant hover:text-on-surface'
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tLocal('tabDoctor')}
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Translation Button */}
            <button 
              onClick={toggleLang} 
              className={`p-2 rounded-full flex items-center justify-center gap-1 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}
              title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              <span className="material-symbols-outlined text-xl">language</span>
              <span className="text-xs font-bold font-mono">{lang === 'vi' ? 'VI' : 'EN'}</span>
            </button>

            {/* Darkmode / Lightmode Button */}
            <button 
              onClick={toggleTheme} 
              className={`p-2 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}
              title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              <span className="material-symbols-outlined text-xl">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}>
              <span className="material-symbols-outlined text-xl">notifications</span>
            </button>
            
            <button className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}>
              <span className="material-symbols-outlined text-xl">history</span>
            </button>

            <div className={`h-6 w-px mx-1 md:mx-2 ${theme === 'dark' ? 'bg-outline-variant/30' : 'bg-slate-200'}`}></div>

            <button 
              onClick={logout}
              className={`font-label-md text-label-md transition-colors ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {tLocal('logout')}
            </button>
          </div>
        </header>

        {/* ── Canvas / Page Content ── */}
        <main className="flex-1 p-6 md:p-8 bg-transparent">
          
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className={`font-headline-lg text-headline-lg font-bold ${theme === 'dark' ? 'text-on-background' : 'text-slate-900'}`}>
                {activeTab === 'support'
                  ? tLocal('supportTab')
                  : activeTab === 'settings'
                    ? tLocal('settingsTab')
                    : tLocal(ADMIN_NAV.find((i) => i.id === activeTab)?.labelKey)}
              </h2>
              <p className={`font-body-md text-body-md mt-1 ${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'}`}>
                {countLabel[activeTab]}
              </p>
            </div>

            {/* Action buttons on Page Header */}
            {activeTab === 'doctor' && (
              <button 
                onClick={() => setShowCreateDoctor(true)}
                className={`px-6 py-2.5 rounded-lg flex items-center gap-2 font-label-md text-label-md transition-colors shadow-sm ${theme === 'dark' ? 'bg-primary text-on-primary hover:bg-primary/90' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                <span className="material-symbols-outlined">add</span>
                {tLocal('newDoctor')}
              </button>
            )}

            {activeTab === 'ai' && (
              <button 
                onClick={() => setShowCreateAiModel(true)}
                className={`px-6 py-2.5 rounded-lg flex items-center gap-2 font-label-md text-label-md transition-colors shadow-sm ${theme === 'dark' ? 'bg-primary text-on-primary hover:bg-primary/90' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                <span className="material-symbols-outlined">add</span>
                {tLocal('newAi')}
              </button>
            )}
          </div>

          {/* Table or Backup content */}
          {tableContent}
        </main>
      </div>

      {/* ── Create Doctor Modal ── */}
      <CreateDoctorModal
        open={showCreateDoctor}
        onClose={() => setShowCreateDoctor(false)}
        onSuccess={async () => {
          await loadHospitalData();
          setShowCreateDoctor(false);
        }}
      />

      {/* ── Create AI Model Modal ── */}
      <CreateAiModelModal
        open={showCreateAiModel}
        onClose={() => setShowCreateAiModel(false)}
        onSuccess={async () => {
          await loadHospitalData();
          setShowCreateAiModel(false);
        }}
      />

      {/* ── Manage AI Model Modal (Edit/Deactivate) ── */}
      <ManageAiModelModal
        open={showManageAiModel}
        action={manageAction}
        model={selectedManageModel}
        onClose={() => {
          setShowManageAiModel(false);
          setSelectedManageModel(null);
        }}
        onSuccess={async () => {
          await loadHospitalData();
          setShowManageAiModel(false);
          setSelectedManageModel(null);
        }}
      />

      {/* ── View AI Model Details Modal ── */}
      <ViewAiModelDetailsModal
        open={showViewAiModel}
        modelId={selectedAiModelId}
        onClose={() => {
          setShowViewAiModel(false);
          setSelectedAiModelId(null);
        }}
      />

      {/* ── Edit AI Model Modal ── */}
      <EditAiModelModal
        open={showEditAiModel}
        modelId={selectedAiModelId}
        onClose={() => {
          setShowEditAiModel(false);
          setSelectedAiModelId(null);
        }}
        onSuccess={async () => {
          await loadHospitalData();
          setShowEditAiModel(false);
          setSelectedAiModelId(null);
        }}
      />
    </div>
  );
}

function formatShortId(id) {
  return id ? `${id.substring(0, 8)}…` : '--';
}

function getDoctorName(doctor) {
  return doctor.doctorName || doctor.name || doctor.user?.username || 'Chưa cập nhật';
}

function getDoctorStatus(doctor) {
  return doctor.doctorStatus || doctor.user?.status || doctor.status || 'UNKNOWN';
}

function getTransactionStatus(tx) {
  return tx.status || tx.blockchainStatus || 'UNKNOWN';
}

function getAiModelStatus(model) {
  return model.isActiveOnChain ? 'ON_CHAIN' : 'PENDING';
}

function formatHash(hash) {
  if (!hash) return 'Chưa cập nhật';
  if (hash.length <= 24) return hash;
  return `${hash.substring(0, 12)}…${hash.substring(hash.length - 10)}`;
}

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  return new Date(value).toLocaleString('vi-VN');
}
