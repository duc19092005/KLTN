import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { clinicalRoomService } from '../apis/clinicalRoomService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

const emptyRoom = { roomCode: '', roomName: '', floor: '', description: '', status: 'ACTIVE' };
function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getError(err) { return err?.response?.data?.message || err.message || 'Thao tác thất bại'; }

export default function ClinicalRoomsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({ roomCode: '', roomName: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [form, setForm] = useState(emptyRoom);
  const [editing, setEditing] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const totalLabel = useMemo(() => `${pagination.total} phòng khám`, [pagination.total]);

  const load = async (page = pagination.page) => {
    setLoading(true);
    try {
      const roomRes = await clinicalRoomService.search({ ...filters, page, limit: pagination.limit });
      const data = roomRes.data || {};
      setRooms(getItems(data));
      if (!Array.isArray(data)) setPagination({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
    } catch (err) { toast.error(getError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyRoom); setIsOpen(true); };
  const openEdit = (room) => { setEditing(room); setForm({ roomCode: room.roomCode || '', roomName: room.roomName || '', floor: room.floor || '', description: room.description || '', status: room.status || 'ACTIVE' }); setIsOpen(true); };
  const close = () => { setIsOpen(false); setEditing(null); setForm(emptyRoom); };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { ...form };
      if (editing) {
        await clinicalRoomService.update(editing.id, payload);
        toast.success('Cập nhật phòng khám thành công!');
      } else {
        await clinicalRoomService.create(payload);
        toast.success('Thêm phòng khám thành công!');
      }
      close(); await load(editing ? pagination.page : 1);
    } catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };
  const remove = async (room) => {
    if (!confirm(`Xóa phòng khám ${room.roomName}?`)) return;
    setBusy(true);
    try {
      await clinicalRoomService.remove(room.id);
      toast.success('Xóa phòng khám thành công!');
      await load(pagination.page);
    }
    catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };
  const search = async (event) => { event.preventDefault(); await load(1); };

  return <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="clinicalRooms" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}><div className="max-w-7xl mx-auto space-y-6"><Hero onCreate={openCreate} totalLabel={totalLabel} />{loading ? <LoadingIndicator size="lg" label="Đang tải phòng khám..." /> : <><SearchBar filters={filters} setFilters={setFilters} onSearch={search} /><section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100"><h3 className="text-xl font-black text-slate-950">Danh sách phòng khám</h3><p className="text-sm text-slate-500">Quản lý các phòng khám bệnh trong bệnh viện.</p></div><div className="divide-y divide-slate-100">{rooms.map((room) => <RoomRow key={room.id} room={room} onEdit={openEdit} onRemove={remove} busy={busy} />)}{!rooms.length && <div className="p-6 text-center text-sm text-slate-500">Chưa có phòng khám.</div>}</div><Pagination pagination={pagination} onPageChange={load} /></section></>}{isOpen && <RoomModal form={form} setForm={setForm} onSubmit={submit} onClose={close} busy={busy} editing={editing} />}</div></DashboardLayout>;
}
function Hero({ onCreate, totalLabel }) { return <section className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-emerald-50 p-8 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.24em] mb-3">Clinical Room OS</p><h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Quản lý phòng khám</h2><p className="mt-3 text-sm sm:text-base text-slate-600">Tạo phòng khám và kiểm soát trạng thái hoạt động.</p><span className="mt-4 inline-flex rounded-xl bg-white/80 px-3 py-1 text-xs font-black text-cyan-700 border border-cyan-100">{totalLabel}</span></div><button onClick={onCreate} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 hover:bg-cyan-700">+ Thêm phòng khám</button></section>; }
function SearchBar({ filters, setFilters, onSearch }) { return <form onSubmit={onSearch} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3 items-end"><Input label="Mã phòng" value={filters.roomCode} onChange={(v) => setFilters({ ...filters, roomCode: v })} /><Input label="Tên phòng" value={filters.roomName} onChange={(v) => setFilters({ ...filters, roomName: v })} /><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">Tìm kiếm</button></form>; }
function RoomRow({ room, onEdit, onRemove, busy }) { return <article className="p-5 hover:bg-slate-50/70"><div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.8fr_180px] gap-4 lg:items-center"><Info label="Mã phòng" value={room.roomCode} /><Info label="Tên phòng" value={room.roomName} /><span className="w-fit rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{room.status}</span><div className="flex gap-2 lg:justify-end"><SmallButton onClick={() => onEdit(room)} disabled={busy}>Sửa</SmallButton><SmallButton danger onClick={() => onRemove(room)} disabled={busy}>Xóa</SmallButton></div></div></article>; }
function RoomModal({ form, setForm, onSubmit, onClose, busy, editing }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4"><div className="flex justify-between gap-4"><div><p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.18em]">Clinical setup</p><h3 className="text-2xl font-black text-slate-950">{editing ? 'Cập nhật phòng khám' : 'Thêm phòng khám'}</h3></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Mã phòng" value={form.roomCode} onChange={(v) => setForm({ ...form, roomCode: v })} required /><Input label="Tên phòng" value={form.roomName} onChange={(v) => setForm({ ...form, roomName: v })} required /><Input label="Tầng" value={form.floor} onChange={(v) => setForm({ ...form, floor: v })} /><Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'ACTIVE', label: 'ACTIVE' }, { value: 'INACTIVE', label: 'INACTIVE' }]} /><Input label="Mô tả" value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></div><button disabled={busy} className="w-full rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-70">{editing ? 'Lưu thay đổi' : 'Tạo phòng khám'}</button></form></div>; }
function Pagination({ pagination, onPageChange }) { return <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p><div className="flex gap-2"><SmallButton disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trước</SmallButton><SmallButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Sau</SmallButton></div></div>; }
function Info({ label, value }) { return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="text-sm font-bold text-slate-700">{value}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${danger ? 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-cyan-50 hover:text-cyan-600'}`}>{children}</button>; }
function Input({ label, value, onChange, required, type = 'text' }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input type={type} required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none" /></label>; }
function Select({ label, value, onChange, options, empty }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none">{empty && <option value="">{empty}</option>}{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
