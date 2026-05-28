import React, { useState, useEffect } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { visitService } from '../apis/visitService';

export default function CreateVisitForm({ patient, onVisitCreated, onCancel }) {
  const [specialty, setSpecialty] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchRooms = async (searchSpecialty = '') => {
    setLoadingRooms(true); setError('');
    try {
      const res = await visitService.suggestRooms(searchSpecialty);
      setRooms(res.data || []);
      setSelectedRoom(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách phòng khám');
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSearchSpecialty = (e) => {
    e.preventDefault();
    fetchRooms(specialty);
  };

  const handleCreateVisit = async () => {
    if (!selectedRoom) return setError('Vui lòng chọn phòng khám');
    setCreating(true); setError('');
    try {
      const payload = {
        patientId: patient.id,
        clinicalRoomId: selectedRoom.id,
        doctorId: selectedRoom.doctorId,
        symptoms: symptoms.trim(),
      };
      const res = await visitService.create(payload);
      onVisitCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tạo lượt khám');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Tạo Lượt Khám Mới</h2>
          <p className="text-sm text-slate-500 mt-1">Bệnh nhân: <strong className="text-cyan-700">{patient.fullName}</strong> ({patient.patientCode})</p>
        </div>
        <button onClick={onCancel} className="text-sm font-bold text-slate-400 hover:text-slate-700 underline">Đổi bệnh nhân</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1">Triệu chứng lâm sàng / Lý do khám</label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Mô tả triệu chứng của bệnh nhân..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-[12px] font-bold text-slate-600 mb-1">Đề xuất chuyên khoa / Phòng khám</label>
          <form onSubmit={handleSearchSpecialty} className="flex gap-2 mb-3">
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Nhập chuyên khoa (VD: Tim mạch, Nội tổng quát...)"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
            />
            <button type="submit" disabled={loadingRooms} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl disabled:opacity-50">
              {loadingRooms ? <LoadingIndicator size="sm" /> : 'Lọc'}
            </button>
          </form>

          {rooms.length === 0 && !loadingRooms && (
            <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
              Không có phòng khám nào đang hoạt động hoặc phù hợp.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-2">
            {rooms.map(room => {
              const doctor = room.doctor?.staffProfile;
              const isSelected = selectedRoom?.id === room.id;
              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${isSelected ? 'bg-cyan-50 border-cyan-400 shadow-sm ring-1 ring-cyan-400' : 'bg-white border-slate-200 hover:border-cyan-300'}`}
                >
                  <p className={`font-black text-sm ${isSelected ? 'text-cyan-800' : 'text-slate-800'}`}>{room.roomName} ({room.roomCode})</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0">
                      {doctor?.avatarUrl ? <img src={doctor.avatarUrl} alt="Doctor" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">BS</div>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 line-clamp-1">{doctor ? `BS. ${doctor.fullName}` : 'Chưa phân bổ BS'}</p>
                      <p className="text-[10px] text-slate-500">{room.doctor?.specialty || 'Đa khoa'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm font-bold text-center">{error}</p>}

        <div className="pt-4 flex gap-3">
          <button type="button" onClick={onCancel} className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Hủy bỏ</button>
          <button onClick={handleCreateVisit} disabled={creating || !selectedRoom} className="flex-1 px-5 py-3 bg-cyan-600 text-white rounded-xl text-sm font-black hover:bg-cyan-700 disabled:opacity-60 shadow-md shadow-cyan-200 transition-all">
            {creating ? <LoadingIndicator size="sm" tone="white" /> : 'Xác nhận tạo lượt khám'}
          </button>
        </div>
      </div>
    </div>
  );
}
