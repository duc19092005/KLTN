import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, Check, Trash2, AlertCircle, SlidersHorizontal } from 'lucide-react';
import api from '../apis/api';
import { useToast } from '../../providers/ToastProvider';

// Read-state filter options for the segmented control. Maps to the backend `isRead` query param.
const READ_FILTERS = [
  { id: 'all', label: 'Tất cả', param: undefined },
  { id: 'unread', label: 'Chưa đọc', param: 'false' },
  { id: 'read', label: 'Đã đọc', param: 'true' },
];

/**
 * Notification bell + dropdown, shared across every authenticated role.
 *
 * Notifications are keyed only by userId on the backend, so this component works the same for
 * ADMIN / DOCTOR / RECEPTIONIST / LAB_MANAGER — the content differs per feature, the UI does not.
 *
 * Server-side filtering: the dropdown exposes a read-state segment (all/unread/read) and an
 * optional date range, mapped to the backend's `isRead` / `from` / `to` query params.
 */
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
          return; // ignore ping
        }

        // Add the notification to local state if it's not a duplicate
        setNotifications((prev) => {
          if (prev.some((n) => n.id === payload.id)) {
            return prev;
          }
          return [payload, ...prev];
        });

        // Trigger visual toast notification
        toast.info(payload.message || 'Có thông báo mới');

        // Dispatch global CustomEvent for real-time page updates
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

  // Close dropdown on clicking outside
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
      // Re-fetch so the "unread" filter reflects the change immediately.
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
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        id="notification-bell-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-cyan-600 transition-colors border border-slate-200 outline-none"
        title="Thông báo"
      >
        {unreadCount > 0 ? (
          <>
            <BellRing className="w-5 h-5 text-cyan-600 animate-swing" strokeWidth={2} />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="w-5 h-5 text-slate-400" strokeWidth={2} />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden transform origin-top-right transition-colors duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-800">Thông báo của bạn</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-black transition-colors ${
                    showFilters || hasDateFilter
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Bộ lọc"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Lọc
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-black text-cyan-600 hover:text-cyan-700"
                  >
                    Đọc tất cả
                  </button>
                )}
              </div>
            </div>

            {/* Read-state segmented control */}
            <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
              {READ_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setReadFilter(f.id)}
                  className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-black transition-colors ${
                    readFilter === f.id ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Date range filter (collapsible) */}
            {showFilters && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Từ ngày</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Đến ngày</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                {hasDateFilter && (
                  <button
                    type="button"
                    onClick={clearDateFilter}
                    className="text-[11px] font-black text-slate-400 hover:text-rose-600"
                  >
                    Xóa lọc ngày
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <Bell className="w-8 h-8 text-slate-300 mb-2" strokeWidth={1.5} />
                <p className="text-xs font-bold text-slate-400">
                  {readFilter === 'unread'
                    ? 'Không có thông báo chưa đọc'
                    : hasDateFilter
                      ? 'Không có thông báo trong khoảng ngày này'
                      : 'Không có thông báo mới nào'}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  className={`p-4 flex gap-3 hover:bg-slate-50/80 cursor-pointer transition-colors ${
                    !n.isRead ? 'bg-cyan-50/30' : ''
                  }`}
                >
                  {/* Icon indicator */}
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        !n.isRead ? 'bg-cyan-100 text-cyan-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${!n.isRead ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">
                      {n.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(n.id);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100/70 px-2 py-0.5 rounded"
                        >
                          <Check className="w-3 h-3" />
                          Đánh dấu đã đọc
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(n.id, e)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded ml-auto"
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
