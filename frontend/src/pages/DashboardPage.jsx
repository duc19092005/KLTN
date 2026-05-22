import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLang } from '../contexts/ThemeLangContext';
import Sidebar from '../components/Sidebar';
import CreateDoctorModal from '../components/CreateDoctorModal';
import CreateAiModelModal from '../components/CreateAiModelModal';
import api from '../services/api';

const ADMIN_NAV = [
  { id: 'doctor',     icon: '', label: 'Quản lý bác sĩ' },
  { id: 'diagnosis',  icon: '', label: 'Quản lý chuẩn đoán' },
  { id: 'blockchain', icon: '', label: 'Giao dịch Blockchain' },
  { id: 'ai',         icon: '', label: 'Quản lý AI Model' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useThemeLang();

  const [activeTab, setActiveTab] = useState('doctor');
  const [data, setData] = useState({ doctors: [], diagnoses: [], transactions: [], aimodels: [] });
  const [loading, setLoading] = useState(true);
  const [showCreateDoctor, setShowCreateDoctor] = useState(false);
  const [showCreateAiModel, setShowCreateAiModel] = useState(false);

  useEffect(() => { loadHospitalData(); }, []);

  const loadHospitalData = async () => {
    try {
      const [docRes, diagRes, txRes, aiRes] = await Promise.all([
        api.get('/hospital/doctors'),
        api.get('/hospital/diagnoses'),
        api.get('/hospital/transactions'),
        api.get('/ai-model/list'),
      ]);
      setData({
        doctors:      docRes.data,
        diagnoses:    diagRes.data,
        transactions: txRes.data,
        aimodels:     aiRes.data,
      });
    } catch (err) {
      console.error('Failed to load hospital data:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeItem = ADMIN_NAV.find((i) => i.id === activeTab);

  const countLabel = {
    doctor:     `${data.doctors.length} bác sĩ trong hệ thống`,
    diagnosis:  `${data.diagnoses.length} chuẩn đoán được ghi nhận`,
    blockchain: `${data.transactions.length} giao dịch trên blockchain`,
    ai:         `${data.aimodels.length} mô hình AI đang quản lý`,
  };

  const tableContent = (
    <div className="card fade-in data-table-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-scroll" style={{ overflowX: 'auto' }}>
        <table className="dashboard-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem' }}>

          {activeTab === 'doctor' && (
            <>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  {['ID', 'Họ và Tên', 'Chuyên Khoa', 'Chức Vụ', 'Trạng Thái'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.doctors.length === 0 && <EmptyRow cols={5} />}
                {data.doctors.map((d) => (
                  <tr key={d.id} style={rowStyle} className="hover:bg-elevated">
                    <td style={tdStyle}><span className="mono">#{formatShortId(d.id)}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{getDoctorName(d)}</td>
                    <td style={{ ...tdStyle, color: 'var(--primary)' }}>{d.specialties || d.specialty || 'Chưa cập nhật'}</td>
                    <td style={tdStyle}>{d.position || 'Chưa cập nhật'}</td>
                    <td style={tdStyle}>
                      <span className={`badge ${getDoctorStatus(d) === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                        {getDoctorStatus(d)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {activeTab === 'diagnosis' && (
            <>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  {['ID', 'Bệnh Nhân', 'Bệnh Lý', 'Điều Trị', 'Bác Sĩ Phụ Trách', 'Trạng Thái'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.diagnoses.length === 0 && <EmptyRow cols={6} />}
                {data.diagnoses.map((d) => (
                  <tr key={d.id} style={rowStyle} className="hover:bg-elevated">
                    <td style={tdStyle}><span className="mono">#{formatShortId(d.id)}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{d.patientName}</td>
                    <td style={{ ...tdStyle, color: 'var(--info)' }}>{d.disease}</td>
                    <td style={tdStyle}>{d.treatment}</td>
                    <td style={{ ...tdStyle, color: 'var(--primary)' }}>{d.doctor?.doctorName || d.doctor?.name || 'Chưa cập nhật'}</td>
                    <td style={tdStyle}>
                      <span className={`badge ${d.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {activeTab === 'blockchain' && (
            <>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  {['Tx ID', 'Hash Giao Dịch', 'Hành Động', 'Ngày Giờ', 'Trạng Thái Mạng'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transactions.length === 0 && <EmptyRow cols={5} />}
                {data.transactions.map((tx) => (
                  <tr key={tx.id} style={rowStyle} className="hover:bg-elevated">
                    <td style={tdStyle}><span className="mono">#{formatShortId(tx.id)}</span></td>
                    <td style={{ ...tdStyle }} className="mono text-muted">
                      {formatHash(tx.txHash || tx.transactionId)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{tx.action || 'Đăng ký dữ liệu'}</td>
                    <td style={tdStyle}>{formatDateTime(tx.timestamp || tx.confirmTime)}</td>
                    <td style={tdStyle}>
                      <span className={`badge ${getTransactionStatus(tx) === 'CONFIRMED' || getTransactionStatus(tx) === 'SUCCESS' ? 'badge-success' : 'badge-warning'}`}>
                        {getTransactionStatus(tx)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {activeTab === 'ai' && (
            <>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  {['Model ID', 'Tên Hệ Thống AI', 'Phiên Bản', 'Chuyên Khoa Đề Xuất', 'Blockchain', 'Tx Hash'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.aimodels.length === 0 && <EmptyRow cols={6} />}
                {data.aimodels.map((m) => (
                  <tr key={m.id} style={rowStyle} className="hover:bg-elevated">
                    <td style={tdStyle}><span className="mono">{m.modelId || formatShortId(m.id)}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--info)' }}>{m.name || m.modelName}</td>
                    <td style={{ ...tdStyle }} className="mono">{m.modelVersion || m.version || 'Chưa cập nhật'}</td>
                    <td style={tdStyle}>{m.recommendedSpecialty || 'Chưa cập nhật'}</td>
                    <td style={tdStyle}>
                      <span className={`badge ${getAiModelStatus(m) === 'ON_CHAIN' ? 'badge-success' : 'badge-warning'}`}>
                        {getAiModelStatus(m)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle }} className="mono text-muted">
                      {formatHash(m.blockchainTxHash)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto var(--space-5)' }} />
          <div style={{ fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' }}>
            Đang tải dữ liệu bệnh viện...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', background: 'var(--bg)' }}>

      {/* ── Reusable Sidebar ── */}
      <Sidebar
        items={ADMIN_NAV}
        activeId={activeTab}
        onSelect={setActiveTab}
        title="Quản lý Bệnh viện"
        titleIcon=""
        badgeLabel="Verified Admin"
        userEmail={user?.email}
      />

      {/* ── Main content ── */}
      <main className="dashboard-main" style={{ flex: 1, padding: 'var(--space-8)', maxWidth: '1280px', margin: '0 auto' }}>
        <MobileTabNav items={ADMIN_NAV} activeId={activeTab} onSelect={setActiveTab} />

        {/* Page header */}
        <div className="dashboard-page-header" style={{ marginBottom: 'var(--space-8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--space-1)' }}>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                {activeItem?.label}
              </h1>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {countLabel[activeTab]}
            </p>
          </div>

          {/* Action button — only on doctor tab */}
          {activeTab === 'doctor' && (
            <button
              className="btn btn-primary dashboard-create-btn"
              onClick={() => setShowCreateDoctor(true)}
              style={{ whiteSpace: 'nowrap', padding: '10px 20px', fontWeight: 700 }}
            >
              + Thêm bác sĩ
            </button>
          )}

          {activeTab === 'ai' && (
            <button
              className="btn btn-primary dashboard-create-btn"
              onClick={() => setShowCreateAiModel(true)}
              style={{ whiteSpace: 'nowrap', padding: '10px 20px', fontWeight: 700 }}
            >
              + Thêm Model AI
            </button>
          )}
        </div>

        {tableContent}
        <MobileDataList activeTab={activeTab} data={data} />
      </main>

      {/* ── Create Doctor Modal ── */}
      <CreateDoctorModal
        open={showCreateDoctor}
        onClose={() => setShowCreateDoctor(false)}
        onSuccess={async () => {
          await loadHospitalData();
          setShowCreateDoctor(false);
        }}
      />

      <CreateAiModelModal
        open={showCreateAiModel}
        onClose={() => setShowCreateAiModel(false)}
        onSuccess={async () => {
          await loadHospitalData();
          setShowCreateAiModel(false);
        }}
      />
    </div>
  );
}

/* ── Shared helpers ── */
function EmptyRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Không có dữ liệu
      </td>
    </tr>
  );
}

function MobileTabNav({ items, activeId, onSelect }) {
  return (
    <div className="mobile-section-tabs" aria-label="Dashboard sections">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={activeId === item.id ? 'active' : ''}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MobileDataList({ activeTab, data }) {
  if (activeTab === 'doctor') {
    return (
      <div className="mobile-card-list">
        {data.doctors.length === 0 && <MobileEmptyState />}
        {data.doctors.map((doctor) => (
          <article className="mobile-data-card" key={doctor.id}>
            <div className="mobile-card-title-row">
              <div>
                <span className="mobile-card-kicker">#{formatShortId(doctor.id)}</span>
                <h2>{getDoctorName(doctor)}</h2>
              </div>
              <span className={`badge ${getDoctorStatus(doctor) === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                {getDoctorStatus(doctor)}
              </span>
            </div>
            <MobileField label="Chuyên khoa" value={doctor.specialties || doctor.specialty || 'Chưa cập nhật'} />
            <MobileField label="Chức vụ" value={doctor.position || 'Chưa cập nhật'} />
            <MobileField label="Email" value={doctor.user?.email || doctor.email || 'Chưa cập nhật'} />
          </article>
        ))}
      </div>
    );
  }

  if (activeTab === 'diagnosis') {
    return (
      <div className="mobile-card-list">
        {data.diagnoses.length === 0 && <MobileEmptyState />}
        {data.diagnoses.map((diagnosis) => (
          <article className="mobile-data-card" key={diagnosis.id}>
            <div className="mobile-card-title-row">
              <div>
                <span className="mobile-card-kicker">#{formatShortId(diagnosis.id)}</span>
                <h2>{diagnosis.patientName || 'Chưa cập nhật'}</h2>
              </div>
              <span className={`badge ${diagnosis.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                {diagnosis.status || 'UNKNOWN'}
              </span>
            </div>
            <MobileField label="Bệnh lý" value={diagnosis.disease || 'Chưa cập nhật'} />
            <MobileField label="Điều trị" value={diagnosis.treatment || 'Chưa cập nhật'} />
            <MobileField label="Bác sĩ" value={diagnosis.doctor?.doctorName || diagnosis.doctor?.name || 'Chưa cập nhật'} />
          </article>
        ))}
      </div>
    );
  }

  if (activeTab === 'blockchain') {
    return (
      <div className="mobile-card-list">
        {data.transactions.length === 0 && <MobileEmptyState />}
        {data.transactions.map((tx) => (
          <article className="mobile-data-card" key={tx.id}>
            <div className="mobile-card-title-row">
              <div>
                <span className="mobile-card-kicker">#{formatShortId(tx.id)}</span>
                <h2>{tx.action || 'Đăng ký dữ liệu'}</h2>
              </div>
              <span className={`badge ${getTransactionStatus(tx) === 'CONFIRMED' || getTransactionStatus(tx) === 'SUCCESS' ? 'badge-success' : 'badge-warning'}`}>
                {getTransactionStatus(tx)}
              </span>
            </div>
            <MobileField label="Hash" value={formatHash(tx.txHash || tx.transactionId)} mono />
            <MobileField label="Ngày giờ" value={formatDateTime(tx.timestamp || tx.confirmTime)} />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="mobile-card-list">
      {data.aimodels.length === 0 && <MobileEmptyState />}
      {data.aimodels.map((model) => (
        <article className="mobile-data-card" key={model.id}>
          <div className="mobile-card-title-row">
            <div>
              <span className="mobile-card-kicker">#{formatShortId(model.id)}</span>
              <h2>{model.name || model.modelName || 'Chưa cập nhật'}</h2>
            </div>
            <span className={`badge ${getAiModelStatus(model) === 'ON_CHAIN' ? 'badge-success' : 'badge-warning'}`}>
              {getAiModelStatus(model)}
            </span>
          </div>
          <MobileField label="Model ID" value={model.modelId || 'Chưa cập nhật'} mono />
          <MobileField label="Phiên bản" value={model.modelVersion || model.version || 'Chưa cập nhật'} mono />
          <MobileField label="Chuyên khoa đề xuất" value={model.recommendedSpecialty || 'Chưa cập nhật'} />
          <MobileField label="Tx Hash" value={formatHash(model.blockchainTxHash)} mono />
        </article>
      ))}
    </div>
  );
}

function MobileField({ label, value, mono = false }) {
  return (
    <div className="mobile-field">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
    </div>
  );
}

function MobileEmptyState() {
  return (
    <div className="mobile-empty-state">
      Không có dữ liệu
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

const thStyle = {
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'left',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle  = { padding: 'var(--space-3) var(--space-4)', verticalAlign: 'middle', fontSize: 'var(--text-sm)' };
const rowStyle = { borderBottom: '1px solid var(--border)', transition: 'background var(--transition-fast)' };
