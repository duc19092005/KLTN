import api from '../../../shared/apis/api';

export const receptionShiftService = {
  register: (departmentId, workDate, shiftCode, note, demoMode = false) =>
    api.post('/reception/shifts/register', { departmentId, workDate, shiftCode, note }, { params: { demo: demoMode ? '1' : '0' } }),

  registerMany: (items, demoMode = false) =>
    api.post('/reception/shifts/register-many', { items }, { params: { demo: demoMode ? '1' : '0' } }),

  myShifts: (from, to) => api.get('/reception/shifts/my-shifts', { params: { from, to } }),

  availableDepartments: () => api.get('/reception/shifts/available-departments'),

  listPending: (departmentId) => api.get('/reception/shifts/pending', { params: { departmentId } }),

  listByDepartment: (departmentId, from, to) => api.get(`/reception/shifts/department/${departmentId}`, { params: { from, to } }),

  approve: (shiftId) => api.post('/reception/shifts/approve', { shiftId }),

  reject: (shiftId, reason) => api.post('/reception/shifts/reject', { shiftId, reason }),

  assign: (staffId, departmentId, workDate, shiftCode) =>
    api.post('/reception/shifts/assign', { staffId, departmentId, workDate, shiftCode }),
};
