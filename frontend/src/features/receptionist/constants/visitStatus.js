export const VISIT_STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả cận lâm sàng', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

export function getVisitStatus(status) {
  return VISIT_STATUS[status] || { label: status || 'Không rõ', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
}
