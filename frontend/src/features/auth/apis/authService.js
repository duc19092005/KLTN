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

  adminFaceRecoveryChallenge: () => api.post('/auth/admin-face-recovery/challenge'),

  adminFaceRecoveryRestore: (embedding, challenge) =>
    api.post('/auth/admin-face-recovery/restore', { embedding, challenge }),

  // Step-up: mint a single-use face ticket scoped to a sensitive action (+ optional resourceId).
  faceStepUp: (embedding, challenge, action, resourceId) =>
    api.post('/auth/face-stepup', { embedding, challenge, action, resourceId }),

  getMe: () => api.get('/auth/me'),

  getProfile: () => api.get('/auth/profile'),

  logout: () => api.post('/auth/logout'),

  forgotPasswordChallenge: (username) =>
    api.post('/auth/forgot-password/challenge', { username }),

  forgotPasswordVerifyFace: (userId, embedding, challenge) =>
    api.post('/auth/forgot-password/verify-face', { userId, embedding, challenge }),

  forgotPasswordReset: (resetToken, newPassword) =>
    api.post('/auth/forgot-password/reset', { resetToken, newPassword }),

  adminWalletRecoveryChallenge: () =>
    api.post('/auth/admin-account-recovery/challenge'),

  adminWalletRecoveryVerifyFace: (embedding, challenge) =>
    api.post('/auth/admin-account-recovery/verify-face', { embedding, challenge }),

  adminWalletRecoveryWalletChallenge: (recoveryToken, address) =>
    api.post('/auth/admin-account-recovery/wallet-challenge', { recoveryToken, address }),

  adminWalletRecoveryConfirm: (recoveryToken, address, signature, message) =>
    api.post('/auth/admin-account-recovery/confirm-wallet', {
      recoveryToken,
      address,
      signature,
      message,
    }),

  faceLoginChallenge: (username) => api.post('/auth/face-login/challenge', { username }),

  faceLogin: (userId, embedding, challenge) => api.post('/auth/face-login', { userId, embedding, challenge }),
};
