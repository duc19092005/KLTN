import { useState, useEffect, useRef } from 'react';
import { useThemeLang } from '../contexts/ThemeLangContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function DiagnosisWorkflow({ doctorId, onClose, onSuccess, existingDiagnosis = null }) {
  const { theme } = useThemeLang();
  const { user } = useAuth();
  const dark = theme === 'dark';

  // If reviewing existing diagnosis, start at step 2
  const [step, setStep] = useState(existingDiagnosis ? 2 : 1);

  // Step 1 state
  const [query, setQuery]           = useState('');
  const [patients, setPatients]     = useState([]);
  const [selPatient, setSelPatient] = useState(null);
  const [searching, setSearching]   = useState(false);
  const [showDrop, setShowDrop]     = useState(false);
  const dropRef = useRef(null);

  const [models, setModels]         = useState([]);
  const [selModel, setSelModel]     = useState('');

  const [imgFile, setImgFile]       = useState(null);
  const [imgPrev, setImgPrev]       = useState(null);

  // Step 2 state
  const [diagId, setDiagId]         = useState(null);
  const [aiResult, setAiResult]     = useState(null);
  const [conclusion, setConclusion] = useState('');
  const [treatment, setTreatment]   = useState('');
  const [noteText, setNoteText]     = useState('');

  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [status, setStatus]         = useState('');

  // Load AI models
  useEffect(() => {
    api.get('/ai-model/list').then(r => setModels(r.data || [])).catch(() => {});
  }, []);

  // Load existing diagnosis data if in review mode
  useEffect(() => {
    if (existingDiagnosis) {
      setDiagId(existingDiagnosis.id || existingDiagnosis.diagnosisId);
      setAiResult(existingDiagnosis.aiResults || existingDiagnosis);
      // Pre-populate patient info if available
      if (existingDiagnosis.patientName) {
        setSelPatient({ name: existingDiagnosis.patientName });
        setQuery(existingDiagnosis.patientName);
      }
    }
  }, [existingDiagnosis]);

  // Search patients with debounce
  useEffect(() => {
    if (query.length < 2) { setPatients([]); setShowDrop(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get('/hospital/patients', { params: { search: query } });
        const list = Array.isArray(r.data) ? r.data : (r.data?.patients || r.data?.data || []);
        setPatients(list.slice(0, 8));
        setShowDrop(list.length > 0);
      } catch { setPatients([]); setShowDrop(false); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const pickPatient = p => {
    setSelPatient(p);
    setQuery(p.name || p.patientName || p.fullName || '');
    setShowDrop(false);
  };

  const handleImg = e => {
    const f = e.target.files[0];
    if (!f) return;
    setImgFile(f);
    const r = new FileReader();
    r.onloadend = () => setImgPrev(r.result);
    r.readAsDataURL(f);
  };

  // ── STEP 1: AI Diagnose ──────────────────────────────────────────────────
  const handleDiagnose = async e => {
    e.preventDefault();
    if (!doctorId) { setError('Lỗi: Không tìm thấy hồ sơ Bác sĩ (Doctor Profile).'); return; }
    if (!selPatient) { setError('Vui lòng chọn bệnh nhân'); return; }
    if (!selModel)   { setError('Vui lòng chọn model AI'); return; }
    if (!imgFile)    { setError('Vui lòng upload ảnh'); return; }
    setError(''); setLoading(true); setStatus('Đang gửi đến Model AI...');
    try {
      const fd = new FormData();
      fd.append('image', imgFile);
      fd.append('patientName',         selPatient.name || selPatient.patientName || selPatient.fullName || '');
      fd.append('clinicalSymptoms',    selPatient.clinicalSymptoms || selPatient.symptoms || selPatient.diagnosis || '');
      fd.append('preliminaryTreatment',selPatient.treatment || selPatient.preliminaryTreatment || 'Chờ kết luận');
      fd.append('doctorNotes',         '');
      fd.append('aiModelId',           selModel);
      fd.append('doctorId',            doctorId);
      setStatus('Model AI đang phân tích hình ảnh...');
      const res = await api.post('/hospital/diagnose', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDiagId(res.data.diagnosisId);
      setAiResult(res.data.aiResults);
      setStatus('Chuẩn đoán AI hoàn tất!');
      setTimeout(() => { setStep(2); setStatus(''); }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi chuẩn đoán');
    } finally { setLoading(false); }
  };

  // ── STEP 2: Conclude & Blockchain ────────────────────────────────────────
  const handleConclude = async e => {
    e.preventDefault();
    setError(''); setLoading(true); setStatus('Đang băm SHA-512 & ghi Blockchain...');
    try {
      const res = await api.post('/hospital/conclude', { diagnosisId: diagId, finalConclusion: conclusion, treatmentRegimen: treatment, note: noteText });
      const tx = res.data.blockchainTxHash;
      setStatus(`Thành công! TX: ${tx ? tx.slice(0, 14) + '...' : 'N/A'}`);
      setTimeout(() => { onSuccess?.(); onClose?.(); }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi ghi blockchain');
    } finally { setLoading(false); }
  };

  // ── Shared style helpers ─────────────────────────────────────────────────
  const inputCls = `w-full px-4 py-3 rounded-lg border text-sm outline-none transition-all
    focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500
    ${dark ? 'bg-[#0a192f] border-white/10 text-[#d8e2ff] placeholder:text-slate-500'
            : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

  const labelCls = `block text-[11px] font-bold uppercase tracking-wider mb-2
    ${dark ? 'text-slate-400' : 'text-slate-500'}`;

  const modalBg  = dark ? 'bg-[#0d2137] border-white/8' : 'bg-white border-slate-200';
  const headerBg = dark ? 'bg-[#071526] border-white/8' : 'bg-slate-50 border-slate-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden ${modalBg}`}>

        {/* ── Header ── */}
        <div className={`px-6 py-4 border-b ${headerBg}`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className={`text-base font-bold ${dark ? 'text-[#d8e2ff]' : 'text-slate-800'}`}>
                {existingDiagnosis ? 'Xem Lại & Kết Luận Chẩn Đoán' : 'Chẩn Đoán AI Lâm Sàng'}
              </h2>
              <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {existingDiagnosis 
                  ? 'Xem lại kết quả AI · Đưa ra kết luận chuyên môn & Xác nhận Blockchain'
                  : `Bước ${step}/2 · ${step === 1 ? 'Chuẩn đoán sơ bộ bằng AI' : 'Kết luận chuyên môn & Blockchain'}`
                }
              </p>
            </div>
            <button onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Step bar - only show when creating new diagnosis */}
          {!existingDiagnosis && (
            <div className="flex items-center gap-3 mt-4">
              {[1, 2].map((n, i) => (
                <div key={n} className={`flex items-center gap-2 ${i === 1 ? 'flex-1' : ''}`}>
                  {i === 1 && <div className={`flex-1 h-px ${step >= 2 ? 'bg-teal-500' : dark ? 'bg-white/10' : 'bg-slate-200'}`}/>}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                    ${step > n  ? 'bg-teal-500 border-teal-500 text-white'
                    : step === n ? 'bg-transparent border-teal-500 text-teal-500'
                    : dark ? 'bg-transparent border-white/20 text-slate-500' : 'bg-transparent border-slate-200 text-slate-400'}`}>
                    {step > n ? '✓' : n}
                  </div>
                  <span className={`text-xs font-semibold hidden sm:block ${step === n ? (dark ? 'text-[#d8e2ff]' : 'text-slate-700') : (dark ? 'text-slate-500' : 'text-slate-400')}`}>
                    {n === 1 ? 'Sơ bộ AI' : 'Kết luận'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">

          {/* Alerts */}
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          {status && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
              {status}
            </div>
          )}

          {/* ════ STEP 1 ════ */}
          {step === 1 && (
            <form onSubmit={handleDiagnose} className="flex flex-col gap-5">

              {/* Search patient */}
              <div ref={dropRef} className="relative">
                <label className={labelCls}>Tìm kiếm bệnh nhân *</label>
                <div className="relative">
                  <input
                    className={inputCls + ' pl-10'}
                    placeholder="Nhập tên hoặc mã bệnh nhân..."
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelPatient(null); }}
                    onFocus={() => patients.length > 0 && setShowDrop(true)}
                    autoComplete="off"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {searching
                      ? <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"/>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? '#475569' : '#94a3b8'} strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                    }
                  </div>
                </div>

                {/* Dropdown */}
                {showDrop && patients.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-xl overflow-hidden
                    ${dark ? 'bg-[#0a192f] border-white/10' : 'bg-white border-slate-200'}`}>
                    {patients.map((p, i) => (
                      <button key={p.id || i} type="button" onClick={() => pickPatient(p)}
                        className={`w-full text-left px-4 py-3 transition-colors
                          ${dark ? 'hover:bg-teal-500/10 border-b border-white/5 last:border-0'
                                 : 'hover:bg-teal-50 border-b border-slate-100 last:border-0'}`}>
                        <div className={`text-sm font-semibold ${dark ? 'text-[#d8e2ff]' : 'text-slate-800'}`}>
                          {p.name || p.patientName || p.fullName || 'N/A'}
                        </div>
                        <div className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {[p.id && `ID: ${String(p.id).slice(0,8)}`, p.age && `${p.age} tuổi`, p.gender].filter(Boolean).join(' · ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected badge */}
                {selPatient && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
                    <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"/>
                    <span className="text-xs font-semibold text-teal-400">
                      Đã chọn: {selPatient.name || selPatient.patientName || selPatient.fullName}
                    </span>
                  </div>
                )}
              </div>

              {/* Select model */}
              <div>
                <label className={labelCls}>Chọn Model AI *</label>
                <select value={selModel} onChange={e => setSelModel(e.target.value)} className={inputCls} required>
                  <option value="">-- Chọn model AI --</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.modelName}{m.modelVersion ? ` v${m.modelVersion}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload ảnh */}
              <div>
                <label className={labelCls}>Upload Ảnh *</label>
                <div
                  onClick={() => document.getElementById('dx-img').click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                    ${dark ? 'border-white/10 hover:border-teal-500/50 bg-[#0a192f]/50'
                           : 'border-slate-200 hover:border-teal-400 bg-slate-50'}`}>
                  {imgPrev ? (
                    <div className="relative inline-block">
                      <img src={imgPrev} alt="preview" className="max-h-40 max-w-full rounded-lg object-contain mx-auto"/>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setImgFile(null); setImgPrev(null); }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto mb-2 opacity-40" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dark ? '#94a3b8' : '#64748b'} strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Click để chọn ảnh chẩn đoán</p>
                      <p className={`text-xs mt-1 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>PNG, JPG, JPEG · Tối đa 10MB</p>
                    </>
                  )}
                </div>
                <input id="dx-img" type="file" accept="image/*" onChange={handleImg} className="hidden"/>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} disabled={loading}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors
                    ${dark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  Hủy
                </button>
                <button type="submit"
                  disabled={loading || !selPatient || !selModel || !imgFile}
                  className="flex-[2] py-3 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Đang xử lý...</>
                    : 'Chuẩn Đoán'}
                </button>
              </div>
            </form>
          )}

          {/* ════ STEP 2 ════ */}
          {step === 2 && (
            <form onSubmit={handleConclude} className="flex flex-col gap-5">

              {/* AI Results */}
              {aiResult && (() => {
                let parsed = {};
                let findings = '';
                let explanation = '';
                let recommendations = '';
                
                try {
                  const fullResult = JSON.parse(aiResult.aiDiagnoseConfidentResults || '{}');
                  parsed = fullResult.diagnoses || fullResult;
                  findings = fullResult.findings || '';
                  explanation = fullResult.explanation || '';
                  recommendations = fullResult.recommendations || '';
                } catch {}
                
                return Object.keys(parsed).length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {/* Diagnoses */}
                    <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0a192f] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-3">Kết Quả Chẩn Đoán AI</p>
                      <div className="flex flex-col gap-2">
                        {Object.entries(parsed).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-3">
                            <span className={`text-xs w-32 truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{k}</span>
                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>
                              <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${Math.round(Number(v)*100)}%` }}/>
                            </div>
                            <span className={`text-xs font-bold font-mono w-12 text-right ${dark ? 'text-[#d8e2ff]' : 'text-slate-700'}`}>
                              {(Number(v)*100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Findings */}
                    {findings && (
                      <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0a192f] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">Phát Hiện Từ Ảnh</p>
                        <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{findings}</p>
                      </div>
                    )}

                    {/* Explanation */}
                    {explanation && (
                      <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0a192f] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">Giải Thích</p>
                        <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{explanation}</p>
                      </div>
                    )}

                    {/* Recommendations */}
                    {recommendations && (
                      <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0a192f] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-2">Đề Xuất</p>
                        <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{recommendations}</p>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              <div>
                <label className={labelCls}>Kết Luận Chuyên Môn *</label>
                <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} rows={4} required
                  placeholder="Nhập kết luận chuyên môn của bác sĩ..."
                  className={inputCls + ' resize-none'}/>
              </div>

              <div>
                <label className={labelCls}>Phác Đồ Điều Trị *</label>
                <textarea value={treatment} onChange={e => setTreatment(e.target.value)} rows={3} required
                  placeholder="Nhập phác đồ điều trị..."
                  className={inputCls + ' resize-none'}/>
              </div>

              <div>
                <label className={labelCls}>Ghi Chú</label>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                  placeholder="Ghi chú thêm (tùy chọn)..."
                  className={inputCls + ' resize-none'}/>
              </div>

              <div className="flex gap-3 pt-1">
                {!existingDiagnosis && (
                  <button type="button" onClick={() => setStep(1)} disabled={loading}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors
                      ${dark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Quay lại
                  </button>
                )}
                <button type="submit"
                  disabled={loading || !conclusion || !treatment}
                  className={`${existingDiagnosis ? 'flex-1' : 'flex-[2]'} py-3 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2`}>
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Đang ghi blockchain...</>
                    : 'Xác Nhận & Ghi Blockchain'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
