import api from '../../../shared/apis/api';

export const shiftService = {
  /** Staff self-registers a shift. */
  register: (departmentId, startTime, endTime, note, demoMode = false) =>
    api.post('/paraclinical/shifts/register', { departmentId, startTime, endTime, note }, { params: { demo: demoMode ? '1' : '0' } }),

  /** Admin/Head approves a PENDING shift. */
  approve: (shiftId) => api.post('/paraclinical/shifts/approve', { shiftId }),

  /** Admin/Head rejects a PENDING shift. */
  reject: (shiftId, reason) => api.post('/paraclinical/shifts/reject', { shiftId, reason }),

  /** Admin/Head directly assigns a shift (auto-APPROVED). */
  assign: (staffId, departmentId, startTime, endTime) =>
    api.post('/paraclinical/shifts/assign', { staffId, departmentId, startTime, endTime }),

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
