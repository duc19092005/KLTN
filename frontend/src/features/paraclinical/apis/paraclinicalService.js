import api from '../../../shared/apis/api';

export const shiftService = {
  register: (departmentId, workDate, shiftCode, note, demoMode = false) =>
    api.post('/paraclinical/shifts/register', { departmentId, workDate, shiftCode, note }, { params: { demo: demoMode ? '1' : '0' } }),

  /** Staff self-registers multiple fixed Ca A / Ca B shifts in one request. */
  registerMany: (shifts, demoMode = false) =>
    api.post('/paraclinical/shifts/register-many', { shifts }, { params: { demo: demoMode ? '1' : '0' } }),

  /** Admin/Head approves a PENDING shift. */
  approve: (shiftId) => api.post('/paraclinical/shifts/approve', { shiftId }),

  /** Admin/Head rejects a PENDING shift. */
  reject: (shiftId, reason) => api.post('/paraclinical/shifts/reject', { shiftId, reason }),

  /** Admin/Head directly assigns a fixed shift (auto-APPROVED). */
  assign: (staffId, departmentId, workDate, shiftCode) =>
    api.post('/paraclinical/shifts/assign', { staffId, departmentId, workDate, shiftCode }),

  /** List shifts for a specific department. */
  listByDepartment: (departmentId, from, to) =>
    api.get(`/paraclinical/shifts/department/${departmentId}`, { params: { from, to } }),

  /** Rooms available for the current LAB_MANAGER, filtered by specialty. */
  availableRooms: () => api.get('/paraclinical/shifts/available-rooms'),

  /** Current LAB_MANAGER's own shift history. */
  myShifts: (from, to) => api.get('/paraclinical/shifts/my-shifts', { params: { from, to } }),

  /** List all PENDING shifts for approval. */
  listPending: (departmentId) =>
    api.get('/paraclinical/shifts/pending', { params: { departmentId } }),
};

export const handoverService = {
  /** Initiate a handover. */
  initiate: (toStaffId, departmentId, reason) =>
    api.post('/paraclinical/handover/initiate', { toStaffId, departmentId, reason }),

  /** Verify face of Person A (outgoing). */
  verifyFaceA: (handoverId, faceDescriptor) =>
    api.post('/paraclinical/handover/verify-face-a', { handoverId, faceDescriptor }),

  /** Verify face of Person B (incoming). */
  verifyFaceB: (handoverId, faceDescriptor) =>
    api.post('/paraclinical/handover/verify-face-b', { handoverId, faceDescriptor }),
};
