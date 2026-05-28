import RoleDashboard from './pages/RoleDashboard';

export function ReceptionistDashboard() {
  return <RoleDashboard title="Dashboard Lễ tân" subtitle="Không gian tiếp nhận bệnh nhân, lịch hẹn và điều phối khám." tone="cyan" />;
}

export function DoctorDashboard() {
  return <RoleDashboard title="Dashboard Bác sĩ" subtitle="Không gian làm việc lâm sàng cho bác sĩ, quản lý hồ sơ khám và chẩn đoán." tone="indigo" />;
}

export function LabManagerDashboard() {
  return <RoleDashboard title="Dashboard Quản lý xét nghiệm" subtitle="Không gian quản lý chỉ định xét nghiệm, kết quả và điều phối phòng lab." tone="emerald" />;
}
