import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLang } from '../contexts/ThemeLangContext';
import ViewAiModelDetailsModal from '../components/ViewAiModelDetailsModal';
import SettingsView from '../components/SettingsView';
import SupportView from '../components/SupportView';
import api from '../services/api';

const DOCTOR_NAV = [
  { id: 'diagnosis',  icon: 'healing',               labelKey: 'tabDiagnosis' },
  { id: 'ai',         icon: 'smart_toy',             labelKey: 'tabAi' },
  { id: 'blockchain', icon: 'account_balance_wallet', labelKey: 'tabBlockchain' },
  { id: 'profile',    icon: 'badge',                 labelKey: 'tabProfile' },
];

const dict = {
  vi: {
    title: "ZKP Identity",
    subtitle: "Cổng Lâm Sàng Bác Sĩ",
    newDiagnosis: "Chẩn Đoán Mới",
    tabDiagnosis: "Hồ Sơ Bệnh Án",
    tabAi: "Trợ Lý Lâm Sàng AI",
    tabBlockchain: "Lịch Sử Blockchain",
    tabProfile: "Chứng Chỉ & Hồ Sơ",
    settings: "Cài đặt",
    settingsTab: "Cài đặt Tài khoản",
    support: "Hỗ trợ kỹ thuật",
    supportTab: "Trung tâm Trợ giúp",
    logout: "Đăng xuất",
    
    // Stats
    statTotalDiag: "Tổng số chẩn đoán",
    statActiveAi: "Trợ lý AI sẵn sàng",
    statChainTx: "Chứng minh mật mã",
    statZkpStatus: "Trạng thái Sinh trắc học",
    statZkpVerified: "Đã xác thực Face-ZKP",
    
    // Empty State
    emptyTitle: "Chưa ghi nhận dữ liệu",
    emptyDesc: "Hệ thống chưa ghi chẩn đoán nào của bạn. Hãy bắt đầu bằng cách tạo chẩn đoán AI lâm sàng mới.",
    
    // Columns
    colDiagId: "Mã Bệnh Án",
    colPatient: "Bệnh Nhân",
    colDisease: "Bệnh Lý Lâm Sàng",
    colTreatment: "Phác Đồ Đề Xuất",
    colAiModel: "Trợ Lý AI",
    colStatus: "Trạng Thái",
    colTime: "Thời Gian",
    
    colModelId: "Mã Trợ Lý",
    colModelName: "Tên Trợ Lý AI",
    colVersion: "Phiên Bản",
    colSpecialty: "Chuyên Khoa",
    colBlockchainStatus: "Blockchain",
    colActions: "Chi Tiết",

    colTxId: "Mã Tx",
    colTxHash: "Mã Giao Dịch",
    colTxAction: "Hành Động",
    colTxTime: "Thời Gian Ghi Sổ",
    colTxStatus: "Trạng Thái Mạng",

    // Profile details
    profileTitle: "Thông Tin Chứng Chỉ Hành Nghề Bác Sĩ",
    licenseId: "Mã chứng chỉ (License ID)",
    identityNumber: "Số căn cước công dân",
    position: "Chức vụ hành nghề",
    specialties: "Chuyên khoa hoạt động",
    degree: "Học vị / Học hàm",
    faculty: "Khoa công tác",
    workingStart: "Ngày bắt đầu công tác",
    birthDate: "Ngày sinh",
    zkpVerification: "Chứng chỉ mật mã sinh trắc học",
    zkpDesc: "Hồ sơ của bạn đã được gắn kết với khóa riêng tư và mẫu khuôn mặt thông qua giao thức ZKP (Zero-Knowledge Proof). Mỗi lần chẩn đoán đều được ký mật mã ZKP để bảo mật tối đa danh tính bệnh nhân.",

    loading: "Đang tải dữ liệu lâm sàng..."
  },
  en: {
    title: "ZKP Identity",
    subtitle: "Doctor Clinical Portal",
    newDiagnosis: "New Diagnosis",
    tabDiagnosis: "Clinical Records",
    tabAi: "AI Clinical Assistants",
    tabBlockchain: "Blockchain Audits",
    tabProfile: "Credentials & Profile",
    settings: "Settings",
    settingsTab: "Account Settings",
    support: "Technical Support",
    supportTab: "Help Center",
    logout: "Logout",
    
    // Stats
    statTotalDiag: "Total Diagnoses",
    statActiveAi: "Active AI Assistants",
    statChainTx: "Cryptographic Proofs",
    statZkpStatus: "Biometric Status",
    statZkpVerified: "Face-ZKP Verified",
    
    // Empty State
    emptyTitle: "No records found",
    emptyDesc: "You haven't recorded any clinical diagnoses yet. Start by performing a new secure AI diagnosis.",
    
    // Columns
    colDiagId: "Record ID",
    colPatient: "Patient Name",
    colDisease: "Clinical Disease",
    colTreatment: "Proposed Treatment",
    colAiModel: "AI Assistant",
    colStatus: "Status",
    colTime: "Timestamp",

    colModelId: "Assistant ID",
    colModelName: "AI Assistant Name",
    colVersion: "Version",
    colSpecialty: "Specialty",
    colBlockchainStatus: "Blockchain",
    colActions: "Details",

    colTxId: "Tx ID",
    colTxHash: "Transaction Hash",
    colTxAction: "Action Taken",
    colTxTime: "Timestamp",
    colTxStatus: "Network Status",

    // Profile details
    profileTitle: "Doctor Practitioner Credentials",
    licenseId: "License Practitioner ID",
    identityNumber: "National Identity ID",
    position: "Clinical Position",
    specialties: "Specialties",
    degree: "Professional Degree",
    faculty: "Department / Faculty",
    workingStart: "Practice Start Date",
    birthDate: "Date of Birth",
    zkpVerification: "Biometric ZKP Certification",
    zkpDesc: "Your practitioner profile is bound to your secure private key and face embedding via Zero-Knowledge Proof (ZKP). Every diagnosis is cryptographically signed to guard patient anonymity.",

    loading: "Loading clinical data..."
  }
};

export default function DoctorDashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, lang, toggleLang } = useThemeLang();

  const [activeTab, setActiveTab] = useState('diagnosis');
  const [data, setData] = useState({ doctors: [], diagnoses: [], transactions: [], aimodels: [] });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showViewAiModel, setShowViewAiModel] = useState(false);
  const [selectedAiModelId, setSelectedAiModelId] = useState(null);
  
  // State for simulated New Diagnosis Modal
  const [showCreateDiagnosis, setShowCreateDiagnosis] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newDiagForm, setNewDiagForm] = useState({
    patientName: '',
    disease: '',
    treatment: '',
    aiModelId: '',
    note: ''
  });
  const [creatingDiag, setCreatingDiag] = useState(false);
  const [simulatedTxHash, setSimulatedTxHash] = useState('');
  const [simulatedLogs, setSimulatedLogs] = useState([]);

  useEffect(() => { loadClinicalData(); }, []);

  const loadClinicalData = async () => {
    try {
      const [docRes, diagRes, txRes, aiRes] = await Promise.all([
        api.get('/hospital/doctors').catch(() => ({ data: [] })),
        api.get('/hospital/diagnoses').catch(() => ({ data: [] })),
        api.get('/hospital/transactions').catch(() => ({ data: [] })),
        api.get('/ai-model/list').catch(() => ({ data: [] })),
      ]);
      
      setData({
        doctors: docRes.data || [],
        diagnoses: diagRes.data || [],
        transactions: txRes.data || [],
        aimodels: aiRes.data || [],
      });
    } catch (err) {
      console.error('Failed to load clinical data:', err);
    } finally {
      setLoading(false);
    }
  };

  const tLocal = (key) => dict[lang]?.[key] || key;

  // Filter diagnoses specific to this doctor
  const currentDoctorProfile = data.doctors.find(doc => doc.userId === user?.id || doc.user?.id === user?.id);
  const myDiagnoses = data.diagnoses.filter(diag => diag.doctorId === currentDoctorProfile?.id);

  const getStats = () => {
    return [
      {
        title: tLocal('statTotalDiag'),
        value: myDiagnoses.length,
        icon: 'healing',
        desc: lang === 'vi' ? 'Bệnh án bạn phụ trách' : 'Diagnoses by you',
        color: 'from-teal-500 to-emerald-500'
      },
      {
        title: tLocal('statActiveAi'),
        value: data.aimodels.filter(m => m.isActiveOnChain).length,
        icon: 'smart_toy',
        desc: lang === 'vi' ? 'Trợ lý AI sẵn sàng' : 'AI Models available',
        color: 'from-cyan-500 to-blue-500'
      },
      {
        title: tLocal('statChainTx'),
        value: data.transactions.length,
        icon: 'account_balance_wallet',
        desc: lang === 'vi' ? 'Ghi nhận trên sổ cái' : 'Ledger logs verified',
        color: 'from-purple-500 to-indigo-500'
      },
      {
        title: tLocal('statZkpStatus'),
        value: 'ACTIVE',
        icon: 'verified_user',
        desc: tLocal('statZkpVerified'),
        color: 'from-teal-600 to-cyan-600',
        badge: true
      }
    ];
  };

  const handleCreateDiagnosisSubmit = async (e) => {
    e.preventDefault();
    if (!newDiagForm.patientName || !newDiagForm.disease || !newDiagForm.aiModelId) {
      alert(lang === 'vi' ? 'Vui lòng điền đầy đủ các trường bắt buộc.' : 'Please fill all required fields.');
      return;
    }
    
    setCreateStep(2);
    setCreatingDiag(true);
    setSimulatedLogs([]);

    const logs = [
      lang === 'vi' ? '1. Đang trích xuất dữ liệu lâm sàng bệnh lý...' : '1. Extracting clinical symptoms...',
      lang === 'vi' ? '2. Gửi dữ liệu tới Mô hình Trí tuệ Nhân tạo AI...' : '2. Querying AI Assistant clinical engine...',
      lang === 'vi' ? '3. Nhận phản hồi lâm sàng & sinh mã băm kết quả...' : '3. Clinical response retrieved. Computing digest hash...',
      lang === 'vi' ? '4. Đang sinh chứng minh mật mã không tiết lộ (ZKP Proof)...' : '4. Compiling Zero-Knowledge cryptographic Proof (Face + Diagnosis)...',
      lang === 'vi' ? '5. Đang truyền dữ liệu bảo mật tích hợp ZKP lên Smart Contract...' : '5. Publishing secure ZKP payload to Identity smart contract...',
      lang === 'vi' ? '6. Hệ thống Blockchain xác nhận giao dịch thành công!' : '6. Smart Contract transaction successfully mined on-chain!'
    ];

    // Simulate logs appearing step by step
    for (let i = 0; i < logs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setSimulatedLogs(prev => [...prev, logs[i]]);
    }

    // Call Mock/Simulated API (or we can write to localStorage or let it fall back)
    const hash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    setSimulatedTxHash(hash);
    
    // Prepend to local state diagnoses to show immediate feedback!
    const selectedModelObj = data.aimodels.find(m => m.modelId === newDiagForm.aiModelId || m.id === newDiagForm.aiModelId);
    
    const mockNewDiag = {
      id: 'mock-' + Math.random().toString(36).substr(2, 9),
      doctorId: currentDoctorProfile?.id || 'doc-id',
      doctor: currentDoctorProfile || { doctorName: user?.username },
      aiModelId: newDiagForm.aiModelId,
      aiModel: { modelName: selectedModelObj?.modelName || 'Clinical Model A' },
      patientName: newDiagForm.patientName,
      disease: newDiagForm.disease,
      treatment: newDiagForm.treatment || 'Nghỉ ngơi và theo dõi lâm sàng',
      status: 'COMPLETED',
      createdAt: new Date().toISOString()
    };

    setData(prev => ({
      ...prev,
      diagnoses: [mockNewDiag, ...prev.diagnoses],
      transactions: [
        {
          id: 'tx-mock-' + Math.random().toString(36).substr(2, 9),
          transactionId: hash,
          txHash: hash,
          action: `Chẩn đoán AI (${newDiagForm.disease})`,
          confirmTime: new Date().toISOString(),
          status: 'SUCCESS',
          blockchainStatus: 'SUCCESS'
        },
        ...prev.transactions
      ]
    }));

    setCreatingDiag(false);
    setCreateStep(3);
  };

  const resetDiagModal = () => {
    setShowCreateDiagnosis(false);
    setCreateStep(1);
    setNewDiagForm({
      patientName: '',
      disease: '',
      treatment: '',
      aiModelId: '',
      note: ''
    });
    setSimulatedTxHash('');
    setSimulatedLogs([]);
  };

  const countLabel = {
    diagnosis: lang === 'vi' 
      ? `Danh sách bệnh án của bác sĩ (${myDiagnoses.length} hồ sơ)` 
      : `Clinical records assigned to you (${myDiagnoses.length} items)`,
    ai: lang === 'vi' 
      ? `Tìm hiểu & đối chiếu mô hình AI được phân quyền (${data.aimodels.length} trợ lý)` 
      : `Verify & query active AI medical models (${data.aimodels.length} assistants)`,
    blockchain: lang === 'vi' 
      ? `Danh sách chữ ký chẩn đoán an toàn trên chuỗi (${data.transactions.length} sự kiện)` 
      : `List of secure clinical signatures on-chain (${data.transactions.length} events)`,
    profile: lang === 'vi'
      ? 'Chứng chỉ lâm sàng và trạng thái định danh mật mã sinh trắc học.'
      : 'Clinical credentials and cryptographic biometric identity status.',
  };

  const isEmpty = (activeTab === 'diagnosis' && myDiagnoses.length === 0) ||
                  (activeTab === 'blockchain' && data.transactions.length === 0) ||
                  (activeTab === 'ai' && data.aimodels.length === 0);

  const getEmptyStateIcon = () => {
    if (activeTab === 'diagnosis') return 'healing';
    if (activeTab === 'blockchain') return 'account_balance_wallet';
    return 'smart_toy';
  };

  const tableContent = activeTab === 'settings' ? (
    <SettingsView />
  ) : activeTab === 'support' ? (
    <SupportView />
  ) : activeTab === 'profile' ? (
    <div className="slide-up">
      <div className={`card ${theme === 'dark' ? 'bg-[#0a192f] border-white/5' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="relative group">
            <div className={`w-32 h-32 rounded-xl overflow-hidden border-2 ${theme === 'dark' ? 'border-teal-500/50' : 'border-teal-600'} shadow-lg bg-slate-100 flex items-center justify-center`}>
              {currentDoctorProfile?.portraitImage ? (
                <img 
                  src={`data:image/jpeg;base64,${currentDoctorProfile.portraitImage}`} 
                  alt="Doctor Portrait" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-5xl text-teal-600">medical_services</span>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-teal-500 text-white rounded-full p-1.5 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-sm">verified</span>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-teal-400' : 'text-teal-700'}`}>
                  {currentDoctorProfile?.doctorName || user?.username || 'Bác sĩ Lâm Sàng'}
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'}`}>
                  {currentDoctorProfile?.degree || 'Chưa cập nhật học vị'} — {currentDoctorProfile?.position || 'Bác sĩ chuyên khoa'}
                </p>
              </div>
              <span className="badge badge-success px-3 py-1 flex items-center gap-1.5 self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {lang === 'vi' ? 'Đã Xác Thực ZKP' : 'ZKP Verified'}
              </span>
            </div>

            <div className="border-t border-slate-200 dark:border-white/5 my-4"></div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 mb-4">{tLocal('profileTitle')}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 font-semibold">{tLocal('licenseId')}</span>
                <span className="text-sm font-semibold">{currentDoctorProfile?.licenseId || '--'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 font-semibold">{tLocal('identityNumber')}</span>
                <span className="text-sm font-semibold">{currentDoctorProfile?.identityNumber || '--'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 font-semibold">{tLocal('specialties')}</span>
                <span className="text-sm font-semibold text-teal-500 dark:text-teal-400">{currentDoctorProfile?.specialties || '--'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 font-semibold">{tLocal('faculty')}</span>
                <span className="text-sm font-semibold">{currentDoctorProfile?.facultyOfWork || '--'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 font-semibold">{tLocal('birthDate')}</span>
                <span className="text-sm font-semibold">
                  {currentDoctorProfile?.dateOfBirth ? new Date(currentDoctorProfile.dateOfBirth).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : '--'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 font-semibold">{tLocal('workingStart')}</span>
                <span className="text-sm font-semibold">
                  {currentDoctorProfile?.workingStartDate ? new Date(currentDoctorProfile.workingStartDate).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : '--'}
                </span>
              </div>
            </div>

            <div className={`mt-8 p-5 rounded-xl border ${theme === 'dark' ? 'bg-teal-950/20 border-teal-500/20' : 'bg-teal-50/50 border-teal-200'} slide-up`}>
              <h5 className="text-sm font-bold text-teal-600 dark:text-teal-400 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">fingerprint</span>
                {tLocal('zkpVerification')}
              </h5>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-300">
                {tLocal('zkpDesc')}
              </p>
              {currentDoctorProfile?.blockchainHash && (
                <div className="mt-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cryptographic Identity Hash</span>
                  <span className="text-xs font-mono bg-black/20 dark:bg-black/40 p-2.5 rounded border border-white/5 break-all">
                    {currentDoctorProfile.blockchainHash}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
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
              {activeTab === 'diagnosis' && (
                <tr>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDiagId')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colPatient')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colDisease')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTreatment')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colAiModel')}</th>
                  <th className="p-4 text-xs font-semibold">{tLocal('colTime')}</th>
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
                  <th className="p-4 text-xs font-semibold">{tLocal('colBlockchainStatus')}</th>
                  <th className="p-4 text-xs font-semibold text-right">{tLocal('colActions')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {activeTab === 'diagnosis' && myDiagnoses.map((d) => (
                <tr key={d.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">#{formatShortId(d.id)}</td>
                  <td className="p-4 text-sm align-middle font-semibold">{d.patientName}</td>
                  <td className="p-4 text-sm align-middle text-teal-600 dark:text-teal-400 font-semibold">{d.disease}</td>
                  <td className="p-4 text-sm align-middle">{d.treatment}</td>
                  <td className="p-4 text-sm align-middle text-primary">{d.aiModel?.modelName || d.aiModel?.name || 'Mô hình lâm sàng'}</td>
                  <td className="p-4 text-sm align-middle text-xs opacity-80">{formatDateTime(d.createdAt)}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {d.status || 'PENDING'}
                    </span>
                  </td>
                </tr>
              ))}

              {activeTab === 'blockchain' && data.transactions.map((tx) => (
                <tr key={tx.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">#{formatShortId(tx.id)}</td>
                  <td className="p-4 text-sm align-middle font-mono text-xs opacity-60">{formatHash(tx.txHash || tx.transactionId)}</td>
                  <td className="p-4 text-sm align-middle font-semibold text-teal-600 dark:text-teal-400">{tx.action || 'Lưu hồ sơ chẩn đoán'}</td>
                  <td className="p-4 text-sm align-middle">{formatDateTime(tx.timestamp || tx.confirmTime)}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tx.blockchainStatus === 'SUCCESS' || tx.status === 'CONFIRMED' || tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {tx.blockchainStatus || tx.status || 'UNKNOWN'}
                    </span>
                  </td>
                </tr>
              ))}

              {activeTab === 'ai' && data.aimodels.map((m) => (
                <tr key={m.id} className={`border-b ${theme === 'dark' ? 'border-outline-variant/10 hover:bg-surface-container-high/50 text-on-surface' : 'border-slate-100 hover:bg-slate-50/80 text-slate-700'} transition-colors`}>
                  <td className="p-4 text-sm align-middle font-mono text-xs">{m.modelId ? formatShortId(m.modelId) : formatShortId(m.id)}</td>
                  <td className="p-4 text-sm align-middle font-semibold text-info">{m.modelName || m.name}</td>
                  <td className="p-4 text-sm align-middle font-mono text-xs">{m.modelVersion || m.version || '1.0.0'}</td>
                  <td className="p-4 text-sm align-middle">{m.recommendedSpecialty || 'Đa Khoa'}</td>
                  <td className="p-4 text-sm align-middle">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.isActiveOnChain ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {m.isActiveOnChain ? 'ACTIVE (On-Chain)' : 'PENDING'}
                    </span>
                  </td>
                  <td className="p-4 text-sm align-middle text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAiModelId(m.modelId || m.id);
                        setShowViewAiModel(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-teal-500/10 text-teal-600 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                    >
                      {tLocal('colActions')}
                    </button>
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
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4 border-teal-600"></div>
          <div className="text-lg font-semibold">{tLocal('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`antialiased min-h-screen flex font-body-md text-body-md transition-colors duration-200 ${theme === 'dark' ? 'bg-[#001233] text-[#d8e2ff] dark doctor-mode' : 'bg-slate-50 text-slate-800 doctor-mode'}`}>
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* SideNavBar */}
      <nav className={`fixed left-0 top-0 h-full w-[260px] border-r flex flex-col z-40 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${theme === 'dark' ? 'bg-surface-container border-outline-variant/10' : 'bg-white border-slate-200'}`}>
        <div className="p-6 relative">
          <h1 className={`font-headline-md text-headline-md font-bold ${theme === 'dark' ? 'text-teal-400' : 'text-teal-700'}`}>{tLocal('title')}</h1>
          <p className={`${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'} font-label-md text-label-md mt-1`}>{tLocal('subtitle')}</p>
          
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-6 right-6 text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Create Diagnosis Action Button */}
        <div className="px-4 mb-6">
          <button 
            onClick={() => setShowCreateDiagnosis(true)}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-semibold text-sm transition-colors shadow-sm bg-teal-600 text-white hover:bg-teal-700"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            {tLocal('newDiagnosis')}
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-2">
          {DOCTOR_NAV.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 text-left font-semibold text-sm ${
                  isActive 
                    ? theme === 'dark'
                      ? 'bg-teal-500/10 text-teal-400 border-l-4 border-teal-500'
                      : 'bg-teal-50 text-teal-600 border-l-4 border-teal-600'
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

        {/* Sidebar Footer with metadata */}
        <div className={`mt-auto border-t p-2 flex flex-col gap-1 ${theme === 'dark' ? 'border-outline-variant/10' : 'border-slate-200'}`}>
          <a 
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all font-semibold text-sm ${
              activeTab === 'settings'
                ? theme === 'dark'
                  ? 'bg-teal-500/10 text-teal-400 border-l-4 border-teal-500'
                  : 'bg-teal-50 text-teal-600 border-l-4 border-teal-600'
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
            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all font-semibold text-sm ${
              activeTab === 'support'
                ? theme === 'dark'
                  ? 'bg-teal-500/10 text-teal-400 border-l-4 border-teal-500'
                  : 'bg-teal-50 text-teal-600 border-l-4 border-teal-600'
                : theme === 'dark'
                  ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined">help</span>
            <span>{tLocal('support')}</span>
          </a>
          
          <div className="px-4 py-3 flex items-center gap-3 mt-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              {user?.username ? user.username.charAt(0).toUpperCase() : 'D'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-on-surface' : 'text-slate-800'}`}>
                {currentDoctorProfile?.doctorName || user?.username || 'Bác sĩ'}
              </span>
              <span className={`text-xs truncate ${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'}`}>
                {currentDoctorProfile?.position || 'Bác sĩ chuyên khoa'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-[260px] min-h-screen relative">
        
        {/* TopNavBar */}
        <header className={`sticky top-0 z-20 flex justify-between items-center h-16 px-4 md:px-8 border-b backdrop-blur-md transition-colors ${theme === 'dark' ? 'bg-[#001233]/85 border-outline-variant/10' : 'bg-white/85 border-slate-200'}`}>
          <div className="flex items-center">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-full mr-2 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            <nav className="hidden md:flex items-center gap-6 font-semibold text-sm">
              <a 
                onClick={() => setActiveTab('diagnosis')}
                className={`cursor-pointer pb-1 transition-all ${
                  activeTab === 'diagnosis'
                    ? 'text-teal-600 dark:text-teal-400 font-bold border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-on-surface-variant dark:hover:text-on-surface'
                }`}
              >
                {tLocal('tabDiagnosis')}
              </a>
              <a 
                onClick={() => setActiveTab('ai')}
                className={`cursor-pointer pb-1 transition-all ${
                  activeTab === 'ai'
                    ? 'text-teal-600 dark:text-teal-400 font-bold border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-on-surface-variant dark:hover:text-on-surface'
                }`}
              >
                {tLocal('tabAi')}
              </a>
              <a 
                onClick={() => setActiveTab('profile')}
                className={`cursor-pointer pb-1 transition-all ${
                  activeTab === 'profile'
                    ? 'text-teal-600 dark:text-teal-400 font-bold border-b-2 border-teal-600 dark:border-teal-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-on-surface-variant dark:hover:text-on-surface'
                }`}
              >
                {tLocal('tabProfile')}
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleLang} 
              className={`p-2 rounded-full flex items-center justify-center gap-1 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}
              title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            >
              <span className="material-symbols-outlined text-xl">language</span>
              <span className="text-xs font-bold font-mono">{lang === 'vi' ? 'VI' : 'EN'}</span>
            </button>

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

            <div className={`h-6 w-px mx-1 md:mx-2 ${theme === 'dark' ? 'bg-outline-variant/30' : 'bg-slate-200'}`}></div>

            <button 
              onClick={logout}
              className={`font-semibold text-sm transition-colors ${theme === 'dark' ? 'text-on-surface-variant hover:text-on-surface' : 'text-slate-600 hover:text-slate-800'}`}
            >
              {tLocal('logout')}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 bg-transparent">
          
          {/* Stats Cards Section */}
          {activeTab !== 'settings' && activeTab !== 'support' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 slide-up">
              {getStats().map((stat, i) => (
                <div 
                  key={i} 
                  className={`card relative overflow-hidden flex flex-col justify-between p-6 ${theme === 'dark' ? 'bg-[#0a192f] border-white/5' : 'bg-white border-slate-200'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {stat.title}
                      </span>
                      <h3 className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        {stat.value}
                      </h3>
                    </div>
                    <div className={`p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400`}>
                      <span className="material-symbols-outlined">{stat.icon}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {stat.badge ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {stat.desc}
                      </span>
                    ) : (
                      <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {stat.desc}
                      </span>
                    )}
                  </div>
                  {/* Subtle colored bottom bar */}
                  <div className={`absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r ${stat.color}`}></div>
                </div>
              ))}
            </div>
          )}

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className={`font-headline-lg text-headline-lg font-bold ${theme === 'dark' ? 'text-on-background' : 'text-slate-900'}`}>
                {activeTab === 'support'
                  ? tLocal('supportTab')
                  : activeTab === 'settings'
                    ? tLocal('settingsTab')
                    : tLocal(DOCTOR_NAV.find((i) => i.id === activeTab)?.labelKey)}
              </h2>
              <p className={`font-body-md text-body-md mt-1 ${theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500'}`}>
                {countLabel[activeTab]}
              </p>
            </div>

            {activeTab === 'diagnosis' && (
              <button 
                onClick={() => setShowCreateDiagnosis(true)}
                className="px-6 py-2.5 rounded-lg flex items-center gap-2 font-semibold text-sm transition-colors shadow-sm bg-teal-600 text-white hover:bg-teal-700"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                {tLocal('newDiagnosis')}
              </button>
            )}
          </div>

          {/* Table/Details content */}
          {tableContent}
        </main>
      </div>

      {/* View AI Model Details Modal */}
      <ViewAiModelDetailsModal
        open={showViewAiModel}
        modelId={selectedAiModelId}
        onClose={() => {
          setShowViewAiModel(false);
          setSelectedAiModelId(null);
        }}
      />

      {/* Simulated Secure ZKP AI Diagnosis Modal */}
      {showCreateDiagnosis && (
        <div 
          onClick={resetDiagModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(640px, calc(100vw - 24px))',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'modalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">verified_user</span>
                <h3 className="text-lg font-bold text-teal-600 dark:text-teal-400">
                  {lang === 'vi' ? 'Tạo Chẩn Đoán AI Lâm Sàng Mật Mã (ZKP)' : 'Secure Cryptographic ZKP Diagnosis'}
                </h3>
              </div>
              <button 
                onClick={resetDiagModal}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[72vh] flex flex-col gap-5">
              
              {/* Stepper Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
                  <span className="text-xs font-semibold">{lang === 'vi' ? 'Nhập hồ sơ' : 'Diagnosis Input'}</span>
                </div>
                <div className="flex-1 h-0.5 mx-3 bg-slate-200 dark:bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
                  <span className="text-xs font-semibold">{lang === 'vi' ? 'Sinh ZKP & Ký' : 'ZKP Proof & Sign'}</span>
                </div>
                <div className="flex-1 h-0.5 mx-3 bg-slate-200 dark:bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createStep >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
                  <span className="text-xs font-semibold">{lang === 'vi' ? 'Hoàn tất' : 'Success'}</span>
                </div>
              </div>

              {/* STEP 1: FORM INPUT */}
              {createStep === 1 && (
                <form onSubmit={handleCreateDiagnosisSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'vi' ? 'Chọn Mô Hình AI Hỗ Trợ *' : 'Select Clinical AI Assistant *'}</label>
                    <select
                      required
                      value={newDiagForm.aiModelId}
                      onChange={(e) => setNewDiagForm({...newDiagForm, aiModelId: e.target.value})}
                      className="form-input text-sm p-3 bg-slate-50 dark:bg-[#001233] border dark:border-white/5 text-slate-900 dark:text-white"
                    >
                      <option value="">-- {lang === 'vi' ? 'Chọn trợ lý AI hoạt động on-chain' : 'Select an active on-chain assistant'} --</option>
                      {data.aimodels.map(m => (
                        <option key={m.id} value={m.modelId || m.id}>{m.modelName || m.name} ({m.recommendedSpecialty || 'Clinical Model'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'vi' ? 'Họ Tên Bệnh Nhân *' : 'Patient Full Name *'}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nguyễn Văn A"
                      value={newDiagForm.patientName}
                      onChange={(e) => setNewDiagForm({...newDiagForm, patientName: e.target.value})}
                      className="form-input text-sm p-3 bg-slate-50 dark:bg-[#001233] border dark:border-white/5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'vi' ? 'Bệnh Lý Lâm Sàng *' : 'Clinical Disease Diagnosis *'}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Viêm phổi cấp tính / Ung thư đại trực tràng giai đoạn 1"
                      value={newDiagForm.disease}
                      onChange={(e) => setNewDiagForm({...newDiagForm, disease: e.target.value})}
                      className="form-input text-sm p-3 bg-slate-50 dark:bg-[#001233] border dark:border-white/5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'vi' ? 'Phác Đồ & Thuốc Điều Trị' : 'Proposed Treatment Regimen'}</label>
                    <textarea
                      rows={3}
                      placeholder={lang === 'vi' ? 'Nhập danh mục thuốc, liều lượng, cách điều trị đề xuất...' : 'List medications, active dosages, clinical care guidelines...'}
                      value={newDiagForm.treatment}
                      onChange={(e) => setNewDiagForm({...newDiagForm, treatment: e.target.value})}
                      className="form-input text-sm p-3 bg-slate-50 dark:bg-[#001233] border dark:border-white/5 text-slate-900 dark:text-white resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'vi' ? 'Ghi Chú Đặc Biệt' : 'Clinical Notes'}</label>
                    <input
                      type="text"
                      placeholder={lang === 'vi' ? 'Ví dụ: Bệnh nhân có tiền sử dị ứng penicillin...' : 'Example: Patient allergic to penicillin...'}
                      value={newDiagForm.note}
                      onChange={(e) => setNewDiagForm({...newDiagForm, note: e.target.value})}
                      className="form-input text-sm p-3 bg-slate-50 dark:bg-[#001233] border dark:border-white/5 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t dark:border-white/5">
                    <button 
                      type="button" 
                      onClick={resetDiagModal} 
                      className="btn btn-secondary"
                    >
                      {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                    </button>
                    <button 
                      type="submit" 
                      className="btn bg-teal-600 text-white hover:bg-teal-700"
                    >
                      {lang === 'vi' ? 'Sinh Báo Cáo Lâm Sàng & Ký ZKP' : 'Verify & Sign Cryptographically'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: ZKP PROOF COMPILING & BLOCKCHAIN MINING */}
              {createStep === 2 && (
                <div className="flex flex-col items-center justify-center py-10 gap-6 slide-up">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-teal-500/30 border-t-teal-600 animate-spin flex items-center justify-center"></div>
                    <span className="absolute inset-0 flex items-center justify-center text-teal-600 dark:text-teal-400 material-symbols-outlined text-2xl animate-pulse">lock</span>
                  </div>

                  <div className="text-center">
                    <h4 className="text-base font-bold text-teal-600 dark:text-teal-400 mb-1">
                      {lang === 'vi' ? 'Hệ thống đang bảo mật dữ liệu...' : 'Compiling Cryptographic Zero-Knowledge Payload...'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm">
                      {lang === 'vi' ? 'Khóa bảo mật của bạn đang thực hiện ký mật mã Face-ZKP và xác nhận giao dịch lâm sàng ẩn danh bệnh nhân.' : 'Your private key is signing biometric metadata and issuing anonymous clinical proof.'}
                    </p>
                  </div>

                  {/* Cryptographic Simulation logs */}
                  <div className="w-full max-w-md bg-slate-950/80 border border-white/5 rounded-lg p-4 font-mono text-xs text-teal-400 flex flex-col gap-2 shadow-inner">
                    {simulatedLogs.map((log, i) => (
                      <div key={i} className="flex items-center gap-2 slide-up">
                        <span className="text-teal-500">❯</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    {creatingDiag && <div className="text-slate-500 animate-pulse">▋ {lang === 'vi' ? 'Đang biên dịch proof...' : 'Compiling proof state...'}</div>}
                  </div>
                </div>
              )}

              {/* STEP 3: SUCCESS & TX DETAILS */}
              {createStep === 3 && (
                <div className="flex flex-col gap-5 py-6 slide-up">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-2">
                      <span className="material-symbols-outlined text-2xl font-bold">check</span>
                    </div>
                    <h4 className="text-lg font-bold text-emerald-500">
                      {lang === 'vi' ? 'Khởi Tạo Chẩn Đoán AI Thành Công!' : 'Secure Diagnosis Registered!'}
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md">
                      {lang === 'vi' ? 'Hồ sơ bệnh án đã được ký mã hóa và đăng ký toàn vẹn thành công trên sổ cái Blockchain.' : 'The clinical record has been cryptographically signed and registered on the blockchain ledger.'}
                    </p>
                  </div>

                  <div className="border border-slate-200 dark:border-white/5 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'vi' ? 'Bệnh Nhân' : 'Patient'}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{newDiagForm.patientName}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'vi' ? 'Bệnh Lý Lâm Sàng' : 'Disease'}</span>
                        <span className="font-semibold text-teal-600 dark:text-teal-400">{newDiagForm.disease}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 border-t dark:border-white/5 pt-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Blockchain Transaction Hash (Tx)</span>
                      <span className="text-[10px] font-mono bg-black/25 p-2 rounded break-all select-all border border-white/5">
                        {simulatedTxHash}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center mt-4">
                    <button 
                      onClick={resetDiagModal} 
                      className="btn bg-teal-600 text-white hover:bg-teal-700 px-8"
                    >
                      {lang === 'vi' ? 'Xong' : 'Done'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function formatShortId(id) {
  return id ? `${id.substring(0, 8)}…` : '--';
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
