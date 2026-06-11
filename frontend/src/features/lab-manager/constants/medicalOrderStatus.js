export const MEDICAL_ORDER_STATUS = {
  ORDERED: { label: 'Chờ tiếp nhận', shortLabel: 'Chờ nhận', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  IN_PROGRESS: { label: 'Đang thực hiện', shortLabel: 'Đang làm', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  RESULT_READY: { label: 'Đã có kết quả', shortLabel: 'Có kết quả', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', shortLabel: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

export function getMedicalOrderStatus(status) {
  return MEDICAL_ORDER_STATUS[status] || MEDICAL_ORDER_STATUS.ORDERED;
}
