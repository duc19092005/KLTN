import { useState } from 'react';
import api from '../services/api';
import FaceCapture from './FaceCapture';

export default function BackupDashboardView({ data = { full: [], wal: [] }, onRefresh }) {
  const [activeSubTab, setActiveSubTab] = useState('full');
  const [triggering, setTriggering] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmCid, setConfirmCid] = useState(null);

  // restoreStep: 'warning' | 'face' | null
  const [restoreStep, setRestoreStep] = useState(null);
  const [faceError, setFaceError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openRestoreFlow = (cid) => {
    setConfirmCid(cid);
    setFaceError('');
    setRestoreStep('warning');
  };

  const closeRestoreFlow = () => {
    setConfirmCid(null);
    setRestoreStep(null);
    setFaceError('');
  };

  const handleTriggerBackup = async () => {
    setTriggering(true);
    try {
      await api.post('/backup/trigger');
      alert('Tạo sao lưu full và đúc NFT chứng chỉ blockchain thành công!');
      onRefresh();
    } catch (err) {
      alert('Tạo sao lưu thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setTriggering(false);
    }
  };

  const handleDownload = async (cid, filename) => {
    try {
      const response = await api.get(`/backup/download?cid=${encodeURIComponent(cid)}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename.replace('.enc', '.sql'));
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Tải xuống thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  // Step 2: face scan complete → verify against server
  const handleFaceCaptured = async (embedding) => {
    setVerifying(true);
    setFaceError('');
    try {
      const res = await api.post('/face/verify', { embedding });
      if (!res.data?.match) {
        setFaceError('Khuôn mặt không khớp. Vui lòng thử lại.');
        setVerifying(false);
        return;
      }
      // Face matched → close modal and restore
      const cidToRestore = confirmCid;
      setRestoreStep(null);
      setConfirmCid(null);
      setVerifying(false);
      await doRestore(cidToRestore);
    } catch (err) {
      setFaceError('Xác minh khuôn mặt thất bại: ' + (err.response?.data?.message || err.message));
      setVerifying(false);
    }
  };

  const doRestore = async (cid) => {
    setRestoring(true);
    try {
      await api.post(`/backup/restore?cid=${encodeURIComponent(cid)}`);
      alert('Khôi phục cơ sở dữ liệu thành công! Toàn bộ bảng đã được cập nhật về trạng thái sao lưu.');
      onRefresh();
    } catch (err) {
      alert('Khôi phục thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setRestoring(false);
    }
  };

  const totalFullSize = data.full.reduce((acc, item) => acc + (item.size || 0), 0);
  const totalWalSize = data.wal.reduce((acc, item) => acc + (item.size || 0), 0);

  return (
    <div className="backup-dashboard-view fade-in">

      {/* ── Status Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>SAO LƯU HẰNG NGÀY (FULL)</span>
            <span className="badge badge-success">ACTIVE</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--primary)' }}>2:00 AM Daily</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tự động mã hóa và đúc NFT lưu trữ IPFS lúc 2h sáng.</p>
          <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tổng dung lượng: {formatBytes(totalFullSize)} ({data.full.length} checkpoints)
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>TĂNG DẦN THỜI GIAN THỰC (WAL)</span>
            <span className="badge badge-success">STREAMING</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--info)' }}>Real-time</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gửi các phân đoạn WAL log lên IPFS mỗi 1 phút.</p>
          <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tổng dung lượng: {formatBytes(totalWalSize)} ({data.wal.length} segments)
          </div>
        </div>

        <div className="card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>BẢO MẬT & TRUY XUẤT NGUỒN GỐC</span>
            <span className="badge badge-info" style={{ background: 'var(--primary)' }}>BLOCKCHAIN PROOF</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 10px 0', color: '#fff' }}>AES-256-CBC</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bản sao được băm SHA-256 và ký mã hóa trước khi đưa lên blockchain.</p>
          <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Smart Contract: <span className="mono" style={{ fontSize: '0.75rem' }}>DbBackupRegistry.sol</span>
          </div>
        </div>
      </div>

      {/* ── Action Panel ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setActiveSubTab('full')}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeSubTab === 'full' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Checkpoint Full ({data.full.length})
          </button>
          <button onClick={() => setActiveSubTab('wal')}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeSubTab === 'wal' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            WAL Logs Incremental ({data.wal.length})
          </button>
        </div>
        <button className="btn btn-primary" onClick={handleTriggerBackup} disabled={triggering}
          style={{ padding: '10px 20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {triggering ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : null}
          🚀 Tạo điểm sao lưu (Full Checkpoint)
        </button>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.93rem' }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={thStyle}>STT</th>
                <th style={thStyle}>IPFS CID</th>
                <th style={thStyle}>DUNG LƯỢNG</th>
                <th style={thStyle}>NGÀY KHỞI TẠO</th>
                <th style={thStyle}>TRẠNG THÁI</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {activeSubTab === 'full' ? (
                data.full.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Không có bản sao lưu nào. Hãy bấm "Tạo điểm sao lưu" ở trên.
                  </td></tr>
                ) : data.full.map((item, index) => (
                  <tr key={item.cid} style={rowStyle}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle} className="mono" title={item.cid}>
                      <a href="#" onClick={(e) => { e.preventDefault(); alert(item.cid); }} style={{ color: 'var(--info)', textDecoration: 'none' }}>
                        {item.cid.length > 30 ? item.cid.substring(0, 30) + '...' : item.cid}
                      </a>
                    </td>
                    <td style={tdStyle}>{formatBytes(item.size)}</td>
                    <td style={tdStyle}>{new Date(item.timestamp).toLocaleString('vi-VN')}</td>
                    <td style={tdStyle}><span className="badge badge-success">🔒 AES-256 Encrypted</span></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => handleDownload(item.cid, item.filename)} style={actionBtnStyle('var(--info)')}>📥 Tải xuống</button>
                      <button onClick={() => openRestoreFlow(item.cid)} style={actionBtnStyle('var(--warning)', '10px')}>🔄 Phục hồi</button>
                    </td>
                  </tr>
                ))
              ) : (
                data.wal.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Không tìm thấy bản ghi WAL nào.
                  </td></tr>
                ) : data.wal.map((item, index) => (
                  <tr key={item.cid} style={rowStyle}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle} className="mono" title={item.cid}>
                      <a href="#" onClick={(e) => { e.preventDefault(); alert(item.cid); }} style={{ color: 'var(--info)', textDecoration: 'none' }}>
                        {item.cid.length > 30 ? item.cid.substring(0, 30) + '...' : item.cid}
                      </a>
                    </td>
                    <td style={tdStyle}>{formatBytes(item.size)}</td>
                    <td style={tdStyle}>{new Date(item.timestamp).toLocaleString('vi-VN')}</td>
                    <td style={tdStyle}><span className="badge badge-info" style={{ background: 'var(--info)', color: '#000', fontWeight: 600 }}>⚡ WAL Increment</span></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => handleDownload(item.cid, item.filename)} style={actionBtnStyle('var(--info)')}>📥 Tải xuống</button>
                      <button onClick={() => openRestoreFlow(item.cid)} style={actionBtnStyle('var(--warning)', '10px')}>🔄 Phục hồi (Replay)</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── STEP 1: Warning Modal ── */}
      {restoreStep === 'warning' && confirmCid && (
        <div style={modalOverlayStyle}>
          <div className="card" style={{ ...modalContentStyle, maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--warning)' }}>
              ⚠️ CẢNH BÁO PHỤC HỒI HỆ THỐNG
            </h3>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Bạn đang thực hiện khôi phục toàn bộ Cơ sở dữ liệu về checkpoint:
            </p>
            <code style={{ display: 'block', margin: '8px 0 14px', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {confirmCid}
            </code>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#f87171', fontWeight: 600 }}>
              Hành động này sẽ <strong>XÓA SẠCH</strong> dữ liệu hiện tại và không thể hoàn tác!
              Bước tiếp theo yêu cầu bạn <u>quét khuôn mặt</u> để xác nhận danh tính.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn" onClick={closeRestoreFlow} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                Hủy bỏ
              </button>
              <button className="btn btn-primary" onClick={() => setRestoreStep('face')}
                style={{ background: 'var(--warning)', color: '#000', fontWeight: 700 }}>
                Tiếp tục → Xác minh khuôn mặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Face Scan Modal ── */}
      {restoreStep === 'face' && (
        <div style={modalOverlayStyle}>
          <div className="card" style={{ ...modalContentStyle, maxWidth: '500px', padding: '28px 24px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#fff' }}>
              🔐 Xác minh sinh trắc học
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Quét khuôn mặt để xác nhận danh tính Admin trước khi phục hồi database.
            </p>

            {verifying ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '30px 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang xác minh khuôn mặt...</p>
              </div>
            ) : (
              <FaceCapture
                requireLiveness={true}
                onCapture={handleFaceCaptured}
                onError={(msg) => setFaceError(msg)}
              />
            )}

            {faceError && (
              <p style={{ margin: '14px 0 0', color: '#f87171', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
                ❌ {faceError}
              </p>
            )}

            <button className="btn" onClick={closeRestoreFlow}
              style={{ marginTop: '18px', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      {/* ── Processing Overlay ── */}
      {restoring && (
        <div style={fullScreenOverlayStyle}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 20px', width: '50px', height: '50px', borderWidth: '4px', borderColor: 'var(--warning) transparent var(--warning) transparent' }} />
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', color: 'var(--warning)' }}>ĐANG PHỤC HỒI CƠ SỞ DỮ LIỆU...</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Đang giải mã bản sao và ghi đè database. Vui lòng không đóng cửa sổ!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline Styles ── */
const thStyle = { padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle', fontSize: '0.85rem' };
const rowStyle = { borderBottom: '1px solid var(--border)' };
const actionBtnStyle = (color, marginLeft = '0px') => ({ padding: '5px 10px', borderRadius: '4px', border: `1px solid ${color}`, background: 'transparent', color: color, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', marginLeft: marginLeft, transition: 'all var(--transition-fast)' });
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { maxWidth: '450px', width: '90%', padding: '25px', background: '#151922', border: '1px solid rgba(255,255,255,0.1)' };
const fullScreenOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
