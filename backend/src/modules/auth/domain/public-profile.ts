import { UserWithFullProfile } from '../application/ports/auth.repository.port';

/**
 * Read-only projection for "Xem thông tin cá nhân" (view my profile).
 *
 * Shapes the identity graph by role and strips every sensitive field
 * (passwordHash, faceEmbedding/faceHash, mfaSecret, wallet nonces, invite token,
 * brute-force counters). Never returns biometric templates or secrets.
 */
export function toPublicProfile(user: UserWithFullProfile) {
  const staff = user.staffProfile;
  const doctor = staff?.doctorProfile ?? null;
  const admin = user.adminProfile;

  return {
    // Account identity (common to every role)
    account: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      firstLogin: user.firstLogin,
      hasFace: Boolean(user.faceEmbedding),
      faceEnrolledAt: user.faceEnrolledAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },

    // Staff/doctor personal details (RECEPTIONIST, DOCTOR, LAB_MANAGER)
    staff: staff
      ? {
          fullName: staff.fullName,
          phone: staff.phone,
          gender: staff.gender,
          citizenId: staff.citizenId,
          birthDate: staff.birthDate,
          address: staff.address,
          avatarUrl: staff.avatarUrl,
          employeeCode: staff.employeeCode,
          position: staff.position,
          department: staff.department
            ? {
                id: staff.department.id,
                name: staff.department.name,
                departmentCode: staff.department.departmentCode,
                type: staff.department.type,
              }
            : null,
          managedDepartment: staff.managedDepartment
            ? {
                id: staff.managedDepartment.id,
                name: staff.managedDepartment.name,
                departmentCode: staff.managedDepartment.departmentCode,
              }
            : null,
        }
      : null,

    // Clinical credentials (DOCTOR only)
    doctor: doctor
      ? {
          specialty: doctor.specialty,
          licenseNumber: doctor.licenseNumber,
          qualification: doctor.qualification,
          yearsExperience: doctor.yearsExperience,
        }
      : null,

    // Admin-specific public details (ADMIN only) - wallet is public, secrets are not
    admin: admin
      ? {
          adminUserName: admin.adminUserName,
          walletAddress: admin.walletAddress,
          hasWallet: Boolean(admin.walletAddress),
          hasRecoverySecret: Boolean(admin.mfaSecret),
        }
      : null,
  };
}
