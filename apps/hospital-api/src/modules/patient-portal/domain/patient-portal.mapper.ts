export function appointmentInclude() {
  return {
    patient: true,
    department: true,
    doctor: { include: { staffProfile: true } },
    visit: true,
  } as const;
}

export function toPatientSummary(patient: {
  id: string;
  patientCode: string;
  fullName: string;
  gender: string;
  birthDate: Date;
  citizenId: string | null;
  phone: string | null;
  address: string | null;
  insuranceNumber: string | null;
  emergencyContact: string | null;
}) {
  return {
    id: patient.id,
    patientCode: patient.patientCode,
    fullName: patient.fullName,
    gender: patient.gender,
    birthDate: patient.birthDate,
    citizenId: patient.citizenId,
    contactPhone: patient.phone,
    address: patient.address,
    insuranceNumber: patient.insuranceNumber,
    emergencyContact: patient.emergencyContact,
  };
}

export function toAppointmentSummary(appointment: any) {
  return {
    id: appointment.id,
    appointmentCode: appointment.appointmentCode,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    qrExpiresAt: appointment.qrExpiresAt,
    checkedInAt: appointment.checkedInAt,
    patient: appointment.patient ? toPatientSummary(appointment.patient) : null,
    department: appointment.department ? { id: appointment.department.id, name: appointment.department.name, type: appointment.department.type, floor: appointment.department.floor } : null,
    doctor: appointment.doctor ? { id: appointment.doctor.id, fullName: appointment.doctor.staffProfile.fullName, specialty: appointment.doctor.specialty } : null,
    visitId: appointment.visitId,
  };
}

export function toAppointmentVerification(appointment: any) {
  return {
    appointment: toAppointmentSummary(appointment),
    patient: appointment.patient ? toPatientSummary(appointment.patient) : null,
    department: appointment.department ? { id: appointment.department.id, name: appointment.department.name, type: appointment.department.type } : null,
    doctor: appointment.doctor ? { id: appointment.doctor.id, fullName: appointment.doctor.staffProfile.fullName, specialty: appointment.doctor.specialty } : null,
  };
}

export function toAiDiagnosisSummary(aiDiagnosis: any) {
  return {
    id: aiDiagnosis.id,
    result: aiDiagnosis.result,
    confidence: aiDiagnosis.confidence,
    status: aiDiagnosis.status,
    createdAt: aiDiagnosis.createdAt,
    aiModel: aiDiagnosis.aiModel ? {
      id: aiDiagnosis.aiModel.id,
      modelName: aiDiagnosis.aiModel.modelName,
      modelVersion: aiDiagnosis.aiModel.modelVersion,
      provider: aiDiagnosis.aiModel.provider,
    } : null,
  };
}