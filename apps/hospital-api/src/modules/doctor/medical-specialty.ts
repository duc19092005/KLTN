import { MedicalSpecialty } from '@prisma/client';

export const MEDICAL_SPECIALTY_LABELS: Record<MedicalSpecialty, string> = {
  GENERAL_INTERNAL_MEDICINE: 'Nội tổng quát',
  GENERAL_SURGERY: 'Ngoại tổng quát',
  PEDIATRICS: 'Nhi khoa',
  OBSTETRICS_GYNECOLOGY: 'Sản phụ khoa',
  CARDIOLOGY: 'Tim mạch',
  ENT: 'Tai Mũi Họng',
  DENTOMAXILLOFACIAL: 'Răng Hàm Mặt',
  OPHTHALMOLOGY: 'Mắt',
  DERMATOLOGY: 'Da liễu',
  NEUROLOGY: 'Thần kinh',
  ORTHOPEDICS: 'Chấn thương chỉnh hình',
  GASTROENTEROLOGY: 'Tiêu hóa',
  ENDOCRINOLOGY: 'Nội tiết',
  ONCOLOGY: 'Ung bướu',
  RESPIRATORY: 'Hô hấp',
};

export function getMedicalSpecialtyLabel(specialty: MedicalSpecialty) {
  return MEDICAL_SPECIALTY_LABELS[specialty] ?? specialty;
}

export function getMedicalSpecialtyOptions() {
  return Object.values(MedicalSpecialty).map((value) => ({
    value,
    label: getMedicalSpecialtyLabel(value),
  }));
}
