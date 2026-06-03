import api from '../../../shared/apis/api';

export const shiftService = {
  /** Staff self-registers a shift. */
  register: (clinicalRoomId, startTime, endTime) =>
    api.post('/paraclinical/shifts/register', { clinicalRoomId, startTime, endTime }),

  /** Admin/Head approves a PENDING shift. */
  approve: (shiftId) => api.post('/paraclinical/shifts/approve', { shiftId }),

  /** Admin/Head rejects a PENDING shift. */
  reject: (shiftId) => api.post('/paraclinical/shifts/reject', { shiftId }),

  /** Admin/Head directly assigns a shift (auto-APPROVED). */
  assign: (staffId, clinicalRoomId, startTime, endTime) =>
    api.post('/paraclinical/shifts/assign', { staffId, clinicalRoomId, startTime, endTime }),

  /** List shifts for a specific room. */
  listByRoom: (roomId, from, to) =>
    api.get(`/paraclinical/shifts/room/${roomId}`, { params: { from, to } }),

  /** List all PENDING shifts for approval. */
  listPending: (departmentId) =>
    api.get('/paraclinical/shifts/pending', { params: { departmentId } }),
};

export const paraclinicalAuthService = {
  /** Phase 1: Shared-account login (username/password). */
  login: (username, password) =>
    api.post('/auth/paraclinical/login', { username, password }),

  /** Phase 2: Face verification against active shift. */
  verifyShiftFace: (tempToken, faceDescriptor) =>
    api.post('/auth/paraclinical/verify-shift-face', { tempToken, faceDescriptor }),
};

export const handoverService = {
  /** Initiate a handover. */
  initiate: (toStaffId, clinicalRoomId, reason) =>
    api.post('/paraclinical/handover/initiate', { toStaffId, clinicalRoomId, reason }),

  /** Verify face of Person A (outgoing). */
  verifyFaceA: (handoverId, faceDescriptor) =>
    api.post('/paraclinical/handover/verify-face-a', { handoverId, faceDescriptor }),

  /** Verify face of Person B (incoming). */
  verifyFaceB: (handoverId, faceDescriptor) =>
    api.post('/paraclinical/handover/verify-face-b', { handoverId, faceDescriptor }),
};
