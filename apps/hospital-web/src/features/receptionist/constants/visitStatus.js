export const VISIT_STATUS = {
  WAITING: { label: 'Chờ khám', shortLabel: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Đang khám', shortLabel: 'Đang khám', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả cận lâm sàng', shortLabel: 'Chờ CLS', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', shortLabel: 'Chờ KL', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  COMPLETED: { label: 'Hoàn tất', shortLabel: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', shortLabel: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

export function getVisitStatus(status) {
  return VISIT_STATUS[status] || { label: status || 'Không rõ', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
}
