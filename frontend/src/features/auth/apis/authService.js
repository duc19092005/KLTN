import api from '../../../shared/apis/api';

export const authService = {
  bootstrapAdmin: (username, email, superAdminSecret) =>
    api.post('/auth/bootstrap', { username, email, superAdminSecret }),

  inviteLogin: (inviteToken) => api.post('/auth/invite-login', { inviteToken }),

  staffLogin: (username, password) => api.post('/auth/staff-login', { username, password }),

  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),

  verifyWallet: (address, signature, message) =>
    api.post('/auth/verify-wallet', { address, signature, message }),

  walletChallenge: (address) => api.get(`/auth/wallet-challenge/${address}`),

  walletBindChallenge: (address) => api.post('/auth/wallet-bind-challenge', { address }),

  walletLogin: (walletAddress, signature, message) =>
    api.post('/auth/wallet-login', { walletAddress, signature, message }),

  generateMfaSecret: () => api.post('/auth/generate-secret'),

  registerFace: (embedding) => api.post('/auth/register-face', { embedding }),

  faceChallenge: () => api.post('/auth/face-challenge'),

  verifyFace: (embedding, challenge) => api.post('/auth/verify-face', { embedding, challenge }),

  // Step-up: mint a single-use face ticket scoped to a sensitive action (+ optional resourceId).
  faceStepUp: (embedding, challenge, action, resourceId) =>
    api.post('/auth/face-stepup', { embedding, challenge, action, resourceId }),

  getMe: () => api.get('/auth/me'),

  logout: () => api.post('/auth/logout'),

  forgotPasswordChallenge: (username) =>
    api.post('/auth/forgot-password/challenge', { username }),

  forgotPasswordVerifyFace: (userId, embedding, challenge) =>
    api.post('/auth/forgot-password/verify-face', { userId, embedding, challenge }),

  forgotPasswordReset: (resetToken, newPassword) =>
    api.post('/auth/forgot-password/reset', { resetToken, newPassword }),
};
