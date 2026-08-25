import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, Check, Trash2, AlertCircle, SlidersHorizontal, CheckCheck, Calendar, X } from 'lucide-react';
import api from '../apis/api';
import { useToast } from '../../providers/ToastProvider';

// Read-state filter options for the segmented control. Maps to the backend `isRead` query param.
const READ_FILTERS = [
  { id: 'all', label: 'Tất cả', param: undefined },
  { id: 'unread', label: 'Chưa đọc', param: 'false' },
  { id: 'read', label: 'Đã đọc', param: 'true' },
];

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const toast = useToast();

  // Filters (server-side): read-state segment + optional date range.
  const [readFilter, setReadFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasDateFilter = Boolean(fromDate || toDate);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = {};
      const rf = READ_FILTERS.find((f) => f.id === readFilter);
      if (rf?.param !== undefined) params.isRead = rf.param;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await api.get('/notifications', { params });
      const data = res.data?.data ?? res.data ?? [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [readFilter, fromDate, toDate]);

  useEffect(() => {
    fetchNotifications();

    // Setup real-time updates via Server-Sent Events (SSE)
    const sseUrl = `${api.defaults.baseURL || '/api'}/notifications/sse`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'ping') {
          return;
        }

        setNotifications((prev) => {
          if (prev.some((n) => n.id === payload.id)) {
            return prev;
          }
          return [payload, ...prev];
        });

        toast.info(payload.message || 'Có thông báo mới');

        const customEvent = new CustomEvent('app:notification-received', { detail: payload });
        window.dispatchEvent(customEvent);
      } catch (err) {
        console.error('Failed to parse real-time notification:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchNotifications, toast]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleMarkAsRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      toast.error('Không thể cập nhật trạng thái thông báo.');
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Đã xóa thông báo.');
    } catch (err) {
      toast.error('Không thể xóa thông báo.');
    }
  }

  async function handleMarkAllAsRead() {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('Đã đánh dấu tất cả là đã đọc.');
      fetchNotifications();
    } catch (err) {
      toast.error('Có lỗi xảy ra khi cập nhật.');
    }
  }

  function clearDateFilter() {
    setFromDate('');
    setToDate('');
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return 'Vừa xong';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  }

  return (
    <div className="relative antialiased" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        id="notification-bell-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-600 transition-all border outline-none shadow-xs ${
          isOpen ? 'border-sky-300 ring-2 ring-sky-100 text-sky-600' : 'border-slate-200'
        }`}
        title="Thông báo hệ thống"
      >
        {unreadCount > 0 ? (
          <>
            <BellRing className="w-5 h-5 text-sky-600 animate-pulse" strokeWidth={2} />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white ring-2 ring-white shadow-xs">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-5 h-5 text-slate-400" strokeWidth={2} />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl border border-slate-200/80 bg-white shadow-2xl z-[100] overflow-hidden transform origin-top-right transition-all animate-fadeIn">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Thông báo hệ thống</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-700">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                    showFilters || hasDateFilter
                      ? 'bg-sky-100 text-sky-700 border border-sky-200'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Bộ lọc ngày"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Lọc</span>
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Đọc tất cả</span>
                  </button>
                )}
              </div>
            </div>

            {/* Read-state segmented control */}
            <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
              {READ_FILTERS.map((f) => {
                const count = f.id === 'unread' ? unreadCount : f.id === 'all' ? notifications.length : notifications.filter(n => n.isRead).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setReadFilter(f.id)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      readFilter === f.id ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${readFilter === f.id ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Date range filter (collapsible) */}
            {showFilters && (
              <div className="space-y-2 pt-1 border-t border-slate-200/60 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Từ ngày
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Đến ngày
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
                {hasDateFilter && (
                  <button
                    type="button"
                    onClick={clearDateFilter}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Xóa bộ lọc ngày
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 stroke-[1.75]" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {readFilter === 'unread'
                    ? 'Không có thông báo chưa đọc'
                    : hasDateFilter
                    ? 'Không có thông báo trong khoảng thời gian này'
                    : 'Chưa có thông báo mới nào'}
                </p>
                <p className="text-[11px] font-medium text-slate-400 mt-1">
                  Hệ thống sẽ tự động cập nhật khi có lượt khám mới hoặc chỉ định cận lâm sàng.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  className={`p-4 flex gap-3.5 hover:bg-sky-50/40 cursor-pointer transition-colors ${
                    !n.isRead ? 'bg-sky-50/20' : 'bg-white'
                  }`}
                >
                  {/* Icon indicator */}
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        !n.isRead
                          ? 'bg-sky-100 text-sky-700 border border-sky-200'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${!n.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-600'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words font-medium">
                      {n.message}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {!n.isRead ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(n.id);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-100 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Đánh dấu đã đọc
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">Đã đọc</span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDelete(n.id, e)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors ml-auto"
                        title="Xóa thông báo"
                      >
                        <Trash2 className="w-3 h-3" />
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
