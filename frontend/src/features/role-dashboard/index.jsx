import RoleDashboard from './pages/RoleDashboard';
import ReceptionistDashboardPage from '../receptionist/pages/ReceptionistDashboard';
import DoctorDashboardPage from '../doctor/pages/DoctorDashboard';

export function ReceptionistDashboard() {
  return <ReceptionistDashboardPage />;
}

export function DoctorDashboard() {
  return <DoctorDashboardPage />;
}

export function LabManagerDashboard() {
  return <RoleDashboard title="Dashboard Quản lý xét nghiệm" subtitle="Không gian quản lý chỉ định xét nghiệm, kết quả và điều phối phòng lab." tone="emerald" />;
}
