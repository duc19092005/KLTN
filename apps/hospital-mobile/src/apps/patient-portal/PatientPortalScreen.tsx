import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { passwordPatientLogin, requestPatientOtp, resendPatientOtp, verifyPatientOtp, changePatientPassword, PatientOtpLoginResponse } from '../../shared/api/patientAuthClient';
import {
  getPatientProfiles,
  createAppointment,
  createPatientProfile,
  getAppointmentQr,
  getAppointmentSlots,
  getBookableSpecialties,
  getBookableDoctorsBySpecialty,
  getPatientAppointments,
  getPatientResultFileDownloadUrl,
  getPatientVisitDetail,
  getPatientVisits,
  BookableSpecialty,
  BookableDoctor,
  AppointmentSlot,
  PatientAppointment,
  PatientSummary,
  PatientVisitDetail,
  PatientVisitSummary,
  PatientAiDiagnosis,
} from '../../shared/api/patientPortalClient';
import { ActionButton } from '../../shared/components/ActionButton';
import { StatusPanel } from '../../shared/components/StatusPanel';
import { colors, spacing } from '../../shared/theme/theme';

type Step = 'phone' | 'passwordLogin' | 'otp' | 'passwordSetup' | 'dashboard' | 'notifications' | 'account' | 'changePassword' | 'profiles' | 'profileDetail' | 'visits' | 'detail' | 'createProfile' | 'booking';
type BookingStage = 'profiles' | 'specialty' | 'doctor' | 'slot' | 'confirm' | 'qr';
type BookingBusyStage = null | 'patients' | 'specialties' | 'doctors' | 'slots' | 'submit' | 'qr';
type ProfileForm = { fullName: string; gender: string; birthDate: string; citizenId: string; address: string; insuranceNumber: string; emergencyContact: string };
type ProfileFormErrors = Partial<Record<keyof ProfileForm, string>>;
type FeedbackTone = 'success' | 'info' | 'danger';
type Feedback = { tone: FeedbackTone; title: string; body: string } | null;

type PreviewUrls = Record<string, string>;

const PATIENT_SESSION_STORAGE_KEY = 'kltn.patient.session.v1';
const VIETNAM_PHONE_PATTERN = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/;

function normalizePhone(value: string) {
  return value.replace(/[\s.-]/g, '');
}

function isValidVietnamPhone(value: string) {
  return VIETNAM_PHONE_PATTERN.test(normalizePhone(value));
}

function getFriendlyError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function validateProfileForm(form: ProfileForm): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const fullName = form.fullName.trim();
  if (!fullName) errors.fullName = 'Vui lòng nhập họ và tên.';
  else if (fullName.length < 5 || fullName.split(/\s+/).length < 2) errors.fullName = 'Họ tên cần tối thiểu 2 từ hoặc 5 ký tự.';
  if (!form.gender) errors.gender = 'Vui lòng chọn giới tính.';
  if (!form.birthDate) errors.birthDate = 'Vui lòng chọn ngày sinh.';
  else {
    const birth = new Date(form.birthDate);
    const now = new Date();
    const min = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    if (Number.isNaN(birth.getTime())) errors.birthDate = 'Ngày sinh không hợp lệ.';
    else if (birth > now) errors.birthDate = 'Ngày sinh không được ở tương lai.';
    else if (birth < min) errors.birthDate = 'Ngày sinh không được quá 120 tuổi.';
  }
  if (form.citizenId && !/^(\d{9}|\d{12})$/.test(form.citizenId)) errors.citizenId = 'CCCD/CMND phải gồm 9 hoặc 12 số.';
  if (form.emergencyContact && !isValidVietnamPhone(form.emergencyContact)) errors.emergencyContact = 'Số liên hệ khẩn cấp không hợp lệ.';
  return errors;
}

function loadStoredSession(): PatientOtpLoginResponse | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(PATIENT_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PatientOtpLoginResponse) : null;
  } catch {
    return null;
  }
}

function persistSession(session: PatientOtpLoginResponse) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PATIENT_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage failures; the in-memory session still works for this run.
  }
}

function clearStoredSession() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(PATIENT_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function PatientPortalScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordForm, setChangePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [bookingBusyStage, setBookingBusyStage] = useState<BookingBusyStage>(null);
  const [fileBusyId, setFileBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState('');
  const [session, setSession] = useState<PatientOtpLoginResponse | null>(() => loadStoredSession());
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [visits, setVisits] = useState<PatientVisitSummary[]>([]);
  const [profileDetails, setProfileDetails] = useState<PatientSummary[]>([]);
  const [selectedProfileDetail, setSelectedProfileDetail] = useState<PatientSummary | null>(null);
  const [visitDetail, setVisitDetail] = useState<PatientVisitDetail | null>(null);
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({});
  const [specialties, setSpecialties] = useState<BookableSpecialty[]>([]);
  const [doctors, setDoctors] = useState<BookableDoctor[]>([]);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [expandedQrIds, setExpandedQrIds] = useState<Record<string, boolean>>({});
  const qrRefs = useRef<Record<string, { toDataURL?: (callback: (data: string) => void) => void } | null>>({});
  const [bookingSpecialty, setBookingSpecialty] = useState('');
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingStage, setBookingStage] = useState<BookingStage>('profiles');
  const [profileForm, setProfileForm] = useState<ProfileForm>({ fullName: '', gender: 'MALE', birthDate: '', citizenId: '', address: '', insuranceNumber: '', emergencyContact: '' });
  const [profileFormErrors, setProfileFormErrors] = useState<ProfileFormErrors>({});
  const [creatingProfileFromBooking, setCreatingProfileFromBooking] = useState(false);

  useEffect(() => {
    if (session && step === 'phone') setStep('dashboard');
  }, [session, step]);

  useEffect(() => {
    if (step !== 'otp' || resendAfterSeconds <= 0) return undefined;

    const timer = setInterval(() => {
      setResendAfterSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, resendAfterSeconds]);

  const selectedPatient = useMemo(
    () => session?.patients.find((patient) => patient.id === selectedPatientId) ?? session?.patients[0] ?? null,
    [selectedPatientId, session?.patients],
  );

  const phoneIsValid = isValidVietnamPhone(phone);
  const otpIsValid = /^\d{6}$/.test(otp);

  const clearFeedback = () => {
    setError('');
    setMessage('');
    setFeedback(null);
  };

  const showFeedback = (tone: FeedbackTone, title: string, body: string) => {
    setError('');
    setMessage('');
    setFeedback({ tone, title, body });
  };

  const showError = (body: string, title = 'Không thành công') => showFeedback('danger', title, body);
  const showSuccess = (body: string, title = 'Thành công') => showFeedback('success', title, body);
  const showInfo = (body: string, title = 'Thông báo') => showFeedback('info', title, body);

  const ensureValidPhone = () => {
    if (!phone.trim()) {
      showError('Vui lòng nhập số điện thoại trước khi tiếp tục.');
      return false;
    }
    if (!phoneIsValid) {
      showError('Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.');
      return false;
    }
    return true;
  };

  const openPersonalProfiles = async () => {
    if (!session) return;
    setBusy(true);
    clearFeedback();
    try {
      const accesses = await getPatientProfiles(session.accessToken);
      setProfileDetails(accesses.map((access) => access.patient));
      setSelectedProfileDetail(null);
      setStep('profiles');
    } catch (profileError) {
      showError(getFriendlyError(profileError, 'Không tải được thông tin hồ sơ cá nhân.'));
    } finally {
      setBusy(false);
    }
  };

  const openProfileDetail = (patient: PatientSummary) => {
    setSelectedPatientId(patient.id);
    setSelectedProfileDetail(patient);
    setStep('profileDetail');
  };

  const submitChangePassword = async () => {
    if (!session) return;
    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword || !changePasswordForm.confirmPassword) {
      showError('Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.');
      return;
    }
    if (changePasswordForm.newPassword.length < 8) {
      showError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (changePasswordForm.currentPassword === changePasswordForm.newPassword) {
      showError('Mật khẩu mới không được trùng mật khẩu hiện tại.');
      return;
    }
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      showError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setBusy(true);
    clearFeedback();
    try {
      const response = await changePatientPassword(session.accessToken, changePasswordForm.currentPassword, changePasswordForm.newPassword);
      setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showSuccess(response.message || 'Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      reset();
    } catch (changeError) {
      showError(getFriendlyError(changeError, 'Không đổi được mật khẩu.'));
    } finally {
      setBusy(false);
    }
  };

  const loginWithPassword = async () => {
    if (!ensureValidPhone()) return;
    if (!password) {
      showError('Vui lòng nhập mật khẩu.');
      return;
    }
    setBusy(true);
    clearFeedback();
    try {
      const response = await passwordPatientLogin(phone, password);
      setSession(response);
      persistSession(response);
      setPassword('');
      setConfirmPassword('');
      setStep('dashboard');
    } catch (loginError) {
      showError(getFriendlyError(loginError, 'Số điện thoại hoặc mật khẩu không hợp lệ.'));
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    if (!ensureValidPhone()) return;
    setBusy(true);
    clearFeedback();
    try {
      const response = await requestPatientOtp(phone);
      showInfo(response.message || 'OTP đã được gửi nếu số điện thoại hợp lệ. Mã có hiệu lực trong 5 phút.');
      setResendAfterSeconds(response.resendAfterSeconds || 60);
      setOtpExpiresAt(response.otpExpiresAt || '');
      setStep('otp');
    } catch (requestError) {
      showError(getFriendlyError(requestError, 'Không gửi được OTP. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!ensureValidPhone()) return;
    setBusy(true);
    clearFeedback();
    try {
      const response = await resendPatientOtp(phone);
      showInfo(response.message || 'OTP đã được gửi lại. Vui lòng nhập mã mới nhất trước khi hết hạn.');
      setResendAfterSeconds(response.resendAfterSeconds || 60);
      setOtpExpiresAt(response.otpExpiresAt || '');
      setOtp('');
    } catch (requestError) {
      showError(getFriendlyError(requestError, 'Không gửi lại được OTP. Vui lòng thử lại sau.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!ensureValidPhone()) return;
    if (!otpIsValid) {
      showError('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }
    setBusy(true);
    clearFeedback();
    try {
      const response = await verifyPatientOtp(phone, otp);
      setSession(response);
      persistSession(response);
      setStep(response.requirePasswordSetup ? 'passwordSetup' : 'profiles');
      if (response.requirePasswordSetup) showInfo('Vui lòng tạo mật khẩu trước khi xem hồ sơ bệnh nhân.');
    } catch (verifyError) {
      showError(getFriendlyError(verifyError, 'OTP không hợp lệ hoặc đã hết hạn.'));
    } finally {
      setBusy(false);
    }
  };

  const setupPassword = async () => {
    setError('');
    setMessage('');
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setBusy(true);
    try {
      const response = await verifyPatientOtp(phone, otp, password);
      setSession(response);
      persistSession(response);
      setPassword('');
      setConfirmPassword('');
      setMessage('Đã thiết lập mật khẩu. Bạn có thể xem hồ sơ bệnh nhân.');
      setStep('dashboard');
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Không thiết lập được mật khẩu.');
    } finally {
      setBusy(false);
    }
  };

  const openVisits = async (patientId: string) => {
    if (!session) return;
    setBusy(true);
    setError('');
    setPreviewUrls({});
    setSelectedPatientId(patientId);
    try {
      const response = await getPatientVisits(session.accessToken, patientId);
      setVisits(response);
      setStep('visits');
    } catch (visitError) {
      setError(visitError instanceof Error ? visitError.message : 'Không tải được lịch sử khám.');
    } finally {
      setBusy(false);
    }
  };

  const openVisitDetail = async (visitId: string) => {
    if (!session || !selectedPatientId) return;
    setBusy(true);
    setError('');
    setPreviewUrls({});
    try {
      const response = await getPatientVisitDetail(session.accessToken, selectedPatientId, visitId);
      setVisitDetail(response);
      setStep('detail');
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Không tải được chi tiết hồ sơ khám.');
    } finally {
      setBusy(false);
    }
  };

  const openResultFile = async (fileId: string, preview = false) => {
    if (!session || !selectedPatientId) return;
    setFileBusyId(fileId);
    setError('');
    try {
      const response = await getPatientResultFileDownloadUrl(session.accessToken, selectedPatientId, fileId);
      if (preview) {
        setPreviewUrls((current) => ({ ...current, [fileId]: response.url }));
      } else {
        await Linking.openURL(response.url);
      }
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Không mở được tệp kết quả.');
    } finally {
      setFileBusyId('');
    }
  };

  const openBooking = async () => {
    if (!session) return;
    if (!session.patients.length) {
      setStep('createProfile');
      return;
    }
    setBusy(true);
    setError('');
    const patientId = selectedPatientId || session.patients[0]?.id || '';
    setSelectedPatientId(patientId);
    try {
      const [specialtyData, appointmentData] = await Promise.all([
        getBookableSpecialties(session.accessToken),
        getPatientAppointments(session.accessToken, patientId),
      ]);
      setSpecialties(specialtyData);
      setAppointments(appointmentData);
      setBookingStage('profiles');
      setStep('booking');
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'Không tải được dữ liệu đặt lịch.');
    } finally {
      setBusy(false);
    }
  };

  const selectBookingPatient = async (patientId: string) => {
    if (!session) return;
    setSelectedPatientId(patientId);
    setBookingSpecialty('');
    setBookingDoctorId('');
    setBookingSlot('');
    setDoctors([]);
    setSlots([]);
    setBusy(true);
    setError('');
    try {
      setAppointments(await getPatientAppointments(session.accessToken, patientId));
      setBookingStage('specialty');
    } catch (appointmentError) {
      setError(appointmentError instanceof Error ? appointmentError.message : 'Không tải được lịch hẹn của hồ sơ này.');
    } finally {
      setBusy(false);
    }
  };

  const openAppointments = async () => {
    if (!session) return;
    const patientId = selectedPatientId || session.patients[0]?.id || '';
    if (!patientId) {
      showInfo('Vui lòng tạo hồ sơ bệnh nhân trước khi xem lịch hẹn.');
      setStep('createProfile');
      return;
    }
    setSelectedPatientId(patientId);
    setBookingBusyStage('patients');
    clearFeedback();
    try {
      const appointmentData = await getPatientAppointments(session.accessToken);
      setAppointments(appointmentData);
      setBookingStage('qr');
      setStep('booking');
    } catch (appointmentError) {
      showError(getFriendlyError(appointmentError, 'Không tải được lịch khám đã đặt.'));
    } finally {
      setBookingBusyStage(null);
    }
  };

  const submitProfile = async () => {
    if (!session) return;
    const validationErrors = validateProfileForm(profileForm);
    setProfileFormErrors(validationErrors);
    if (Object.keys(validationErrors).length) {
      showError('Vui lòng kiểm tra lại thông tin hồ sơ.');
      return;
    }
    setBusy(true);
    clearFeedback();
    try {
      const patient = await createPatientProfile(session.accessToken, { ...profileForm, phone: normalizePhone(phone) });
      const nextSession = { ...session, patients: [...session.patients, { ...patient, phone: patient.contactPhone || patient.phone || phone }] };
      setSession(nextSession);
      persistSession(nextSession);
      setSelectedPatientId(patient.id);
      setProfileForm({ fullName: '', gender: 'MALE', birthDate: '', citizenId: '', address: '', insuranceNumber: '', emergencyContact: '' });
      showSuccess('Đã tạo hồ sơ bệnh nhân.');
      if (creatingProfileFromBooking) {
        setCreatingProfileFromBooking(false);
        await openBooking();
      } else {
        setStep('dashboard');
      }
    } catch (profileError) {
      showError(getFriendlyError(profileError, 'Không tạo được hồ sơ bệnh nhân.'));
    } finally {
      setBusy(false);
    }
  };

  const selectBookingSpecialty = async (specialty: string) => {
    if (!session) return;
    setBookingSpecialty(specialty);
    setBookingDoctorId('');
    setBookingSlot('');
    setSlots([]);
    setBookingBusyStage('doctors');
    clearFeedback();
    try {
      setDoctors(await getBookableDoctorsBySpecialty(session.accessToken, specialty));
      setBookingStage('doctor');
    } catch (doctorError) {
      showError(getFriendlyError(doctorError, 'Không tải được danh sách bác sĩ.'));
    } finally {
      setBookingBusyStage(null);
    }
  };


  const loadSlotsForDoctor = async (doctorId: string, dateValue: string) => {
    if (!session || !doctorId) return;
    setBookingBusyStage('slots');
    clearFeedback();
    try {
      setSlots(await getAppointmentSlots(session.accessToken, doctorId, dateValue));
    } catch (slotError) {
      showError(getFriendlyError(slotError, 'Không tải được khung giờ.'));
    } finally {
      setBookingBusyStage(null);
    }
  };

  const selectBookingDoctor = async (doctorId: string) => {
    setBookingDoctorId(doctorId);
    setBookingSlot('');
    setSlots([]);
    await loadSlotsForDoctor(doctorId, bookingDate);
    setBookingStage('slot');
  };

  const changeBookingDate = async (value: string) => {
    setBookingDate(value);
    setBookingSlot('');
    setSlots([]);
    if (!bookingDoctorId) {
      showInfo('Vui lòng chọn bác sĩ trước khi tải khung giờ.');
      return;
    }
    await loadSlotsForDoctor(bookingDoctorId, value);
  };

  const submitAppointment = async () => {
    if (!session || !selectedPatient) return;
    if (!bookingSpecialty) {
      showError('Vui lòng chọn chuyên khoa.');
      return;
    }
    if (!bookingDoctorId) {
      showError('Vui lòng chọn bác sĩ trước khi chọn giờ khám.');
      return;
    }
    if (!bookingSlot) {
      showError('Vui lòng chọn khung giờ khám.');
      return;
    }
    setBookingBusyStage('submit');
    clearFeedback();
    try {
      const appointment = await createAppointment(session.accessToken, {
        patientId: selectedPatient.id,
        specialty: bookingSpecialty,
        doctorId: bookingDoctorId,
        scheduledAt: bookingSlot,
      });
      setAppointments((current) => [appointment, ...current]);
      setBookingStage('qr');
      showSuccess(`Đặt lịch thành công. Mã lịch hẹn: ${appointment.appointmentCode}`);
    } catch (appointmentError) {
      showError(getFriendlyError(appointmentError, 'Không đặt được lịch.'));
    } finally {
      setBookingBusyStage(null);
    }
  };

  const refreshAppointmentQr = async (appointmentId: string) => {
    if (!session) return;
    setBookingBusyStage('qr');
    clearFeedback();
    try {
      const updated = await getAppointmentQr(session.accessToken, appointmentId);
      setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setExpandedQrIds((current) => ({ ...current, [updated.id]: true }));
      showSuccess('Đã tải mã QR check-in.');
    } catch (qrError) {
      showError(getFriendlyError(qrError, 'Không lấy được mã QR.'));
    } finally {
      setBookingBusyStage(null);
    }
  };

  const downloadAppointmentQr = (appointment: PatientAppointment) => {
    const qrRef = qrRefs.current[appointment.id];
    if (!appointment.qrPayload || !qrRef?.toDataURL) {
      showInfo('Vui lòng hiển thị mã QR trước khi tải xuống.');
      return;
    }

    qrRef.toDataURL((data) => {
      const fileName = `${appointment.appointmentCode || 'lich-hen'}-qr.png`;
      const dataUrl = `data:image/png;base64,${data}`;
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        showSuccess('Đã tải mã QR.');
        return;
      }
      showInfo('Thiết bị này chưa hỗ trợ tải trực tiếp. Vui lòng chụp màn hình mã QR.');
    });
  };

  const reset = () => {
    setStep('phone');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setMessage('');
    setResendAfterSeconds(0);
    setOtpExpiresAt('');
    setSession(null);
    clearStoredSession();
    setSelectedPatientId('');
    setVisits([]);
    setVisitDetail(null);
    setPreviewUrls({});
  };

  const otpExpiryText = otpExpiresAt ? `OTP hết hạn lúc ${new Date(otpExpiresAt).toLocaleTimeString()}.` : 'OTP có hiệu lực trong 5 phút.';
  const resendDisabled = busy || resendAfterSeconds > 0;
  const showAuthenticatedTabs = Boolean(session && ['dashboard', 'notifications', 'profiles', 'visits', 'detail', 'account', 'createProfile', 'booking'].includes(step));
  const activeTab = step === 'account' ? 'account' : step === 'notifications' ? 'notifications' : step === 'profiles' || step === 'visits' || step === 'detail' ? 'features' : 'home';

  return (
    <View style={styles.portalShell}>
      <ScrollView style={styles.portalScroll} contentContainerStyle={[styles.content, showAuthenticatedTabs && styles.contentWithTabs]} showsVerticalScrollIndicator={false}>
      {!showAuthenticatedTabs ? <View style={styles.statusSpacer} /> : null}



      {step === 'phone' && (
        <View style={styles.onboardingScreen}>
          <MedicalMark large />
          <View style={styles.heroArt}>
            <View style={styles.dotGrid}>
              {Array.from({ length: 24 }).map((_, index) => <View key={index} style={styles.dot} />)}
            </View>
            <View style={styles.frameBack} />
            <View style={styles.illustrationFrame}>
              <View style={styles.doctorCircle}>
                <Ionicons name="person" size={66} color={colors.primary} />
              </View>
              <View style={styles.patientCircle}>
                <Ionicons name="heart" size={30} color="#ffffff" />
              </View>
              <View style={styles.chartCard}>
                <Ionicons name="pulse" size={24} color={colors.accent} />
                <View style={styles.chartLine} />
                <View style={[styles.chartLine, styles.chartLineShort]} />
              </View>
            </View>
          </View>
          <View style={styles.onboardingCopy}>
            <Text style={styles.onboardingTitle}>Đặt lịch khám bệnh trực tuyến</Text>
            <Text style={styles.onboardingText}>Nhập số điện thoại để đăng nhập, đăng ký OTP, xem hồ sơ sức khỏe và đặt lịch khám.</Text>
            <FormInput label="Số điện thoại" value={phone} onChangeText={(value) => { setPhone(value); if (feedback?.tone === 'danger') setFeedback(null); }} icon="phone-portrait-outline" keyboardType="phone-pad" placeholder="Ví dụ: 0912345678" />
            {phone.trim() && !phoneIsValid ? <Text style={styles.fieldErrorText}>Số điện thoại Việt Nam chưa hợp lệ.</Text> : null}
            <View style={styles.pager}><View style={styles.pagerActive} /><View style={styles.pagerDot} /></View>
          </View>
          <View style={styles.bottomActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Đăng nhập bằng mật khẩu" onPress={() => { clearFeedback(); setPassword(''); setStep('passwordLogin'); }} style={styles.loginPill}>
              <Text style={styles.loginPillText}>Đăng nhập</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Tiếp tục bằng OTP" accessibilityHint="Gửi mã OTP đến số điện thoại đã nhập" onPress={requestOtp} disabled={busy || !phoneIsValid} style={[styles.registerPill, (!phoneIsValid || busy) && styles.actionDisabled]}>
              <Text style={styles.registerPillText}>{busy ? 'Đang gửi...' : 'Tiếp tục bằng OTP'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 'dashboard' && session && (
        <View style={styles.homeScreen}>
          <View style={styles.homeGlowOne} />
          <View style={styles.homeGlowTwo} />

          <View style={styles.homeHeader}>
            <View style={styles.brandRow}>
              <MedicalMark />
              <Text style={styles.brandText}>Cổng chăm sóc sức khỏe</Text>
            </View>
            <Text style={styles.homeTitle}>Patient Care</Text>
            <Text style={styles.homeSubtitle}>Ứng dụng dành cho người bệnh</Text>
          </View>

          <View style={styles.featurePanel}>
            <View style={styles.featurePanelHeader}>
              <Text style={styles.featureTitle}>Chức năng</Text>
              <View style={styles.homeTools}>
                <Ionicons name="options-outline" size={22} color={colors.primaryDark} />
                <View style={styles.toolDivider} />
                <Ionicons name="search-outline" size={24} color={colors.primaryDark} />
              </View>
            </View>

            <View style={styles.featureGrid}>
              {getHomeFeatures({
                openBooking,
                openAppointments,
                openProfiles: openPersonalProfiles,
              }).map((feature) => (
                <FeatureTile key={feature.label} {...feature} />
              ))}
            </View>
          </View>

          <DashboardBanner />
          <View style={styles.dashboardSpacer} />
        </View>
      )}

      {step === 'account' && session && (
        <AccountScreen session={session} onLogout={reset} onHome={() => setStep('dashboard')} onOpenProfiles={openPersonalProfiles} onChangePassword={() => { clearFeedback(); setStep('changePassword'); }} notificationsEnabled={notificationsEnabled} onToggleNotifications={setNotificationsEnabled} />
      )}

      {step === 'changePassword' && session && (
        <ChangePasswordScreen form={changePasswordForm} setForm={setChangePasswordForm} busy={busy} onSubmit={submitChangePassword} onBack={() => setStep('account')} />
      )}

      {step === 'passwordLogin' && (
        <AuthScaffold eyebrow="Chào mừng quay trở lại" title="Đăng nhập tài khoản" subtitle="Dùng mật khẩu đã tạo sau lần xác thực OTP đầu tiên.">
          <FormInput label="Số điện thoại" value={phone} onChangeText={setPhone} icon="phone-portrait-outline" keyboardType="phone-pad" placeholder="Nhập số điện thoại..." />
          <FormInput label="Mật khẩu" value={password} onChangeText={setPassword} icon="lock-closed-outline" placeholder="Nhập mật khẩu..." secureTextEntry />
          <View style={styles.loginMetaRow}>
            <View style={styles.checkboxRow}><View style={styles.checkbox} /><Text style={styles.metaText}>Lưu đăng nhập</Text></View>
            <Pressable onPress={() => setStep('phone')}><Text style={styles.forgotText}>Quên mật khẩu?</Text></Pressable>
          </View>
          <ActionButton label="Đăng nhập" loading={busy} onPress={loginWithPassword} icon={<Ionicons name="log-in-outline" size={20} color="#ffffff" />} />
          <Divider />
          <ActionButton tone="secondary" label="Đăng nhập bằng OTP" loading={busy} onPress={() => { clearFeedback(); setStep('phone'); }} icon={<Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />} />
        </AuthScaffold>
      )}

      {step === 'otp' && (
        <AuthScaffold eyebrow="Xác thực bảo mật" title="Nhập mã OTP" subtitle={otpExpiryText}>
          <TextInput value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="••••••" placeholderTextColor="#b9c5d3" maxLength={6} style={[styles.input, styles.otpInput]} />
          <ActionButton label="Xác nhận đăng nhập" loading={busy} onPress={verifyOtp} icon={<Ionicons name="shield-checkmark-outline" size={20} color="#ffffff" />} />
          <Pressable disabled={resendDisabled} onPress={resendOtp} style={[styles.resendButton, resendDisabled && styles.resendButtonDisabled]}>
            <Ionicons name="refresh-outline" size={18} color={resendDisabled ? colors.muted : colors.primaryDark} />
            <Text style={[styles.linkText, resendDisabled && styles.disabledText]}>{resendAfterSeconds > 0 ? `Gửi lại OTP sau ${resendAfterSeconds}s` : 'Gửi lại OTP'}</Text>
          </Pressable>
        </AuthScaffold>
      )}

      {step === 'passwordSetup' && (
        <AuthScaffold eyebrow="Thiết lập bảo vệ" title="Tạo mật khẩu lần đầu" subtitle="Mật khẩu giúp bạn đăng nhập nhanh hơn ở những lần sau.">
          <FormInput label="Mật khẩu mới" value={password} onChangeText={setPassword} icon="lock-closed-outline" placeholder="Tối thiểu 8 ký tự" secureTextEntry />
          <FormInput label="Nhập lại mật khẩu" value={confirmPassword} onChangeText={setConfirmPassword} icon="checkmark-circle-outline" placeholder="Xác nhận mật khẩu" secureTextEntry />
          <ActionButton label="Lưu mật khẩu và tiếp tục" loading={busy} onPress={setupPassword} icon={<Ionicons name="lock-closed-outline" size={20} color="#ffffff" />} />
          <Pressable onPress={reset} style={styles.linkButton}><Text style={styles.linkText}>Đăng nhập tài khoản khác</Text></Pressable>
        </AuthScaffold>
      )}

      {step === 'profiles' && session && (
        <ProfileSelectionScreen
          patients={profileDetails.length ? profileDetails : session.patients}
          onOpenVisits={openProfileDetail}
          onCreateProfile={() => setStep('createProfile')}
          onBook={openBooking}
        />
      )}

      {step === 'profileDetail' && selectedProfileDetail && (
        <ProfileDetailScreen patient={selectedProfileDetail} onBack={() => setStep('profiles')} onOpenVisits={() => openVisits(selectedProfileDetail.id)} />
      )}

      {step === 'visits' && (
        <VisitHistoryScreen
          patient={selectedPatient}
          visits={visits}
          busy={busy}
          onOpenDetail={openVisitDetail}
        />
      )}

      {step === 'detail' && visitDetail && (
        <VisitDetailScreen
          visitDetail={visitDetail}
          previewUrls={previewUrls}
          fileBusyId={fileBusyId}
          onBack={() => setStep('visits')}
          onOpenFile={openResultFile}
        />
      )}
      {step === 'createProfile' && session && (
        <CreateProfileScreen form={profileForm} errors={profileFormErrors} setForm={setProfileForm} busy={busy} onSubmit={submitProfile} onBack={() => { setCreatingProfileFromBooking(false); setStep(creatingProfileFromBooking ? 'booking' : 'dashboard'); }} />
      )}

      {step === 'notifications' && session && (
        <NotificationsScreen session={session} appointments={appointments} onBooking={() => setStep('booking')} />
      )}

      {step === 'booking' && session && (
        <BookingScreen
          patient={selectedPatient}
          patients={session.patients}
          selectedPatientId={selectedPatientId || selectedPatient?.id || ''}
          stage={bookingStage}
          specialties={specialties}
          doctors={doctors}
          slots={slots}
          appointments={appointments}
          specialty={bookingSpecialty}
          doctorId={bookingDoctorId}
          selectedSlot={bookingSlot}
          date={bookingDate}
          busy={busy}
          busyStage={bookingBusyStage}
          onCreateProfile={() => { setCreatingProfileFromBooking(true); setStep('createProfile'); }}
          onPatient={selectBookingPatient}
          onStage={setBookingStage}
          onSpecialty={selectBookingSpecialty}
          onDoctor={selectBookingDoctor}
          onDate={changeBookingDate}
          onSlot={setBookingSlot}
          onSubmit={submitAppointment}
          onQr={refreshAppointmentQr}
          expandedQrIds={expandedQrIds}
          qrRefs={qrRefs}
          onOpenQr={(appointmentId) => setExpandedQrIds((current) => ({ ...current, [appointmentId]: true }))}
          onCloseQr={(appointmentId) => setExpandedQrIds((current) => ({ ...current, [appointmentId]: false }))}
          onDownloadQr={downloadAppointmentQr}
        />
      )}
      </ScrollView>
      {feedback ? (
        <View pointerEvents="box-none" style={styles.feedbackWrap}>
          <View style={styles.feedbackCard}>
            <StatusPanel
              tone={feedback.tone}
              title={feedback.title}
              body={feedback.body}
              icon={<Ionicons name={feedback.tone === 'danger' ? 'warning-outline' : feedback.tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={20} color={feedback.tone === 'danger' ? colors.danger : feedback.tone === 'success' ? colors.success : colors.primary} />}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" onPress={() => setFeedback(null)} style={styles.feedbackClose}>
              <Ionicons name="close" size={17} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      ) : null}
      {showAuthenticatedTabs ? (
        <BottomTabs active={activeTab} onHome={() => setStep('dashboard')} onNotifications={() => setStep('notifications')} onFeatures={openPersonalProfiles} onAccount={() => setStep('account')} />
      ) : null}
    </View>
  );
}

type HomeFeature = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
};

function getHomeFeatures({ openBooking, openAppointments, openProfiles }: { openBooking: () => void; openAppointments: () => void; openProfiles: () => void }): HomeFeature[] {
  return [
    { label: 'Đặt khám', icon: 'calendar-clear-outline', accent: colors.primary, onPress: openBooking },
    { label: 'Lịch đã đặt', icon: 'ticket-outline', accent: '#7c3aed', onPress: openAppointments },
    { label: 'Lịch sử khám', icon: 'folder-open-outline', accent: '#1d8fe1', onPress: openProfiles },
    { label: 'Kết quả cận lâm sàng', icon: 'flask-outline', accent: '#21b8c7', onPress: openProfiles },
  ];
}

function FeatureTile({ label, icon, accent, disabled, onPress }: HomeFeature) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.featureTile, pressed && !disabled ? styles.featureTilePressed : null, disabled ? styles.featureTileDisabled : null]}>
      <View style={styles.featureIconBox}>
        <Ionicons name={icon} size={30} color={accent} />
        <View style={[styles.featureBadge, { backgroundColor: accent }]} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Pressable>
  );
}

function DashboardBanner() {
  return (
    <View style={styles.dashboardBanner}>
      <View style={styles.bannerSky} />
      <View style={styles.bannerSun} />
      <View style={styles.bannerBuildingLarge}>
        {Array.from({ length: 18 }).map((_, index) => <View key={index} style={styles.bannerWindow} />)}
      </View>
      <View style={styles.bannerBuildingSmall}>
        {Array.from({ length: 10 }).map((_, index) => <View key={index} style={styles.bannerWindowSmall} />)}
      </View>
      <View style={styles.bannerTrees}>
        {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.treeDot} />)}
      </View>
      <View style={styles.bannerCaption}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDark} />
        <Text style={styles.bannerText}>Minh bạch hồ sơ • An toàn dữ liệu</Text>
      </View>
    </View>
  );
}

function BottomTabs({ active, onHome, onNotifications, onFeatures, onAccount }: { active: 'home' | 'notifications' | 'features' | 'account'; onHome: () => void; onNotifications: () => void; onFeatures: () => void; onAccount: () => void }) {
  const tabs: Array<{ key: 'home' | 'notifications' | 'features' | 'account'; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon?: keyof typeof Ionicons.glyphMap; onPress?: () => void }> = [
    { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home', onPress: onHome },
    { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications', onPress: onNotifications },
    { key: 'features', label: 'Chức năng', icon: 'layers-outline', activeIcon: 'layers', onPress: onFeatures },
    { key: 'account', label: 'Cá nhân', icon: 'person-circle-outline', activeIcon: 'person-circle', onPress: onAccount },
  ];

  return (
    <View style={styles.bottomTabsDock}>
      <View style={styles.bottomTabsGlow} />
      <View style={styles.bottomTabsGlass}>
        <View style={styles.bottomTabsSheen} />
        {tabs.map((tab) => (
          <LiquidTabItem
            key={tab.key}
            icon={tab.icon}
            activeIcon={tab.activeIcon || tab.icon}
            label={tab.label}
            active={tab.key === active}
            onPress={tab.onPress}
          />
        ))}
      </View>
    </View>
  );
}

function LiquidTabItem({ icon, activeIcon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress?: () => void }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      tension: 190,
      friction: 18,
    }).start();
  }, [active, progress]);

  const pillScale = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.78, 1.04, 1] });
  const pillOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const pillLift = progress.interpolate({ inputRange: [0, 1], outputRange: [7, 0] });
  const iconLift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const iconScale = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1.13, 1.07] });
  const iconTilt = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-5deg'] });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bottomTabItem, pressed && styles.bottomTabPressed]}>
      <Animated.View style={[styles.bottomTabActivePill, { opacity: pillOpacity, transform: [{ translateY: pillLift }, { scale: pillScale }] }]}>
        <View style={styles.bottomTabActiveGloss} />
      </Animated.View>
      <Animated.View style={[styles.bottomTabIconWrap, { transform: [{ translateY: iconLift }, { scale: iconScale }, { rotate: iconTilt }] }]}>
        <View style={[styles.bottomTabIconHalo, active && styles.bottomTabIconHaloActive]}>
          <Ionicons name={active ? activeIcon : icon} size={active ? 23 : 22} color={active ? colors.primary : '#64748b'} />
        </View>
      </Animated.View>
      <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function NotificationsScreen({ session, appointments, onBooking }: { session: PatientOtpLoginResponse; appointments: PatientAppointment[]; onBooking: () => void }) {
  const primaryPatient = session.patients[0];
  const upcomingAppointment = appointments.find((appointment) => ['PENDING', 'CONFIRMED'].includes(appointment.status));
  const notificationItems = [
    upcomingAppointment ? {
      icon: 'calendar-clear' as const,
      tone: 'primary' as const,
      title: 'Lịch khám sắp tới',
      message: `${formatDateTime(upcomingAppointment.scheduledAt)} • ${upcomingAppointment.department?.name || 'Chuyên khoa đã chọn'}`,
      time: 'Vừa cập nhật',
    } : {
      icon: 'calendar-outline' as const,
      tone: 'primary' as const,
      title: 'Bạn chưa có lịch khám mới',
      message: 'Đặt lịch tại nhà để nhận QR check-in và giảm thời gian chờ tại quầy.',
      time: 'Gợi ý',
    },
    {
      icon: 'shield-checkmark' as const,
      tone: 'success' as const,
      title: 'Hồ sơ được bảo vệ',
      message: `Tài khoản đang liên kết ${session.patients.length} hồ sơ bệnh nhân với quyền truy cập an toàn.`,
      time: 'Hôm nay',
    },
    {
      icon: 'qr-code' as const,
      tone: 'info' as const,
      title: 'Check-in nhanh bằng QR',
      message: 'Khi đặt lịch thành công, mã QR sẽ xuất hiện trong phiếu hẹn để lễ tân xác thực nhanh.',
      time: 'Hướng dẫn',
    },
  ];

  return (
    <View style={styles.notificationsScreen}>
      <View style={styles.notificationsHero}>
        <View style={styles.notificationsHeroGlow} />
        <View style={styles.notificationsHeroIcon}><Ionicons name="notifications" size={28} color="#ffffff" /></View>
        <View style={styles.flex1}>
          <Text style={styles.notificationsTitle}>Thông báo</Text>
          <Text style={styles.notificationsSubtitle}>Xin chào {primaryPatient?.fullName || 'người bệnh'}, các cập nhật quan trọng sẽ hiển thị tại đây.</Text>
        </View>
      </View>

      <View style={styles.notificationsQuickCard}>
        <View style={styles.notificationsQuickIcon}><Ionicons name="sparkles" size={22} color={colors.primary} /></View>
        <View style={styles.flex1}>
          <Text style={styles.notificationsQuickTitle}>Trợ lý lịch khám</Text>
          <Text style={styles.notificationsQuickText}>Theo dõi lịch hẹn, QR check-in và nhắc nhở hồ sơ trong một nơi.</Text>
        </View>
        <Pressable onPress={onBooking} style={styles.notificationsQuickButton}><Text style={styles.notificationsQuickButtonText}>Đặt lịch</Text></Pressable>
      </View>

      <View style={styles.notificationsSectionHeader}>
        <Text style={styles.notificationsSectionTitle}>Mới nhất</Text>
        <Text style={styles.notificationsSectionMeta}>{notificationItems.length} mục</Text>
      </View>

      <View style={styles.notificationsList}>
        {notificationItems.map((item) => <NotificationCard key={item.title} item={item} />)}
      </View>
    </View>
  );
}

function NotificationCard({ item }: { item: { icon: keyof typeof Ionicons.glyphMap; tone: 'primary' | 'success' | 'info'; title: string; message: string; time: string } }) {
  const toneStyle = item.tone === 'success' ? styles.notificationIconSuccess : item.tone === 'info' ? styles.notificationIconInfo : styles.notificationIconPrimary;
  return (
    <View style={styles.notificationCard}>
      <View style={[styles.notificationIcon, toneStyle]}><Ionicons name={item.icon} size={22} color="#ffffff" /></View>
      <View style={styles.flex1}>
        <View style={styles.notificationCardHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
      </View>
    </View>
  );
}

function AccountScreen({ session, onLogout, onHome, onOpenProfiles, onChangePassword, notificationsEnabled, onToggleNotifications }: { session: PatientOtpLoginResponse; onLogout: () => void; onHome: () => void; onOpenProfiles: () => void; onChangePassword: () => void; notificationsEnabled: boolean; onToggleNotifications: (value: boolean) => void }) {
  const primaryPatient = session.patients[0];
  const displayName = primaryPatient?.fullName || 'Người bệnh';
  const phoneText = maskPhone(primaryPatient?.phone || '');
  const confirmLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Bạn có chắc muốn đăng xuất không?')) onLogout();
      return;
    }
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất không?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <View style={styles.accountScreen}>
      <View style={styles.accountHero}>
        <View style={styles.accountBubbleOne} />
        <View style={styles.accountBubbleTwo} />
        <View style={styles.accountAvatar}>
          <MedicalMark />
        </View>
        <Text style={styles.accountName}>{displayName}</Text>
        <Text style={styles.accountPhone}>{phoneText || 'Tài khoản người bệnh'}</Text>
      </View>

      <View style={styles.accountContent}>
        <AccountSection title="Tài khoản">
          <AccountRow icon="person" label="Thông tin cá nhân" onPress={onOpenProfiles} />
          <AccountRow icon="lock-closed" label="Đổi mật khẩu" onPress={onChangePassword} />
        </AccountSection>

        <AccountSection title="Cài đặt">
          <View style={styles.accountRow}>
            <View style={styles.accountRowIcon}><Ionicons name="notifications" size={21} color={colors.primary} /></View>
            <Text style={styles.accountRowText}>Nhận thông báo</Text>
            <Switch accessibilityLabel="Bật hoặc tắt nhận thông báo" value={notificationsEnabled} onValueChange={onToggleNotifications} trackColor={{ false: '#cbd5e1', true: colors.primarySoft }} thumbColor={notificationsEnabled ? colors.primary : '#f8fafc'} />
          </View>
        </AccountSection>

        <AccountSection title="Thông tin pháp lý">
          <AccountRow icon="document-text" label="Điều khoản dịch vụ" disabled />
          <AccountRow icon="document-text" label="Chính sách bảo mật" disabled />
          <AccountRow icon="document-text" label="Quy định sử dụng" disabled />
        </AccountSection>

        <Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất tài khoản" onPress={confirmLogout} style={styles.logoutCard}>
          <View style={[styles.accountRowIcon, styles.logoutIcon]}><Ionicons name="log-out-outline" size={22} color="#ef4444" /></View>
          <Text style={styles.logoutText}>Đăng xuất</Text>
          <Ionicons name="chevron-forward" size={22} color="#c7cdd8" />
        </Pressable>

        <View style={styles.accountVersionRow}>
          <View style={styles.certBadge}><Ionicons name="checkmark-done-circle" size={22} color="#0ea5e9" /><Text style={styles.certText}>Phiên bản ổn định</Text></View>
          <Text style={styles.versionText}>Patient Portal</Text>
        </View>
      </View>


    </View>
  );
}

function AccountSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.accountSectionWrap}>
      <Text style={styles.accountSectionTitle}>{title}</Text>
      <View style={styles.accountCard}>{children}</View>
    </View>
  );
}

function AccountRow({ icon, label, disabled = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled?: boolean; onPress?: () => void }) {
  const content = (
    <>
      <View style={styles.accountRowIcon}><Ionicons name={icon} size={21} color={disabled ? colors.muted : colors.primary} /></View>
      <Text style={[styles.accountRowText, disabled && styles.accountRowTextDisabled]}>{label}{disabled ? ' · Sắp ra mắt' : ''}</Text>
      {!disabled ? <Ionicons name="chevron-forward" size={22} color="#c7cdd8" /> : null}
    </>
  );

  if (onPress && !disabled) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.accountRow}>{content}</Pressable>;
  }

  return (
    <View accessibilityRole={disabled ? 'text' : 'button'} accessibilityLabel={`${label}${disabled ? ', sắp ra mắt' : ''}`} style={[styles.accountRow, disabled && styles.accountRowDisabled]}>
      {content}
    </View>
  );
}

function ChangePasswordScreen({ form, setForm, busy, onSubmit, onBack }: { form: { currentPassword: string; newPassword: string; confirmPassword: string }; setForm: (value: { currentPassword: string; newPassword: string; confirmPassword: string }) => void; busy: boolean; onSubmit: () => void; onBack: () => void }) {
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  return (
    <View style={styles.authScreen}>
      <BackHeader onBack={onBack} />
      <MedicalMark />
      <Text style={styles.authEyebrow}>Bảo mật tài khoản</Text>
      <Text style={styles.authTitle}>Đổi mật khẩu</Text>
      <Text style={styles.authSubtitle}>Sau khi đổi mật khẩu thành công, bạn sẽ cần đăng nhập lại để bảo vệ phiên truy cập.</Text>
      <View style={styles.authCard}>
        <FormInput label="Mật khẩu hiện tại" secureTextEntry value={form.currentPassword} onChangeText={(v) => update('currentPassword', v)} icon="lock-closed-outline" placeholder="Nhập mật khẩu hiện tại" accessibilityLabel="Mật khẩu hiện tại" />
        <FormInput label="Mật khẩu mới" secureTextEntry value={form.newPassword} onChangeText={(v) => update('newPassword', v)} icon="shield-checkmark-outline" placeholder="Tối thiểu 8 ký tự" accessibilityLabel="Mật khẩu mới" />
        <FormInput label="Xác nhận mật khẩu mới" secureTextEntry value={form.confirmPassword} onChangeText={(v) => update('confirmPassword', v)} icon="checkmark-done-outline" placeholder="Nhập lại mật khẩu mới" accessibilityLabel="Xác nhận mật khẩu mới" />
        <ActionButton label="Cập nhật mật khẩu" loading={busy} onPress={onSubmit} icon={<Ionicons name="key-outline" size={20} color="#ffffff" />} />
      </View>
    </View>
  );
}

function maskPhone(value: string) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return value;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function ProfileSelectionScreen({ patients, onOpenVisits, onCreateProfile, onBook }: { patients: PatientSummary[]; onOpenVisits: (patient: PatientSummary) => void; onCreateProfile: () => void; onBook: () => void }) {
  return (
    <View style={styles.profileScreen}>
      <View style={styles.profileHero}>
        <View style={styles.profileHeroBubbleOne} />
        <View style={styles.profileHeroBubbleTwo} />
        <View style={styles.profileHeroIcon}><Ionicons name="people-outline" size={29} color={colors.primary} /></View>
        <Text style={styles.profileHeroTitle}>Chọn hồ sơ</Text>
        <Text style={styles.profileHeroSubtitle}>Quản lý hồ sơ người bệnh được liên kết với tài khoản này.</Text>
      </View>

      <View style={styles.profileSummaryCard}>
        <View style={styles.profileSummaryIcon}><Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} /></View>
        <View style={styles.flex1}>
          <Text style={styles.profileSummaryTitle}>{patients.length} hồ sơ liên kết</Text>
          <Text style={styles.profileSummaryText}>Chọn đúng hồ sơ để xem đầy đủ thông tin cá nhân.</Text>
        </View>
      </View>

      <View style={styles.profileListPanel}>
        <View style={styles.profileListHeader}>
          <Text style={styles.profileSectionTitle}>Hồ sơ người bệnh</Text>
          <View style={styles.profileSecureChip}><Ionicons name="lock-closed" size={14} color={colors.primaryDark} /><Text style={styles.profileSecureText}>Bảo mật</Text></View>
        </View>
        {patients.length ? patients.map((patient, index) => (
          <PatientProfileCard key={patient.id} patient={patient} index={index} onPress={() => onOpenVisits(patient)} />
        )) : <EmptyState text="Chưa có hồ sơ bệnh nhân liên kết với số điện thoại này." />}
      </View>

      <Pressable onPress={onBook} style={styles.switchAccountCard}>
        <View style={styles.switchAccountIcon}><Ionicons name="calendar-clear-outline" size={22} color={colors.primary} /></View>
        <View style={styles.flex1}>
          <Text style={styles.switchAccountTitle}>Đặt lịch khám tại nhà</Text>
          <Text style={styles.switchAccountText}>Chọn chuyên khoa, bác sĩ và nhận mã QR check-in.</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9aa8b8" />
      </Pressable>

      <Pressable onPress={onCreateProfile} style={styles.switchAccountCard}>
        <View style={styles.switchAccountIcon}><Ionicons name="person-add-outline" size={22} color={colors.primary} /></View>
        <View style={styles.flex1}>
          <Text style={styles.switchAccountTitle}>Tạo hồ sơ bệnh nhân mới</Text>
          <Text style={styles.switchAccountText}>Dành cho người bệnh chưa có hồ sơ trong hệ thống.</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9aa8b8" />
      </Pressable>
    </View>
  );
}

function PatientProfileCard({ patient, index, onPress }: { patient: PatientOtpLoginResponse['patients'][number]; index: number; onPress: () => void }) {
  const initial = patient.fullName.slice(0, 1).toUpperCase();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.patientProfileCard, pressed ? styles.patientProfileCardPressed : null]}>
      <View style={[styles.patientProfileAvatar, index % 2 === 1 && styles.patientProfileAvatarAlt]}>
        <Text style={styles.patientProfileInitial}>{initial}</Text>
      </View>
      <View style={styles.flex1}>
        <Text style={styles.patientProfileName}>{patient.fullName}</Text>
        <View style={styles.patientProfileMetaRow}>
          <Ionicons name="barcode-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.patientProfileCode}>{patient.patientCode}</Text>
        </View>
        {patient.phone ? (
          <View style={styles.patientProfileMetaRow}>
            <Ionicons name="call-outline" size={14} color="#64748b" />
            <Text style={styles.patientProfilePhone}>{maskPhone(patient.phone)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.patientProfileAction}>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </View>
    </Pressable>
  );
}

function ProfileDetailScreen({ patient, onBack, onOpenVisits }: { patient: PatientSummary; onBack: () => void; onOpenVisits: () => void }) {
  const rows = [
    { icon: 'barcode-outline' as const, label: 'Mã bệnh nhân', value: patient.patientCode },
    { icon: 'person-outline' as const, label: 'Họ và tên', value: patient.fullName },
    { icon: 'male-female-outline' as const, label: 'Giới tính', value: formatGender(patient.gender) },
    { icon: 'calendar-outline' as const, label: 'Ngày sinh', value: formatDate(patient.birthDate) },
    { icon: 'card-outline' as const, label: 'CCCD/CMND', value: patient.citizenId || 'Chưa cập nhật' },
    { icon: 'call-outline' as const, label: 'Số điện thoại', value: patient.contactPhone || patient.phone || 'Chưa cập nhật' },
    { icon: 'location-outline' as const, label: 'Địa chỉ', value: patient.address || 'Chưa cập nhật' },
    { icon: 'shield-checkmark-outline' as const, label: 'Số BHYT', value: patient.insuranceNumber || 'Chưa cập nhật' },
    { icon: 'medkit-outline' as const, label: 'Liên hệ khẩn cấp', value: patient.emergencyContact || 'Chưa cập nhật' },
  ];

  return (
    <View style={styles.profileScreen}>
      <BackHeader onBack={onBack} />
      <View style={styles.profileHero}>
        <View style={styles.profileHeroBubbleOne} />
        <View style={styles.profileHeroBubbleTwo} />
        <View style={styles.patientProfileAvatar}>
          <Text style={styles.patientProfileInitial}>{patient.fullName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.profileHeroTitle}>{patient.fullName}</Text>
        <Text style={styles.profileHeroSubtitle}>Thông tin cá nhân trong hồ sơ bệnh nhân.</Text>
      </View>

      <View style={styles.profileListPanel}>
        <View style={styles.profileListHeader}>
          <Text style={styles.profileSectionTitle}>Chi tiết hồ sơ</Text>
          <View style={styles.profileSecureChip}><Ionicons name="shield-checkmark" size={14} color={colors.primaryDark} /><Text style={styles.profileSecureText}>Đã xác thực</Text></View>
        </View>
        {rows.map((row) => (
          <View key={row.label} style={styles.profileDetailRow}>
            <View style={styles.accountRowIcon}><Ionicons name={row.icon} size={20} color={colors.primary} /></View>
            <View style={styles.flex1}>
              <Text style={styles.profileDetailLabel}>{row.label}</Text>
              <Text style={styles.profileDetailValue}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable onPress={onOpenVisits} style={styles.switchAccountCard}>
        <View style={styles.switchAccountIcon}><Ionicons name="folder-open-outline" size={22} color={colors.primary} /></View>
        <View style={styles.flex1}>
          <Text style={styles.switchAccountTitle}>Xem lịch sử khám</Text>
          <Text style={styles.switchAccountText}>Mở các lần khám và kết quả cận lâm sàng của hồ sơ này.</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9aa8b8" />
      </Pressable>
    </View>
  );
}

function formatGender(value?: string | null) {
  if (value === 'MALE') return 'Nam';
  if (value === 'FEMALE') return 'Nữ';
  return value || 'Chưa cập nhật';
}

function CreateProfileScreen({ form, errors, setForm, busy, onSubmit, onBack }: { form: ProfileForm; errors: ProfileFormErrors; setForm: (updater: (current: ProfileForm) => ProfileForm) => void; busy: boolean; onSubmit: () => void; onBack: () => void }) {
  const update = (key: keyof ProfileForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <View style={styles.profileScreen}>
      <View style={styles.profileHero}>
        <View style={styles.profileHeroIcon}><Ionicons name="person-add-outline" size={29} color={colors.primary} /></View>
        <Text style={styles.profileHeroTitle}>Tạo hồ sơ bệnh nhân</Text>
        <Text style={styles.profileHeroSubtitle}>Thông tin này sẽ được dùng khi đặt lịch và tiếp nhận tại bệnh viện.</Text>
      </View>
      <View style={styles.profileListPanel}>
        <FormInput label="Họ và tên" value={form.fullName} onChangeText={(v) => update('fullName', v)} icon="person-outline" placeholder="Nguyễn Văn A" accessibilityLabel="Họ và tên bệnh nhân" />
        {errors.fullName ? <Text style={styles.fieldErrorText}>{errors.fullName}</Text> : null}
        <GenderSelector value={form.gender} onChange={(value) => update('gender', value)} />
        {errors.gender ? <Text style={styles.fieldErrorText}>{errors.gender}</Text> : null}
        <BirthDateSelector value={form.birthDate} onChange={(value) => update('birthDate', value)} />
        {errors.birthDate ? <Text style={styles.fieldErrorText}>{errors.birthDate}</Text> : null}
        <FormInput label="CCCD/CMND" value={form.citizenId} onChangeText={(v) => update('citizenId', v.replace(/\D/g, '').slice(0, 12))} icon="card-outline" placeholder="Không bắt buộc" keyboardType="number-pad" accessibilityLabel="CCCD hoặc chứng minh nhân dân" />
        {errors.citizenId ? <Text style={styles.fieldErrorText}>{errors.citizenId}</Text> : null}
        <FormInput label="Địa chỉ" value={form.address} onChangeText={(v) => update('address', v)} icon="location-outline" placeholder="Không bắt buộc" accessibilityLabel="Địa chỉ bệnh nhân" />
        <FormInput label="Liên hệ khẩn cấp" value={form.emergencyContact} onChangeText={(v) => update('emergencyContact', v)} icon="call-outline" placeholder="Không bắt buộc" keyboardType="phone-pad" accessibilityLabel="Số điện thoại liên hệ khẩn cấp" />
        {errors.emergencyContact ? <Text style={styles.fieldErrorText}>{errors.emergencyContact}</Text> : null}
        <ActionButton label="Tạo hồ sơ" loading={busy} onPress={onSubmit} icon={<Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />} />
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.linkButton}><Text style={styles.linkText}>Quay lại</Text></Pressable>
      </View>
    </View>
  );
}

function GenderSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [
    { label: 'Nam', value: 'MALE', icon: 'male-outline' as const },
    { label: 'Nữ', value: 'FEMALE', icon: 'female-outline' as const },
  ];
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <View style={styles.genderField}>
      <Text style={styles.label}>Giới tính</Text>
      {open ? (
        <View style={styles.genderDropdownMenu}>
          {options.map((option) => {
            const active = value === option.value;
            return (
              <Pressable key={option.value} onPress={() => { onChange(option.value); setOpen(false); }} style={[styles.genderDropdownItem, active && styles.genderDropdownItemActive]}>
                <Ionicons name={option.icon} size={18} color={active ? colors.primary : '#64748b'} />
                <Text style={[styles.genderDropdownText, active && styles.genderDropdownTextActive]}>{option.label}</Text>
                {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((current) => !current)} style={[styles.genderDropdownTrigger, open && styles.genderDropdownTriggerActive]}>
        <View style={styles.genderDropdownValueRow}>
          <Ionicons name={selected.icon} size={20} color={colors.primaryDark} />
          <Text style={styles.genderDropdownValue}>{selected.label}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#0f172a" />
      </Pressable>
    </View>
  );
}

function BirthDateSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = parseBirthDate(value);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [viewYear, setViewYear] = useState(parsed.year);
  const selectedDate = value;
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const days = buildCalendarDays(viewMonth, viewYear);

  const moveMonth = (direction: -1 | 1) => {
    setViewMonth((current) => {
      const next = current + direction;
      if (next < 1) {
        setViewYear((year) => year - 1);
        return 12;
      }
      if (next > 12) {
        setViewYear((year) => year + 1);
        return 1;
      }
      return next;
    });
  };

  const selectDate = (dateValue: string) => {
    onChange(dateValue);
    setOpen(false);
  };

  return (
    <View style={styles.datePickerField}>
      <Text style={styles.label}>Ngày sinh</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.datePickerTrigger}>
        <Ionicons name="calendar-outline" size={22} color={colors.primaryDark} />
        <Text style={[styles.datePickerValue, !value && styles.datePickerPlaceholder]}>{value || 'Chọn ngày sinh'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#94a3b8" />
      </Pressable>
      {open ? (
        <View style={styles.calendarPanel}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => moveMonth(-1)} style={styles.calendarNavButton}><Ionicons name="chevron-back" size={20} color={colors.primaryDark} /></Pressable>
            <View style={styles.calendarTitleBlock}>
              <Text style={styles.calendarTitle}>{monthNames[viewMonth - 1]}</Text>
              <Text style={styles.calendarYear}>{viewYear}</Text>
            </View>
            <Pressable onPress={() => moveMonth(1)} style={styles.calendarNavButton}><Ionicons name="chevron-forward" size={20} color={colors.primaryDark} /></Pressable>
          </View>
          <View style={styles.calendarWeekRow}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((item) => <Text key={item} style={styles.calendarWeekText}>{item}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {days.map((item, index) => {
              const active = item.dateValue === selectedDate;
              return (
                <Pressable key={`${item.dateValue}-${index}`} onPress={() => item.inMonth && selectDate(item.dateValue)} disabled={!item.inMonth} style={[styles.calendarDay, active && styles.calendarDayActive, !item.inMonth && styles.calendarDayMuted]}>
                  <Text style={[styles.calendarDayText, active && styles.calendarDayTextActive, !item.inMonth && styles.calendarDayTextMuted]}>{item.day}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function parseBirthDate(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const now = new Date();
  return {
    day: Number.isFinite(day) && day > 0 ? day : 1,
    month: Number.isFinite(month) && month > 0 ? month : now.getMonth() + 1,
    year: Number.isFinite(year) && year > 0 ? year : now.getFullYear() - 25,
  };
}

function buildCalendarDays(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = daysInMonth(month, year);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousTotalDays = daysInMonth(previousMonth, previousYear);
  const cells: Array<{ day: number; dateValue: string; inMonth: boolean }> = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    const day = previousTotalDays - index;
    cells.push({ day, dateValue: `${previousYear}-${pad2(previousMonth)}-${pad2(day)}`, inMonth: false });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ day, dateValue: `${year}-${pad2(month)}-${pad2(day)}`, inMonth: true });
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ day: nextDay, dateValue: `${nextYear}-${pad2(nextMonth)}-${pad2(nextDay)}`, inMonth: false });
    nextDay += 1;
  }
  return cells;
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

type BookingScreenProps = {
  patient: PatientOtpLoginResponse['patients'][number] | null;
  patients: PatientOtpLoginResponse['patients'];
  selectedPatientId: string;
  stage: BookingStage;
  specialties: BookableSpecialty[];
  doctors: BookableDoctor[];
  slots: AppointmentSlot[];
  appointments: PatientAppointment[];
  specialty: string;
  doctorId: string;
  selectedSlot: string;
  date: string;
  busy: boolean;
  busyStage: BookingBusyStage;
  onCreateProfile: () => void;
  onPatient: (patientId: string) => void;
  onStage: (stage: BookingStage) => void;
  onSpecialty: (specialty: string) => void;
  onDoctor: (doctorId: string) => void;
  onDate: (date: string) => void;
  onSlot: (slot: string) => void;
  onSubmit: () => void;
  onQr: (appointmentId: string) => void;
  expandedQrIds: Record<string, boolean>;
  qrRefs: React.MutableRefObject<Record<string, { toDataURL?: (callback: (data: string) => void) => void } | null>>;
  onOpenQr: (appointmentId: string) => void;
  onCloseQr: (appointmentId: string) => void;
  onDownloadQr: (appointment: PatientAppointment) => void;
};

function BookingScreen({ patient, patients, selectedPatientId, stage, specialties, doctors, slots, appointments, specialty, doctorId, selectedSlot, date, busy, busyStage, onCreateProfile, onPatient, onStage, onSpecialty, onDoctor, onDate, onSlot, onSubmit, onQr, expandedQrIds, qrRefs, onOpenQr, onCloseQr, onDownloadQr }: BookingScreenProps) {
  const selectedSpecialty = specialties.find((item) => item.value === specialty);
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  return (
    <View style={styles.bookingScreen}>


      {stage === 'profiles' ? (
        <BookingProfilePage patients={patients} selectedPatientId={selectedPatientId} onPatient={onPatient} onCreateProfile={onCreateProfile} />
      ) : null}

      {stage === 'specialty' ? (
        <BookingSpecialtyPage specialties={specialties} specialty={specialty} loading={busyStage === 'specialties'} onSpecialty={onSpecialty} />
      ) : null}

      {stage === 'doctor' ? (
        <BookingDoctorPage doctors={doctors} doctorId={doctorId} loading={busyStage === 'doctors'} onDoctor={onDoctor} />
      ) : null}

      {stage === 'slot' ? (
        <BookingSlotPage date={date} slots={slots} selectedSlot={selectedSlot} loading={busyStage === 'slots'} hasDoctor={Boolean(doctorId)} onDate={onDate} onSlot={(slot: string) => { onSlot(slot); onStage('confirm'); }} />
      ) : null}

      {stage === 'confirm' ? (
        <BookingConfirmPage patient={patient} specialty={selectedSpecialty} doctor={selectedDoctor} slot={selectedSlot} busy={busyStage === 'submit' || busy} onSubmit={onSubmit} />
      ) : null}

      {stage === 'qr' ? (
        <BookingQrPage appointments={appointments} expandedQrIds={expandedQrIds} qrRefs={qrRefs} loadingQr={busyStage === 'qr'} onQr={onQr} onOpenQr={onOpenQr} onCloseQr={onCloseQr} onDownloadQr={onDownloadQr} />
      ) : null}
    </View>
  );
}

function previousBookingStage(stage: BookingStage): BookingStage {
  const order: BookingStage[] = ['profiles', 'specialty', 'doctor', 'slot', 'confirm', 'qr'];
  const index = order.indexOf(stage);
  return order[Math.max(index - 1, 0)];
}



function BookingProfilePage({ patients, selectedPatientId, onPatient, onCreateProfile }: any) {
  return (
    <BookingStepPage title="Chọn hồ sơ" subtitle="Chọn hồ sơ người bệnh cần đặt lịch">
      <Pressable onPress={onCreateProfile} style={styles.addProfileButton}>
        <Ionicons name="person-add-outline" size={20} color="#ffffff" />
        <Text style={styles.addProfileText}>Thêm hồ sơ</Text>
      </Pressable>
      {patients.map((profile: PatientOtpLoginResponse['patients'][number]) => (
        <Pressable key={profile.id} onPress={() => onPatient(profile.id)} style={({ pressed }) => [styles.bookingListCard, selectedPatientId === profile.id && styles.bookingListCardActive, pressed && styles.bookingPressed]}>
          <View style={styles.bookingAvatar}><Text style={styles.bookingAvatarText}>{profile.fullName?.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.flex1}>
            <Text style={styles.bookingListTitle}>{profile.fullName}</Text>
            <View style={styles.bookingMetaLine}>
              <Ionicons name="card-outline" size={15} color="#64748b" />
              <Text style={styles.bookingMetaText}>{profile.patientCode}</Text>
              <Ionicons name="call" size={14} color="#64748b" />
              <Text style={styles.bookingMetaText}>{profile.phone ? maskPhone(profile.phone) : 'Chưa có SĐT'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
        </Pressable>
      ))}
    </BookingStepPage>
  );
}

function BookingSpecialtyPage({ specialties, specialty, onSpecialty }: any) {
  return (
    <BookingStepPage title="Chọn chuyên khoa" subtitle="Chọn chuyên khoa cần khám để xem bác sĩ phù hợp">
      {specialties.map((item: BookableSpecialty) => (
        <Pressable key={item.value} onPress={() => onSpecialty(item.value)} style={({ pressed }) => [styles.bookingSelectCard, specialty === item.value && styles.bookingSelectCardActive, pressed && styles.bookingPressed]}>
          <View style={styles.bookingSelectIcon}><Ionicons name="medkit-outline" size={20} color={specialty === item.value ? '#ffffff' : colors.primary} /></View>
          <Text style={[styles.bookingSelectTitle, specialty === item.value && styles.bookingSelectTitleActive]}>{item.label}</Text>
          <Text style={[styles.bookingSelectMeta, specialty === item.value && styles.bookingSelectMetaActive]}>{item.doctorCount} bác sĩ khả dụng</Text>
        </Pressable>
      ))}
      {!specialties.length ? <EmptyState text="Chưa có chuyên khoa khả dụng để đặt lịch." /> : null}
    </BookingStepPage>
  );
}

function BookingDoctorPage({ doctors, doctorId, onDoctor }: any) {
  return (
    <BookingStepPage title="Chọn bác sĩ" subtitle="Bác sĩ khả dụng theo chuyên khoa đã chọn">
      {doctors.map((doctor: BookableDoctor) => (
        <Pressable key={doctor.id} onPress={() => onDoctor(doctor.id)} style={({ pressed }) => [styles.bookingListCard, doctorId === doctor.id && styles.bookingListCardActive, pressed && styles.bookingPressed]}>
          <View style={styles.bookingAvatar}><Text style={styles.bookingAvatarText}>{doctor.fullName?.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.flex1}>
            <Text style={styles.bookingListTitle}>{doctor.fullName}</Text>
            <Text style={styles.bookingMetaText}>{doctor.specialtyLabel || doctor.specialty || 'Bác sĩ'} • {doctor.qualification || 'Chuyên môn'}</Text>
            <Text style={styles.bookingMetaText}>Phòng: {doctor.department?.name || 'Chưa phân phòng'}{doctor.department?.floor ? ` • Tầng ${doctor.department.floor}` : ''}</Text>
          </View>
        </Pressable>
      ))}
      {!doctors.length ? <EmptyState text="Chưa có bác sĩ khả dụng cho khoa này." /> : null}
    </BookingStepPage>
  );
}

function BookingSlotPage({ date, slots, onDate, onSlot }: any) {
  return (
    <BookingStepPage title="Chọn ngày giờ" subtitle="Chọn khung giờ phù hợp để đến bệnh viện">
      <View style={styles.bookingDateBox}>
        <Ionicons name="calendar-clear-outline" size={20} color={colors.primary} />
        <TextInput value={date} onChangeText={onDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" style={styles.bookingDateInput} />
      </View>
      <View style={styles.slotGrid}>
        {slots.map((slot: AppointmentSlot) => (
          <Pressable key={slot.startAt} disabled={!slot.available} onPress={() => onSlot(slot.startAt)} style={({ pressed }) => [styles.slotPill, !slot.available && styles.slotPillDisabled, pressed && slot.available && styles.bookingPressed]}>
            <Text style={[styles.slotTime, !slot.available && styles.slotTimeDisabled]}>{formatTime(slot.startAt)}</Text>
            <Text style={[styles.slotStatus, !slot.available && styles.slotStatusDisabled]}>{slot.available ? 'Còn trống' : 'Đã kín'}</Text>
          </Pressable>
        ))}
      </View>
    </BookingStepPage>
  );
}

function BookingConfirmPage({ patient, specialty, doctor, slot, busy, onSubmit }: any) {
  return (
    <BookingStepPage title="Xác nhận thông tin" subtitle="Kiểm tra lại trước khi tạo mã QR check-in">
      <View style={styles.bookingSummaryBox}>
        <Text style={styles.bookingSummaryText}>Hồ sơ: {patient?.fullName || 'N/A'}</Text>
        <Text style={styles.bookingSummaryText}>Chuyên khoa: {specialty?.label || doctor?.specialtyLabel || 'N/A'}</Text>
        <Text style={styles.bookingSummaryText}>Bác sĩ: {doctor?.fullName || 'N/A'}</Text>
        <Text style={styles.bookingSummaryText}>Phòng ban: {doctor?.department?.name || 'N/A'}</Text>
        <Text style={styles.bookingSummaryText}>Ngày: {slot || 'N/A'}</Text>
      </View>
      <ActionButton label="Xác nhận đặt lịch" loading={busy} onPress={onSubmit} icon={<Ionicons name="qr-code-outline" size={20} color="#ffffff" />} />
    </BookingStepPage>
  );
}

function getAppointmentStatusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: 'Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận',
    CHECKED_IN: 'Đã check-in',
    CANCELLED: 'Đã hủy',
    COMPLETED: 'Hoàn tất',
  };
  return map[status] || 'Không xác định';
}

function BookingQrPage({ appointments, expandedQrIds, qrRefs, loadingQr, onQr, onOpenQr, onCloseQr, onDownloadQr }: { appointments: PatientAppointment[]; expandedQrIds: Record<string, boolean>; qrRefs: React.MutableRefObject<Record<string, { toDataURL?: (callback: (data: string) => void) => void } | null>>; loadingQr: boolean; onQr: (appointmentId: string) => void; onOpenQr: (appointmentId: string) => void; onCloseQr: (appointmentId: string) => void; onDownloadQr: (appointment: PatientAppointment) => void }) {
  return (
    <BookingStepPage title="Lịch hẹn của bạn" subtitle="Đưa mã QR này cho lễ tân để check-in nhanh">
      {appointments.length ? appointments.map((appointment) => {
        const qrVisible = appointment.status !== 'CHECKED_IN' && Boolean(appointment.qrPayload) && expandedQrIds[appointment.id];
        return (
        <View key={appointment.id} style={styles.appointmentTicket}>
          <View style={styles.ticketTopRow}>
            <View style={styles.flex1}>
              <Text style={styles.ticketCode}>{appointment.appointmentCode}</Text>
              <Text style={styles.ticketMeta}>{appointment.department?.name || 'Khoa khám'} • {formatDateTime(appointment.scheduledAt)}</Text>
              {appointment.doctor?.fullName ? <Text style={styles.ticketMeta}>Bác sĩ: {appointment.doctor.fullName}</Text> : null}
            </View>
            <Text style={styles.ticketStatus}>{getAppointmentStatusLabel(appointment.status)}</Text>
          </View>
          {qrVisible ? (
            <>
              <View style={styles.qrBox} accessibilityLabel={`Mã QR check-in cho lịch hẹn ${appointment.appointmentCode}`}>
                <QRCode getRef={(ref) => { qrRefs.current[appointment.id] = ref; }} value={appointment.qrPayload || ''} size={170} backgroundColor="#ffffff" color={colors.primaryDark} />
              </View>
              <View style={styles.qrActionRow}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Tải QR cho lịch hẹn ${appointment.appointmentCode}`} onPress={() => onDownloadQr(appointment)} style={styles.qrSecondaryButton}><Ionicons name="download-outline" size={17} color={colors.primaryDark} /><Text style={styles.qrSecondaryButtonText}>Tải QR</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Đóng QR cho lịch hẹn ${appointment.appointmentCode}`} onPress={() => onCloseQr(appointment.id)} style={styles.qrSecondaryButton}><Ionicons name="close-outline" size={18} color={colors.primaryDark} /><Text style={styles.qrSecondaryButtonText}>Đóng</Text></Pressable>
              </View>
            </>
          ) : null}
          {appointment.status === 'CHECKED_IN' ? (
            <View style={styles.checkedInNotice}><Ionicons name="checkmark-circle" size={18} color="#047857" /><Text style={styles.checkedInNoticeText}>Lịch hẹn đã được check-in tại quầy.</Text></View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={`Hiển thị QR cho lịch hẹn ${appointment.appointmentCode}`} disabled={loadingQr} onPress={() => appointment.qrPayload ? onOpenQr(appointment.id) : onQr(appointment.id)} style={[styles.qrButton, loadingQr && styles.actionDisabled]}><Ionicons name="qr-code-outline" size={18} color="#ffffff" /><Text style={styles.qrButtonText}>{loadingQr ? 'Đang tải QR...' : qrVisible ? 'Làm mới QR' : 'Hiển thị QR'}</Text></Pressable>
          )}
        </View>
        );
      }) : <EmptyState text="Bạn chưa có lịch hẹn nào." />}
    </BookingStepPage>
  );
}

function BookingStepPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.bookingStepPage}>
      <Text style={styles.bookingStepTitle}>{title}</Text>
      {subtitle ? <Text style={styles.bookingStepSubtitle}>{subtitle}</Text> : null}
      <View style={styles.bookingCardGrid}>{children}</View>
    </View>
  );
}



function VisitHistoryScreen({ patient, visits, busy, onOpenDetail }: { patient: PatientOtpLoginResponse['patients'][number] | null; visits: PatientVisitSummary[]; busy: boolean; onOpenDetail: (visitId: string) => void }) {
  const latestVisit = visits[0];

  return (
    <View style={styles.visitHistoryScreen}>
      <View style={styles.visitHero}>
        <View style={styles.visitHeroBubbleOne} />
        <View style={styles.visitHeroBubbleTwo} />
        <View style={styles.visitHeroTopRow}>
          <View style={styles.visitHeroIcon}><Ionicons name="document-text-outline" size={27} color={colors.primary} /></View>
          <Text style={styles.visitHeroLabel}>Hồ sơ minh bạch</Text>
        </View>
        <Text style={styles.visitHeroTitle}>Lịch sử khám</Text>
        <Text style={styles.visitHeroSubtitle}>{patient ? `${patient.fullName} • ${patient.patientCode}` : 'Hồ sơ bệnh nhân'}</Text>
      </View>

      <View style={styles.visitSummaryRow}>
        <View style={styles.visitSummaryCard}>
          <Text style={styles.visitSummaryValue}>{visits.length}</Text>
          <Text style={styles.visitSummaryLabel}>Lượt khám</Text>
        </View>
        <View style={styles.visitSummaryCard}>
          <Text style={styles.visitSummaryValue}>{latestVisit ? formatDate(latestVisit.checkInAt) : '--'}</Text>
          <Text style={styles.visitSummaryLabel}>Gần nhất</Text>
        </View>
      </View>

      <View style={styles.visitListPanel}>
        <View style={styles.visitListHeader}>
          <Text style={styles.visitSectionTitle}>Danh sách lượt khám</Text>
          <View style={styles.visitFilterChip}><Ionicons name="filter" size={16} color={colors.primary} /><Text style={styles.visitFilterText}>Tất cả</Text></View>
        </View>
        {busy ? <Text style={styles.visitLoadingText}>Đang tải lịch sử khám...</Text> : null}
        {visits.length ? visits.map((visit, index) => (
          <VisitHistoryCard key={visit.id} visit={visit} first={index === 0} onPress={() => onOpenDetail(visit.id)} />
        )) : <EmptyState text="Chưa có lượt khám nào cho bệnh nhân." />}
      </View>
    </View>
  );
}

function VisitHistoryCard({ visit, first, onPress }: { visit: PatientVisitSummary; first: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.visitHistoryCard, pressed ? styles.visitHistoryCardPressed : null]}>
      <View style={styles.visitTimelineColumn}>
        <View style={[styles.visitTimelineDot, first && styles.visitTimelineDotActive]} />
        <View style={styles.visitTimelineLine} />
      </View>
      <View style={styles.visitCardBody}>
        <View style={styles.visitCardTopRow}>
          <View style={styles.visitCodePill}><Ionicons name="medkit-outline" size={15} color={colors.primary} /><Text style={styles.visitCodeText}>{visit.visitCode}</Text></View>
          <Ionicons name="chevron-forward" size={22} color="#9aa8b8" />
        </View>
        <Text style={styles.visitDepartment}>{visit.department?.name || 'Chưa có khoa'}</Text>
        <View style={styles.visitMetaRow}>
          <View style={styles.visitMetaItem}><Ionicons name="calendar-clear-outline" size={15} color="#64748b" /><Text style={styles.visitMetaText}>{formatDate(visit.checkInAt)}</Text></View>
          <View style={styles.visitMetaItem}><Ionicons name="time-outline" size={15} color="#64748b" /><Text style={styles.visitMetaText}>{formatTime(visit.checkInAt)}</Text></View>
        </View>
        {visit.finalDiagnosis ? (
          <View style={styles.visitDiagnosisBox}>
            <Ionicons name="pulse-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.visitDiagnosisText} numberOfLines={2}>{visit.finalDiagnosis}</Text>
          </View>
        ) : (
          <View style={styles.visitPendingBox}>
            <Ionicons name="hourglass-outline" size={15} color="#b45309" />
            <Text style={styles.visitPendingText}>Chưa có chẩn đoán cuối</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function VisitDetailScreen({ visitDetail, previewUrls, fileBusyId, onBack, onOpenFile }: { visitDetail: PatientVisitDetail; previewUrls: PreviewUrls; fileBusyId: string; onBack: () => void; onOpenFile: (fileId: string, preview?: boolean) => void }) {
  return (
    <View style={styles.detailScreen}>
      <View style={styles.detailHero}>
        <View style={styles.detailHeroBubbleOne} />
        <View style={styles.detailHeroBubbleTwo} />
        <Pressable onPress={onBack} style={styles.detailBackButton}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={styles.detailBackText}>Lịch sử khám</Text>
        </Pressable>
        <Text style={styles.detailHeroTitle}>Chi tiết lượt khám</Text>
        <Text style={styles.detailHeroSubtitle}>{visitDetail.visitCode} • {formatDateTime(visitDetail.checkInAt)}</Text>
      </View>

      <View style={styles.detailSummaryGrid}>
        <View style={styles.detailSummaryCard}>
          <Ionicons name="person-outline" size={22} color={colors.primary} />
          <Text style={styles.detailSummaryLabel}>Bệnh nhân</Text>
          <Text style={styles.detailSummaryValue} numberOfLines={1}>{visitDetail.patient.fullName}</Text>
        </View>
        <View style={styles.detailSummaryCard}>
          <Ionicons name="business-outline" size={22} color={colors.primary} />
          <Text style={styles.detailSummaryLabel}>Khoa khám</Text>
          <Text style={styles.detailSummaryValue} numberOfLines={1}>{visitDetail.department?.name || 'Chưa có khoa'}</Text>
        </View>
      </View>

      <DetailSection title="Tổng quan lượt khám" icon="clipboard-outline">
        <Info label="Mã bệnh nhân" value={visitDetail.patient.patientCode} />
      </DetailSection>

      {visitDetail.conclusion ? (
        <DetailSection title="Hồ sơ chẩn đoán chính thức" icon="pulse-outline">
          <Info label="Chẩn đoán xác định" value={visitDetail.conclusion.finalDiagnosis} />
          {visitDetail.conclusion.treatmentPlan ? <Info label="Hướng điều trị" value={visitDetail.conclusion.treatmentPlan} /> : null}
          {visitDetail.conclusion.prescription ? <Info label="Đơn thuốc / chỉ định" value={visitDetail.conclusion.prescription} /> : null}
          {visitDetail.conclusion.followUpNote ? <Info label="Dặn dò tái khám" value={visitDetail.conclusion.followUpNote} /> : null}
          {visitDetail.conclusion.doctorNote ? <Info label="Ghi chú bác sĩ" value={visitDetail.conclusion.doctorNote} /> : null}
        </DetailSection>
      ) : <View style={styles.detailSection}><EmptyState text="Chưa có kết luận chính thức từ bác sĩ." /></View>}

      <DetailSection title="Gợi ý AI hỗ trợ bác sĩ" icon="sparkles-outline">
        {visitDetail.aiDiagnoses?.length ? visitDetail.aiDiagnoses.map((aiDiagnosis, index) => (
          <AiDiagnosisCard key={aiDiagnosis.id || index} aiDiagnosis={aiDiagnosis} index={index} />
        )) : <EmptyState text="Không có bản phân tích AI được công bố cho lượt khám này." />}
      </DetailSection>

      <DetailSection title="Chỉ định & kết quả cận lâm sàng" icon="flask-outline">
        {visitDetail.orders.length ? visitDetail.orders.map((order) => (
          <View key={order.id} style={styles.detailOrderCard}>
            <View style={styles.detailOrderHeader}>
              <View style={styles.detailOrderIcon}><Ionicons name="document-attach-outline" size={20} color={colors.primary} /></View>
              <View style={styles.flex1}>
                <Text style={styles.detailOrderTitle}>{order.orderType}</Text>
                <Text style={styles.detailOrderCode}>{order.orderCode} • {order.status}</Text>
              </View>
            </View>
            {order.targetDepartment ? <Text style={styles.detailMuted}>Đơn vị thực hiện: {order.targetDepartment.name}</Text> : null}
            {order.clinicalNote ? <Text style={styles.detailMuted}>{order.clinicalNote}</Text> : null}
            {order.results.length ? order.results.map((result) => (
              <View key={result.id} style={styles.detailResultCard}>
                <Text style={styles.detailResultCode}>{result.resultCode}</Text>
                <Text style={styles.detailMuted}>Trả kết quả: {formatDateTime(result.returnedAt)}</Text>
                {result.note ? <Text style={styles.detailResultNote}>{result.note}</Text> : null}
                {result.files.length ? result.files.map((file) => (
                  <View key={file.id} style={styles.detailFileCard}>
                    {previewUrls[file.id] ? <Image source={{ uri: previewUrls[file.id] }} style={styles.previewImage} /> : <View style={styles.detailFileIcon}><Ionicons name={file.isImage ? 'image-outline' : 'document-outline'} size={24} color={colors.primary} /></View>}
                    <View style={styles.flex1}>
                      <Text style={styles.fileName}>{file.originalName}</Text>
                      <Text style={styles.helper}>{file.mimeType} • {formatBytes(file.size)}</Text>
                    </View>
                    {file.isImage && !previewUrls[file.id] ? (
                      <Pressable disabled={fileBusyId === file.id} onPress={() => onOpenFile(file.id, true)} style={styles.detailFileButtonSecondary}>
                        <Text style={styles.detailFileButtonSecondaryText}>{fileBusyId === file.id ? '...' : 'Xem ảnh'}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable disabled={fileBusyId === file.id} onPress={() => onOpenFile(file.id)} style={styles.fileButton}>
                      <Text style={styles.fileButtonText}>Mở</Text>
                    </Pressable>
                  </View>
                )) : <Text style={styles.detailMuted}>Không có tệp đính kèm.</Text>}
              </View>
            )) : <Text style={styles.detailMuted}>Chưa có kết quả.</Text>}
          </View>
        )) : <EmptyState text="Không có chỉ định y tế." />}
      </DetailSection>
    </View>
  );
}

function AiDiagnosisCard({ aiDiagnosis, index }: { aiDiagnosis: PatientAiDiagnosis; index: number }) {
  const parsed = parseMobileAiDiagnosis(aiDiagnosis.result);
  const primary = parsed.probabilities[0];
  const confidence = formatMobileConfidence(aiDiagnosis.confidence);
  return (
    <View style={styles.aiDiagnosisCard}>
      <View style={styles.aiDiagnosisHeader}>
        <Text style={styles.aiDiagnosisTitle}>Phân tích AI #{index + 1}</Text>
        {confidence ? <Text style={styles.aiConfidencePill}>{confidence}</Text> : null}
      </View>
      <Text style={styles.aiSummaryText}>{parsed.summary}</Text>
      {primary ? (
        <View style={styles.aiPrimaryBox}>
          <Text style={styles.aiPrimaryLabel}>Gợi ý chính</Text>
          <Text style={styles.aiPrimaryText}>{primary.condition || 'Chẩn đoán gợi ý'}{primary.probability != null ? ` · ${primary.probability}%` : ''}</Text>
          {primary.reason ? <Text style={styles.aiReasonText}>{primary.reason}</Text> : null}
        </View>
      ) : null}
      {parsed.nextSteps.length ? (
        <View style={styles.aiNextBox}>
          <Text style={styles.aiPrimaryLabel}>Khuyến nghị tiếp theo</Text>
          {parsed.nextSteps.map((step, stepIndex) => <Text key={stepIndex} style={styles.aiReasonText}>• {step}</Text>)}
        </View>
      ) : null}
      <Text style={styles.aiMetaText}>
        {aiDiagnosis.aiModel?.modelName || 'AI'} {aiDiagnosis.aiModel?.modelVersion ? `(v${aiDiagnosis.aiModel.modelVersion})` : ''}
        {aiDiagnosis.createdAt ? ` · ${formatDateTime(aiDiagnosis.createdAt)}` : ''}
      </Text>
    </View>
  );
}

function parseMobileAiDiagnosis(raw?: string | null) {
  if (!raw) return { summary: 'Chưa có nội dung gợi ý.', probabilities: [] as Array<any>, nextSteps: [] as string[] };
  try {
    const parsed = JSON.parse(raw);
    const analysis = parsed.analysis && typeof parsed.analysis === 'object' ? parsed.analysis : parsed;
    return {
      summary: analysis.summary || parsed.summary || analysis.diagnosis || parsed.diagnosis || 'AI đã phân tích nhưng chưa có tóm tắt.',
      probabilities: Array.isArray(analysis.diagnosticProbabilities) ? analysis.diagnosticProbabilities.slice(0, 3) : [],
      nextSteps: Array.isArray(analysis.recommendedNextSteps) ? analysis.recommendedNextSteps.slice(0, 3) : [],
    };
  } catch {
    return { summary: raw, probabilities: [] as Array<any>, nextSteps: [] as string[] };
  }
}

function formatMobileConfidence(value?: number | null) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const percent = raw <= 1 ? raw * 100 : raw;
  return `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
}

function DetailSection({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.detailSection}>
      <View style={styles.detailSectionHeader}>
        <View style={styles.detailSectionIcon}><Ionicons name={icon} size={21} color={colors.primary} /></View>
        <Text style={styles.detailSectionTitle}>{title}</Text>
      </View>
      <View style={styles.detailSectionBody}>{children}</View>
    </View>
  );
}

function BackHeader({ onBack }: { onBack: () => void }) {
  return (
    <Pressable onPress={onBack} style={styles.backHeader}>
      <Ionicons name="arrow-back" size={26} color={colors.primaryDark} />
      <Text style={styles.backText}>Quay lại</Text>
    </Pressable>
  );
}

function AuthScaffold({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.authScreen}>
      <MedicalMark />
      <Text style={styles.authEyebrow}>{eyebrow}</Text>
      <Text style={styles.authTitle}>{title}</Text>
      <Text style={styles.authSubtitle}>{subtitle}</Text>
      <View style={styles.authCard}>{children}</View>
    </View>
  );
}

function MedicalMark({ large = false }: { large?: boolean }) {
  return (
    <View style={[styles.mark, large && styles.markLarge]}>
      <View style={styles.markRingOne} />
      <View style={styles.markRingTwo} />
      <View style={styles.markCore}><Ionicons name="add" size={large ? 34 : 26} color="#ffffff" /></View>
    </View>
  );
}

function FormInput({ label, icon, ...props }: { label: string; icon: keyof typeof Ionicons.glyphMap } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={22} color={colors.primaryDark} />
        <TextInput placeholderTextColor="#b9c5d3" style={styles.input} {...props} />
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>hoặc</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function ScreenHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderIcon}><Ionicons name={icon} size={25} color={colors.primary} /></View>
      <View style={styles.flex1}>
        <Text style={styles.screenTitle}>{title}</Text>
        <Text style={styles.screenSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="file-tray-outline" size={32} color={colors.muted} />
      <Text style={styles.helper}>{text}</Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  portalShell: { flex: 1, backgroundColor: colors.background },
  portalScroll: { flex: 1, backgroundColor: colors.background },
  content: { minHeight: '100%', padding: spacing.screen, gap: 18, backgroundColor: colors.background },
  contentWithTabs: { paddingTop: 0, paddingBottom: 4 },
  statusSpacer: { height: 10 },
  feedbackWrap: { position: 'absolute', top: 14, left: 18, right: 18, zIndex: 30, elevation: 30 },
  feedbackCard: { position: 'relative', borderRadius: 18, shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  feedbackClose: { position: 'absolute', top: 9, right: 9, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.82)' },
  fieldErrorText: { alignSelf: 'stretch', color: colors.danger, fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: -6 },
  actionDisabled: { opacity: 0.48 },
  onboardingScreen: { flex: 1, minHeight: 740, alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  heroArt: { width: '100%', height: 330, alignItems: 'center', justifyContent: 'center' },
  dotGrid: { position: 'absolute', right: 10, top: 10, width: 128, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#95def3' },
  frameBack: { position: 'absolute', width: 290, height: 250, borderRadius: 28, borderWidth: 8, borderColor: colors.accent, transform: [{ translateX: 12 }, { translateY: 16 }] },
  illustrationFrame: { width: 300, height: 260, borderRadius: 30, backgroundColor: '#dff4ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#bceeff' },
  doctorCircle: { width: 154, height: 154, borderRadius: 77, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#5ba9cf', shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  patientCircle: { position: 'absolute', right: 48, bottom: 42, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#ffffff' },
  chartCard: { position: 'absolute', left: 28, bottom: 36, width: 92, borderRadius: 18, backgroundColor: '#ffffff', padding: 12, gap: 7, shadowColor: '#5ba9cf', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  chartLine: { height: 6, width: 58, borderRadius: 4, backgroundColor: '#cfe2f4' },
  chartLineShort: { width: 38 },
  onboardingCopy: { alignItems: 'center', gap: 14, paddingHorizontal: 8, width: '100%' },
  onboardingTitle: { color: '#05070d', fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center' },
  onboardingText: { color: '#1f2937', fontSize: 16, lineHeight: 23, textAlign: 'center', fontWeight: '600' },
  pager: { marginTop: 18, flexDirection: 'row', gap: 10, alignItems: 'center' },
  pagerActive: { width: 30, height: 6, borderRadius: 6, backgroundColor: colors.primary },
  pagerDot: { width: 14, height: 6, borderRadius: 6, backgroundColor: '#cad1e3' },
  bottomActions: { width: '100%', flexDirection: 'row', gap: 16, paddingBottom: 18 },
  loginPill: { flex: 1, minHeight: 62, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  registerPill: { flex: 1, minHeight: 62, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  loginPillText: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  registerPillText: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  homeScreen: { flexGrow: 1, minHeight: '100%', marginHorizontal: -24, marginTop: -28, marginBottom: -24, paddingTop: 18, paddingBottom: 0, backgroundColor: '#eaf8ff', overflow: 'hidden' },
  homeGlowOne: { position: 'absolute', top: -84, left: -92, width: 270, height: 270, borderRadius: 135, backgroundColor: '#bdefff', opacity: 0.9 },
  homeGlowTwo: { position: 'absolute', top: 132, right: -122, width: 300, height: 300, borderRadius: 150, backgroundColor: '#cff7ff', opacity: 0.92 },
  homeHeader: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { flex: 1, color: colors.primaryDark, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  homeTitle: { color: colors.primary, fontSize: 38, lineHeight: 44, fontWeight: '900', marginTop: 10 },
  homeSubtitle: { color: colors.primaryDark, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  featurePanel: { marginHorizontal: 16, marginTop: -4, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, shadowColor: '#72b6d5', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 7 },
  featurePanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  featureTitle: { color: colors.primaryDark, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  homeTools: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 20, backgroundColor: '#eaf8ff', paddingHorizontal: 13, paddingVertical: 8 },
  toolDivider: { width: 1, height: 22, backgroundColor: '#add4e5' },
  featureGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  featureTile: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  featureTilePressed: { transform: [{ translateY: 1 }, { scale: 0.985 }] },
  featureTileDisabled: { opacity: 0.62 },
  featureIconBox: { width: 66, height: 66, borderRadius: 18, borderWidth: 1, borderColor: '#9bd5df', backgroundColor: '#f8fdff', alignItems: 'center', justifyContent: 'center', shadowColor: '#89bfd0', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  featureBadge: { position: 'absolute', right: 8, bottom: 8, width: 10, height: 10, borderRadius: 5, opacity: 0.78 },
  featureLabel: { minHeight: 38, color: colors.primaryDark, fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' },
  dashboardBanner: { height: 138, marginHorizontal: 16, marginTop: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#c9efff', borderWidth: 1, borderColor: '#b5e6f7' },
  bannerSky: { position: 'absolute', inset: 0, backgroundColor: '#bcecff' },
  bannerSun: { position: 'absolute', top: 14, right: 28, width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff8cf' },
  bannerBuildingLarge: { position: 'absolute', left: 46, bottom: 32, width: 126, height: 78, borderRadius: 8, backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#a5cde0', padding: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bannerBuildingSmall: { position: 'absolute', right: 44, bottom: 32, width: 72, height: 100, borderRadius: 8, backgroundColor: '#edf7fb', borderWidth: 1, borderColor: '#a5cde0', padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bannerWindow: { width: 11, height: 7, borderRadius: 2, backgroundColor: '#9bc5d8' },
  bannerWindowSmall: { width: 9, height: 7, borderRadius: 2, backgroundColor: '#9bc5d8' },
  bannerTrees: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 38, backgroundColor: '#5bbd89', flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 8 },
  treeDot: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#2f9d68' },
  bannerCaption: { position: 'absolute', left: 12, top: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.82)', paddingHorizontal: 10, paddingVertical: 6 },
  bannerText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  dashboardSpacer: { height: 12 },
  bottomTabsDock: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, backgroundColor: '#f4f7fb' },
  bottomTabsGlow: { position: 'absolute', left: 68, right: 68, top: 8, height: 17, borderRadius: 999, backgroundColor: '#7dd3fc', opacity: 0.14 },
  bottomTabsGlass: { minHeight: 78, borderRadius: 39, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', backgroundColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, paddingVertical: 7, overflow: 'hidden', shadowColor: '#075985', shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 9 },
  bottomTabsSheen: { position: 'absolute', left: 24, right: 24, top: 7, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)' },
  bottomTabItem: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: 31, overflow: 'visible' },
  bottomTabPressed: { transform: [{ scale: 0.97 }] },
  bottomTabLiquid: { display: 'none' },
  bottomTabIcon: { display: 'none' },
  bottomTabActivePill: { position: 'absolute', top: 2, left: '50%', width: 58, height: 58, marginLeft: -29, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', backgroundColor: 'rgba(219,244,255,0.72)', shadowColor: '#0284c7', shadowOpacity: 0.16, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  bottomTabActiveGloss: { position: 'absolute', left: 12, right: 12, top: 8, height: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.54)' },
  bottomTabIconWrap: { width: 38, height: 30, alignItems: 'center', justifyContent: 'center' },
  bottomTabIconHalo: { width: 36, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  bottomTabIconHaloActive: { backgroundColor: 'transparent' },
  bottomTabText: { color: '#475569', fontSize: 10.5, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  bottomTabTextActive: { color: colors.primary, fontWeight: '900' },
  notificationsScreen: { flexGrow: 1, minHeight: '100%', marginHorizontal: -24, marginTop: -28, marginBottom: -24, padding: 20, paddingTop: 26, gap: 16, backgroundColor: '#f4f7fb' },
  notificationsHero: { minHeight: 148, borderRadius: 30, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15, overflow: 'hidden', backgroundColor: colors.primary, shadowColor: '#075985', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  notificationsHeroGlow: { position: 'absolute', right: -46, top: -58, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.18)' },
  notificationsHeroIcon: { width: 58, height: 58, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  notificationsTitle: { color: '#ffffff', fontSize: 25, lineHeight: 31, fontWeight: '900' },
  notificationsSubtitle: { marginTop: 6, color: 'rgba(255,255,255,0.86)', fontSize: 13.5, lineHeight: 20, fontWeight: '700' },
  notificationsQuickCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f4c81', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  notificationsQuickIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  notificationsQuickTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  notificationsQuickText: { marginTop: 3, color: '#64748b', fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  notificationsQuickButton: { minHeight: 38, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  notificationsQuickButtonText: { color: '#ffffff', fontSize: 12.5, fontWeight: '900' },
  notificationsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  notificationsSectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  notificationsSectionMeta: { color: '#94a3b8', fontSize: 12, fontWeight: '900' },
  notificationsList: { gap: 12 },
  notificationCard: { flexDirection: 'row', gap: 13, borderRadius: 24, padding: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#8aa7bd', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  notificationIcon: { width: 44, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notificationIconPrimary: { backgroundColor: colors.primary },
  notificationIconSuccess: { backgroundColor: '#10b981' },
  notificationIconInfo: { backgroundColor: '#6366f1' },
  notificationCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  notificationTitle: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  notificationTime: { color: '#94a3b8', fontSize: 11, fontWeight: '900' },
  notificationMessage: { marginTop: 5, color: '#64748b', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  accountScreen: { flexGrow: 1, minHeight: '100%', marginHorizontal: -24, marginTop: -28, marginBottom: -24, backgroundColor: '#f4f6fb' },
  accountHero: { height: 244, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  accountBubbleOne: { position: 'absolute', left: -74, top: -70, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.12)' },
  accountBubbleTwo: { position: 'absolute', right: -54, bottom: -22, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.10)' },
  accountAvatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0546a8', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  accountName: { marginTop: 16, color: '#ffffff', fontSize: 19, lineHeight: 25, fontWeight: '900' },
  accountPhone: { marginTop: 6, color: 'rgba(255,255,255,0.86)', fontSize: 17, fontWeight: '800' },
  accountContent: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 28, gap: 20 },
  accountSectionWrap: { gap: 10 },
  accountSectionTitle: { color: '#6b7280', fontSize: 16, lineHeight: 22, fontWeight: '900' },
  accountCard: { borderRadius: 16, backgroundColor: '#ffffff', overflow: 'hidden', shadowColor: '#9aa9ba', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  accountRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#eef1f5', backgroundColor: '#ffffff' },
  accountRowDisabled: { opacity: 0.62 },
  accountRowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  accountRowText: { flex: 1, color: '#252b37', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  accountRowTextDisabled: { color: colors.muted },
  toggleTrack: { width: 52, height: 30, borderRadius: 15, backgroundColor: '#dbeafe', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 3 },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary },
  logoutCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, backgroundColor: '#ffffff', paddingHorizontal: 18, shadowColor: '#9aa9ba', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  logoutIcon: { backgroundColor: '#fff1f2' },
  logoutText: { flex: 1, color: '#5b2730', fontSize: 17, fontWeight: '900' },
  accountVersionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingTop: 24, paddingBottom: 16 },
  certBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 8 },
  certText: { color: '#0369a1', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  versionText: { color: '#9ca3af', fontSize: 13, fontWeight: '800' },
  mark: { width: 74, height: 58, alignItems: 'center', justifyContent: 'center' },
  markLarge: { marginTop: 10, transform: [{ scale: 1.08 }] },
  markRingOne: { position: 'absolute', left: 6, width: 38, height: 52, borderRadius: 20, borderWidth: 4, borderColor: colors.primary },
  markRingTwo: { position: 'absolute', right: 6, width: 38, height: 52, borderRadius: 20, borderWidth: 4, borderColor: colors.accent },
  markCore: { width: 38, height: 38, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  backHeader: { marginHorizontal: -24, marginTop: -8, marginBottom: 12, paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e4ebf3', flexDirection: 'row', alignItems: 'center', gap: 12 },
  backText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  authScreen: { alignItems: 'center', gap: 12 },
  authEyebrow: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900', marginTop: 8 },
  authTitle: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  authSubtitle: { color: colors.muted, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  authCard: { width: '100%', gap: 18, borderRadius: 18, backgroundColor: colors.surface, padding: 28, marginTop: 18, shadowColor: '#8aa7bd', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 9 },
  inputGroup: { width: '100%', gap: 10 },
  label: { color: colors.text, fontSize: 15, fontWeight: '900' },
  inputShell: { minHeight: 60, borderRadius: 13, borderWidth: 1.2, borderColor: colors.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fbfdff' },
  input: { flex: 1, minHeight: 50, color: colors.text, fontSize: 17, fontWeight: '800' },
  otpInput: { flex: undefined, minHeight: 68, borderRadius: 16, borderWidth: 1.2, borderColor: colors.border, paddingHorizontal: 14, backgroundColor: '#fbfdff', letterSpacing: 10, textAlign: 'center', fontSize: 28, fontWeight: '900' },
  loginMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 2, borderColor: '#b9c5d3', backgroundColor: '#ffffff' },
  metaText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  forgotText: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  resendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primarySoft, paddingVertical: 14 },
  resendButtonDisabled: { opacity: 0.65, backgroundColor: '#f4f7fb' },
  linkButton: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: colors.primaryDark, fontWeight: '900' },
  disabledText: { color: colors.muted },
  screenStack: { gap: 16 },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, backgroundColor: '#ffffff', padding: 16, shadowColor: '#8aa7bd', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  screenHeaderIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  screenSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  card: { gap: 14, borderRadius: 22, backgroundColor: colors.surface, padding: 18, shadowColor: '#8aa7bd', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 7 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fbfdff', padding: 15 },
  avatarCircle: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  avatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  patientName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  patientCode: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fbfdff', padding: 15 },
  visitIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  flex1: { flex: 1 },
  diagnosis: { color: colors.primaryDark, fontSize: 13, fontWeight: '900', marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  resultBox: { gap: 12, borderRadius: 22, backgroundColor: '#ffffff', padding: 18, shadowColor: '#8aa7bd', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  orderBlock: { gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fbfdff', padding: 14 },
  resultLine: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: '#ffffff', padding: 10 },
  previewImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: colors.primarySoft },
  fileName: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  fileButton: { borderRadius: 12, backgroundColor: colors.primaryDark, paddingHorizontal: 12, paddingVertical: 9 },
  fileButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  infoBlock: { gap: 4 },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  visitHistoryScreen: { marginHorizontal: -24, marginTop: -28, marginBottom: -24, backgroundColor: '#f4f7fb', minHeight: '100%' },
  visitHero: { minHeight: 210, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: colors.primary, overflow: 'hidden' },
  visitHeroBubbleOne: { position: 'absolute', left: -70, top: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.13)' },
  visitHeroBubbleTwo: { position: 'absolute', right: -62, bottom: -38, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.11)' },
  visitHeroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visitHeroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0546a8', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  visitHeroLabel: { color: 'rgba(255,255,255,0.86)', fontSize: 15, fontWeight: '900' },
  visitHeroTitle: { marginTop: 18, color: '#ffffff', fontSize: 34, lineHeight: 40, fontWeight: '900' },
  visitHeroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 21, fontWeight: '800' },
  visitSummaryRow: { flexDirection: 'row', gap: 12, marginHorizontal: 18, marginTop: -26 },
  visitSummaryCard: { flex: 1, minHeight: 86, borderRadius: 18, backgroundColor: '#ffffff', padding: 16, justifyContent: 'center', shadowColor: '#8aa7bd', shadowOpacity: 0.13, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 5 },
  visitSummaryValue: { color: colors.primaryDark, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  visitSummaryLabel: { marginTop: 3, color: '#64748b', fontSize: 13, fontWeight: '800' },
  visitListPanel: { marginHorizontal: 18, marginTop: 18, marginBottom: 24, borderRadius: 22, backgroundColor: '#ffffff', padding: 16, gap: 14, shadowColor: '#8aa7bd', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  visitListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  visitSectionTitle: { flex: 1, color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  visitFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#eef6ff', paddingHorizontal: 12, paddingVertical: 8 },
  visitFilterText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  visitLoadingText: { color: '#64748b', fontSize: 14, fontWeight: '800' },
  visitHistoryCard: { flexDirection: 'row', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: '#e4edf6', backgroundColor: '#fbfdff', padding: 12 },
  visitHistoryCardPressed: { transform: [{ scale: 0.99 }], backgroundColor: '#f3f9ff' },
  visitTimelineColumn: { width: 18, alignItems: 'center' },
  visitTimelineDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#b9c8d8', borderWidth: 3, borderColor: '#ffffff' },
  visitTimelineDotActive: { backgroundColor: colors.primary, borderColor: '#dff5ff' },
  visitTimelineLine: { flex: 1, width: 2, marginTop: 5, borderRadius: 2, backgroundColor: '#d8e5f0' },
  visitCardBody: { flex: 1, gap: 9 },
  visitCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  visitCodePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#eef6ff', paddingHorizontal: 10, paddingVertical: 6 },
  visitCodeText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  visitDepartment: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  visitMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  visitMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  visitMetaText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  visitDiagnosisBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, backgroundColor: '#eaf8ff', padding: 10 },
  visitDiagnosisText: { flex: 1, color: colors.primaryDark, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  visitPendingBox: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 7 },
  visitPendingText: { color: '#b45309', fontSize: 12, fontWeight: '900' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: '#fbfdff', padding: 24 },
  profileScreen: { marginHorizontal: -24, marginTop: -28, marginBottom: -24, backgroundColor: '#f4f7fb', minHeight: '100%' },
  profileHero: { minHeight: 214, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: colors.primary, overflow: 'hidden' },
  profileHeroBubbleOne: { position: 'absolute', left: -72, top: -82, width: 218, height: 218, borderRadius: 109, backgroundColor: 'rgba(255,255,255,0.13)' },
  profileHeroBubbleTwo: { position: 'absolute', right: -58, bottom: -44, width: 174, height: 174, borderRadius: 87, backgroundColor: 'rgba(255,255,255,0.11)' },
  profileHeroIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0546a8', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  profileHeroTitle: { marginTop: 18, color: '#ffffff', fontSize: 34, lineHeight: 40, fontWeight: '900' },
  profileHeroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 21, fontWeight: '800' },
  profileSummaryCard: { marginHorizontal: 18, marginTop: -28, minHeight: 92, borderRadius: 20, backgroundColor: '#ffffff', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: '#8aa7bd', shadowOpacity: 0.13, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 5 },
  profileSummaryIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  profileSummaryTitle: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  profileSummaryText: { marginTop: 3, color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  profileListPanel: { marginHorizontal: 18, marginTop: 18, borderRadius: 22, backgroundColor: '#ffffff', padding: 16, gap: 13, shadowColor: '#8aa7bd', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  profileListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  profileSectionTitle: { flex: 1, color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  profileSecureChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: '#eef6ff', paddingHorizontal: 12, paddingVertical: 8 },
  profileSecureText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  profileDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e4edf6', backgroundColor: '#fbfdff', padding: 14 },
  profileDetailLabel: { color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '900', textTransform: 'uppercase' },
  profileDetailValue: { marginTop: 3, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '900' },
  patientProfileCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1, borderColor: '#e4edf6', backgroundColor: '#fbfdff', padding: 14 },
  patientProfileCardPressed: { transform: [{ scale: 0.99 }], backgroundColor: '#f3f9ff' },
  patientProfileAvatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#dff5ff', alignItems: 'center', justifyContent: 'center' },
  patientProfileAvatarAlt: { backgroundColor: '#e0f2fe' },
  patientProfileInitial: { color: colors.primaryDark, fontSize: 23, fontWeight: '900' },
  patientProfileName: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  patientProfileMetaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  patientProfileCode: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  patientProfilePhone: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  patientProfileAction: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  switchAccountCard: { marginHorizontal: 18, marginTop: 18, marginBottom: 26, minHeight: 76, borderRadius: 18, backgroundColor: '#ffffff', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: '#8aa7bd', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  switchAccountIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  switchAccountTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  switchAccountText: { marginTop: 3, color: '#64748b', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  detailScreen: { marginHorizontal: -24, marginTop: -28, marginBottom: -24, backgroundColor: '#f4f7fb', minHeight: '100%' },
  detailHero: { minHeight: 222, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: colors.primary, overflow: 'hidden' },
  detailHeroBubbleOne: { position: 'absolute', left: -78, top: -84, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.13)' },
  detailHeroBubbleTwo: { position: 'absolute', right: -62, bottom: -42, width: 184, height: 184, borderRadius: 92, backgroundColor: 'rgba(255,255,255,0.11)' },
  detailBackButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, backgroundColor: '#ffffff', paddingHorizontal: 13, paddingVertical: 9, shadowColor: '#0546a8', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  detailBackText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  detailHeroTitle: { marginTop: 20, color: '#ffffff', fontSize: 33, lineHeight: 39, fontWeight: '900' },
  detailHeroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, fontWeight: '800' },
  detailSummaryGrid: { flexDirection: 'row', gap: 12, marginHorizontal: 18, marginTop: -28 },
  detailSummaryCard: { flex: 1, minHeight: 112, borderRadius: 20, backgroundColor: '#ffffff', padding: 15, justifyContent: 'center', gap: 6, shadowColor: '#8aa7bd', shadowOpacity: 0.13, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 5 },
  detailSummaryLabel: { color: '#64748b', fontSize: 12, fontWeight: '900' },
  detailSummaryValue: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  detailSection: { marginHorizontal: 18, marginTop: 18, borderRadius: 22, backgroundColor: '#ffffff', padding: 16, gap: 14, shadowColor: '#8aa7bd', shadowOpacity: 0.09, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailSectionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  detailSectionTitle: { flex: 1, color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900' },
  detailSectionBody: { gap: 12 },
  detailOrderCard: { gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#e4edf6', backgroundColor: '#fbfdff', padding: 13 },
  detailOrderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailOrderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  detailOrderTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  detailOrderCode: { marginTop: 2, color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  detailMuted: { color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  detailResultCard: { gap: 8, borderTopWidth: 1, borderTopColor: '#e4edf6', paddingTop: 12 },
  detailResultCode: { color: colors.primaryDark, fontSize: 14, fontWeight: '900' },
  detailResultNote: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  detailFileCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e4edf6', backgroundColor: '#ffffff', padding: 10 },
  detailFileIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  detailFileButtonSecondary: { borderRadius: 12, backgroundColor: '#eaf8ff', paddingHorizontal: 10, paddingVertical: 9 },
  detailFileButtonSecondaryText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900' },
  aiDiagnosisCard: { gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f8fdff', padding: 13 },
  aiDiagnosisHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  aiDiagnosisTitle: { flex: 1, color: colors.primaryDark, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  aiConfidencePill: { borderRadius: 999, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 5, color: '#047857', fontSize: 11, fontWeight: '900' },
  aiSummaryText: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  aiPrimaryBox: { gap: 4, borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#ffffff', padding: 10 },
  aiNextBox: { gap: 4, borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', padding: 10 },
  aiPrimaryLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase' },
  aiPrimaryText: { color: colors.primaryDark, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  aiReasonText: { color: '#475569', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  aiMetaText: { color: '#94a3b8', fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  qrPayload: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f0f9ff', padding: 12, color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontWeight: '900' },
  bookingScreen: { marginHorizontal: -24, marginTop: 0, marginBottom: -24, minHeight: '100%', backgroundColor: '#f6f8fc', paddingTop: 6, paddingBottom: 28 },
  bookingHero: { minHeight: 240, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 46, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, backgroundColor: '#075985', overflow: 'hidden' },
  bookingHeroOrbOne: { position: 'absolute', right: -90, top: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(34,211,238,0.28)' },
  bookingHeroOrbTwo: { position: 'absolute', left: -70, bottom: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.14)' },
  bookingHeroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookingHeroIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#083344', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  bookingHeroKicker: { color: '#bae6fd', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  bookingHeroTitle: { marginTop: 24, color: '#ffffff', fontSize: 38, lineHeight: 43, fontWeight: '900' },
  bookingHeroSubtitle: { marginTop: 10, color: '#dff7ff', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  bookingProgressCard: { marginHorizontal: 18, marginTop: -30, flexDirection: 'row', gap: 8, borderRadius: 24, backgroundColor: '#ffffff', padding: 10, shadowColor: '#075985', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  bookingProgressItem: { flex: 1, alignItems: 'center', gap: 5, borderRadius: 18, backgroundColor: '#f1f5f9', paddingVertical: 10 },
  bookingProgressItemActive: { backgroundColor: '#ecfeff' },
  bookingProgressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  bookingProgressDotActive: { backgroundColor: colors.primary },
  bookingProgressText: { color: '#94a3b8', fontSize: 11, fontWeight: '900' },
  bookingProgressTextActive: { color: colors.primaryDark },
  bookingPanel: { marginHorizontal: 18, marginTop: 18, borderRadius: 28, backgroundColor: '#ffffff', padding: 18, gap: 16, shadowColor: '#8aa7bd', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  bookingPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bookingPanelNumber: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#083344', alignItems: 'center', justifyContent: 'center' },
  bookingPanelNumberText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  bookingPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bookingPanelTitle: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '900' },
  bookingPanelCaption: { marginTop: 3, color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  bookingCardGrid: { gap: 12 },
  bookingSelectCard: { minHeight: 92, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', padding: 14, justifyContent: 'center' },
  bookingSelectCardActive: { borderColor: '#0891b2', backgroundColor: '#0891b2' },
  bookingPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  bookingSelectIcon: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  bookingSelectTitle: { color: '#0f172a', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  bookingSelectTitleActive: { color: '#ffffff' },
  bookingSelectMeta: { marginTop: 5, color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  bookingSelectMetaActive: { color: '#cffafe' },
  bookingDoctorCard: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 24, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#f8fbff', padding: 14 },
  bookingDoctorAvatar: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  bookingDoctorInitial: { color: colors.primaryDark, fontSize: 18, fontWeight: '900' },
  bookingPatientCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 24, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#f8fbff', padding: 14 },
  bookingPatientAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
  bookingPatientAvatarActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  bookingPatientInitial: { color: colors.primaryDark, fontSize: 18, fontWeight: '900' },
  bookingPatientInitialActive: { color: '#ffffff' },
  bookingDateBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 10 },
  bookingDateInput: { flex: 1, minHeight: 38, color: '#0f172a', fontSize: 16, fontWeight: '900' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotPill: { minWidth: 104, flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  slotPillDisabled: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  slotTime: { color: colors.primaryDark, fontSize: 18, lineHeight: 22, fontWeight: '900' },
  slotTimeDisabled: { color: '#94a3b8' },
  slotStatus: { marginTop: 4, color: '#0284c7', fontSize: 12, fontWeight: '900' },
  slotStatusDisabled: { color: '#94a3b8' },
  appointmentTicket: { borderRadius: 26, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#f8fdff', padding: 16, gap: 12 },
  ticketTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  ticketCode: { color: colors.text, fontSize: 17, fontWeight: '900' },
  ticketMeta: { marginTop: 4, color: '#64748b', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  ticketStatus: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, color: '#047857', fontSize: 11, fontWeight: '900' },
  qrButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: colors.primary, paddingVertical: 12 },
  qrButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  qrActionRow: { flexDirection: 'row', gap: 10 },
  qrSecondaryButton: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: '#bae6fd', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  qrSecondaryButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900' },
  checkedInNotice: { marginTop: 12, minHeight: 44, borderRadius: 14, backgroundColor: '#dcfce7', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  checkedInNoticeText: { color: '#047857', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  qrBox: { alignSelf: 'center', marginTop: 16, padding: 16, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbeafe' },
  stepProgress: { marginHorizontal: 18, marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  stepProgressCompact: { gap: 3, paddingHorizontal: 8 },
  stepProgressItem: { flex: 1, alignItems: 'center', gap: 5 },
  stepProgressDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#cbd5e1' },
  stepProgressDotActive: { backgroundColor: colors.primary },
  stepProgressText: { color: '#94a3b8', fontSize: 9.5, fontWeight: '900' },
  stepProgressTextActive: { color: colors.primaryDark },
  bookingTopBar: { minHeight: 112, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 26, backgroundColor: '#ffffff' },
  bookingNavButton: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bookingNavButtonDisabled: { backgroundColor: '#eef2f7', opacity: 0.7 },
  bookingTopTitle: { flex: 1, color: colors.primaryDark, fontSize: 23, fontWeight: '900' },
  bookingHomeIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff' },
  bookingPageBody: { flex: 1, paddingHorizontal: 18, paddingTop: 18, gap: 12 },
  bookingPageHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  bookingPageTitle: { color: '#0f172a', fontSize: 23, lineHeight: 29, fontWeight: '900' },
  addProfileButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 12 },
  addProfileText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  bookingListCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', padding: 14 },
  bookingListCardActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  bookingAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  bookingAvatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: '900' },
  bookingListTitle: { color: colors.primaryDark, fontSize: 16, lineHeight: 21, fontWeight: '900', textTransform: 'uppercase' },
  bookingMetaLine: { marginTop: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  bookingMetaText: { color: '#64748b', fontSize: 12.5, lineHeight: 18, fontWeight: '800' },
  bookingStepPage: { flex: 1, paddingHorizontal: 18, paddingTop: 18, gap: 12 },
  bookingStepTitle: { color: '#0f172a', fontSize: 23, lineHeight: 29, fontWeight: '900' },
  bookingStepSubtitle: { color: '#64748b', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: -6, marginBottom: 4 },
  bookingSummaryBox: { borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', padding: 14, gap: 8 },
  bookingSummaryText: { color: '#0f172a', fontSize: 14, lineHeight: 20, fontWeight: '800' },
  genderField: { gap: 8 },
  genderDropdownMenu: { overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  genderDropdownItem: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, backgroundColor: '#ffffff' },
  genderDropdownItemActive: { backgroundColor: '#eef6ff' },
  genderDropdownText: { flex: 1, color: '#334155', fontSize: 15, fontWeight: '800' },
  genderDropdownTextActive: { color: colors.primaryDark, fontWeight: '900' },
  genderDropdownTrigger: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 16, borderWidth: 1.5, borderColor: '#dbeafe', backgroundColor: '#f8fbff', paddingHorizontal: 15 },
  genderDropdownTriggerActive: { borderColor: '#0f172a', backgroundColor: '#ffffff' },
  genderDropdownValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  genderDropdownValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  datePickerField: { gap: 8 },
  datePickerTrigger: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#f8fbff', paddingHorizontal: 15 },
  datePickerValue: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
  datePickerPlaceholder: { color: '#b9c5d3' },
  calendarPanel: { gap: 12, borderRadius: 26, borderWidth: 1, borderColor: '#dbeafe', backgroundColor: '#ffffff', padding: 16, shadowColor: '#0f4c81', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  calendarHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, backgroundColor: '#f0f9ff', paddingHorizontal: 8 },
  calendarNavButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  calendarTitleBlock: { alignItems: 'center' },
  calendarTitle: { color: colors.primaryDark, fontSize: 17, fontWeight: '900' },
  calendarYear: { marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: '800' },
  calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  calendarWeekText: { width: '14.285%', textAlign: 'center', color: '#64748b', fontSize: 11, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  calendarDayActive: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  calendarDayMuted: { opacity: 0.32 },
  calendarDayText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  calendarDayTextActive: { color: '#ffffff' },
  calendarDayTextMuted: { color: '#94a3b8' },
});
