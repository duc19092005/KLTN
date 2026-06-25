import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { passwordPatientLogin, requestPatientOtp, resendPatientOtp, verifyPatientOtp, PatientOtpLoginResponse } from '../../shared/api/patientAuthClient';
import { getPatientResultFileDownloadUrl, getPatientVisitDetail, getPatientVisits, PatientVisitDetail, PatientVisitSummary } from '../../shared/api/patientPortalClient';
import { ActionButton } from '../../shared/components/ActionButton';
import { StatusPanel } from '../../shared/components/StatusPanel';
import { colors, spacing } from '../../shared/theme/theme';

type Step = 'phone' | 'passwordLogin' | 'otp' | 'passwordSetup' | 'dashboard' | 'account' | 'profiles' | 'visits' | 'detail';

type PreviewUrls = Record<string, string>;

const PATIENT_SESSION_STORAGE_KEY = 'kltn.patient.session.v1';

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
  const [busy, setBusy] = useState(false);
  const [fileBusyId, setFileBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState('');
  const [session, setSession] = useState<PatientOtpLoginResponse | null>(() => loadStoredSession());
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [visits, setVisits] = useState<PatientVisitSummary[]>([]);
  const [visitDetail, setVisitDetail] = useState<PatientVisitDetail | null>(null);
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({});

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
    () => session?.patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [selectedPatientId, session?.patients],
  );

  const loginWithPassword = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await passwordPatientLogin(phone, password);
      setSession(response);
      persistSession(response);
      setPassword('');
      setConfirmPassword('');
      setStep('dashboard');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Số điện thoại hoặc mật khẩu không hợp lệ.');
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await requestPatientOtp(phone);
      setMessage(response.message || 'OTP đã được gửi nếu số điện thoại hợp lệ.');
      setResendAfterSeconds(response.resendAfterSeconds || 60);
      setOtpExpiresAt(response.otpExpiresAt || '');
      setStep('otp');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không gửi được OTP.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await resendPatientOtp(phone);
      setMessage(response.message || 'OTP đã được gửi lại nếu số điện thoại hợp lệ.');
      setResendAfterSeconds(response.resendAfterSeconds || 60);
      setOtpExpiresAt(response.otpExpiresAt || '');
      setOtp('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không gửi lại được OTP.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await verifyPatientOtp(phone, otp);
      setSession(response);
      persistSession(response);
      setStep(response.requirePasswordSetup ? 'passwordSetup' : 'profiles');
      if (response.requirePasswordSetup) setMessage('Vui lòng tạo mật khẩu trước khi xem hồ sơ bệnh nhân.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'OTP không hợp lệ hoặc đã hết hạn.');
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
  const showAuthenticatedTabs = Boolean(session && ['dashboard', 'profiles', 'visits', 'detail', 'account'].includes(step));
  const activeTab = step === 'account' ? 'account' : step === 'profiles' || step === 'visits' || step === 'detail' ? 'features' : 'home';

  return (
    <View style={styles.portalShell}>
      <ScrollView style={styles.portalScroll} contentContainerStyle={[styles.content, showAuthenticatedTabs && styles.contentWithTabs]} showsVerticalScrollIndicator={false}>
      {!showAuthenticatedTabs ? <View style={styles.statusSpacer} /> : null}

      {error && step !== 'dashboard' ? <StatusPanel tone="danger" title="Không thành công" body={error} icon={<Ionicons name="warning-outline" size={22} color={colors.danger} />} /> : null}
      {message && step !== 'dashboard' ? <StatusPanel title="Thông báo" body={message} icon={<Ionicons name="information-circle-outline" size={22} color={colors.primary} />} /> : null}

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
            <Text style={styles.onboardingText}>Đăng nhập hoặc đăng ký để xem hồ sơ sức khỏe, lịch sử khám và kết quả cận lâm sàng của bạn.</Text>
            <View style={styles.pager}><View style={styles.pagerActive} /><View style={styles.pagerDot} /></View>
          </View>
          <View style={styles.bottomActions}>
            <Pressable onPress={() => { setError(''); setMessage(''); setPassword(''); setStep('passwordLogin'); }} style={styles.loginPill}>
              <Text style={styles.loginPillText}>Đăng nhập</Text>
            </Pressable>
            <Pressable onPress={requestOtp} disabled={busy} style={styles.registerPill}>
              <Text style={styles.registerPillText}>{busy ? 'Đang xử lý...' : 'Đăng ký'}</Text>
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
                openProfiles: () => setStep('profiles'),
                openUnavailable: (label) => {
                  setError('');
                  setMessage('');
                  setMessage(`Chức năng ${label} sẽ được bổ sung sau.`);
                },
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
        <AccountScreen session={session} onLogout={reset} onHome={() => setStep('dashboard')} />
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
          <ActionButton tone="secondary" label="Đăng nhập bằng OTP" loading={busy} onPress={requestOtp} icon={<Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryDark} />} />
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
          patients={session.patients}
          onOpenVisits={openVisits}
          onSwitchAccount={reset}
        />
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
      </ScrollView>
      {showAuthenticatedTabs ? (
        <BottomTabs active={activeTab} onHome={() => setStep('dashboard')} onAccount={() => setStep('account')} />
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

function getHomeFeatures({ openProfiles, openUnavailable }: { openProfiles: () => void; openUnavailable: (label: string) => void }): HomeFeature[] {
  return [
    { label: 'Đặt khám', icon: 'calendar-clear-outline', accent: colors.primary, onPress: () => openUnavailable('Đặt khám') },
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

function BottomTabs({ active, onHome, onAccount }: { active: 'home' | 'notifications' | 'features' | 'account'; onHome: () => void; onAccount: () => void }) {
  const tabs: Array<{ key: 'home' | 'notifications' | 'features' | 'account'; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon?: keyof typeof Ionicons.glyphMap; onPress?: () => void }> = [
    { key: 'home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home', onPress: onHome },
    { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline', activeIcon: 'notifications' },
    { key: 'features', label: 'Chức năng', icon: 'layers-outline', activeIcon: 'layers' },
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
      tension: 150,
      friction: 13,
    }).start();
  }, [active, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const lift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const activeOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.bottomTabItem, pressed && styles.bottomTabPressed]}>
      <Animated.View style={[styles.bottomTabLiquid, { opacity: activeOpacity, transform: [{ scale }] }]} />
      <Animated.View style={[styles.bottomTabIcon, { transform: [{ translateY: lift }, { scale }] }]}>
        <View style={[styles.bottomTabIconHalo, active && styles.bottomTabIconHaloActive]}>
          <Ionicons name={active ? activeIcon : icon} size={25} color={active ? colors.primary : '#172033'} />
        </View>
      </Animated.View>
      <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function AccountScreen({ session, onLogout, onHome }: { session: PatientOtpLoginResponse; onLogout: () => void; onHome: () => void }) {
  const primaryPatient = session.patients[0];
  const displayName = primaryPatient?.fullName || 'Người bệnh';
  const phoneText = maskPhone(primaryPatient?.phone || '');

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
          <AccountRow icon="person" label="Thông tin cá nhân" />
          <AccountRow icon="key" label="Thay đổi mật khẩu" />
          <AccountRow icon="lock-closed" label="Passcode" />
        </AccountSection>

        <AccountSection title="Cài đặt">
          <View style={styles.accountRow}>
            <View style={styles.accountRowIcon}><Ionicons name="notifications" size={21} color={colors.primary} /></View>
            <Text style={styles.accountRowText}>Nhận thông báo</Text>
            <View style={styles.toggleTrack}><View style={styles.toggleThumb} /></View>
          </View>
        </AccountSection>

        <AccountSection title="Thông tin pháp lý">
          <AccountRow icon="document-text" label="Điều khoản dịch vụ" />
          <AccountRow icon="document-text" label="Chính sách bảo mật" />
          <AccountRow icon="document-text" label="Quy định sử dụng" />
        </AccountSection>

        <Pressable onPress={onLogout} style={styles.logoutCard}>
          <View style={[styles.accountRowIcon, styles.logoutIcon]}><Ionicons name="log-out-outline" size={22} color="#ef4444" /></View>
          <Text style={styles.logoutText}>Đăng xuất</Text>
          <Ionicons name="chevron-forward" size={22} color="#c7cdd8" />
        </Pressable>

        <View style={styles.accountVersionRow}>
          <View style={styles.certBadge}><Ionicons name="checkmark-done-circle" size={22} color="#0ea5e9" /><Text style={styles.certText}>Đã thông báo</Text></View>
          <Text style={styles.versionText}>v3.2.1-496</Text>
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

function AccountRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.accountRow}>
      <View style={styles.accountRowIcon}><Ionicons name={icon} size={21} color={colors.primary} /></View>
      <Text style={styles.accountRowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={22} color="#c7cdd8" />
    </Pressable>
  );
}

function maskPhone(value: string) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return value;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function ProfileSelectionScreen({ patients, onOpenVisits, onSwitchAccount }: { patients: PatientOtpLoginResponse['patients']; onOpenVisits: (patientId: string) => void; onSwitchAccount: () => void }) {
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
          <Text style={styles.profileSummaryText}>Chọn đúng hồ sơ để xem lịch sử khám và kết quả cận lâm sàng.</Text>
        </View>
      </View>

      <View style={styles.profileListPanel}>
        <View style={styles.profileListHeader}>
          <Text style={styles.profileSectionTitle}>Hồ sơ người bệnh</Text>
          <View style={styles.profileSecureChip}><Ionicons name="lock-closed" size={14} color={colors.primaryDark} /><Text style={styles.profileSecureText}>Bảo mật</Text></View>
        </View>
        {patients.length ? patients.map((patient, index) => (
          <PatientProfileCard key={patient.id} patient={patient} index={index} onPress={() => onOpenVisits(patient.id)} />
        )) : <EmptyState text="Chưa có hồ sơ bệnh nhân liên kết với số điện thoại này." />}
      </View>

      <Pressable onPress={onSwitchAccount} style={styles.switchAccountCard}>
        <View style={styles.switchAccountIcon}><Ionicons name="swap-horizontal-outline" size={22} color={colors.primary} /></View>
        <View style={styles.flex1}>
          <Text style={styles.switchAccountTitle}>Đăng nhập tài khoản khác</Text>
          <Text style={styles.switchAccountText}>Thoát phiên hiện tại và chọn số điện thoại khác.</Text>
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
        {visitDetail.reason ? <Info label="Lý do khám" value={visitDetail.reason} /> : null}
        {visitDetail.symptoms ? <Info label="Triệu chứng" value={visitDetail.symptoms} /> : null}
      </DetailSection>

      {visitDetail.conclusion ? (
        <DetailSection title="Kết luận bác sĩ" icon="pulse-outline">
          <Info label="Chẩn đoán" value={visitDetail.conclusion.finalDiagnosis} />
          {visitDetail.conclusion.treatmentPlan ? <Info label="Điều trị" value={visitDetail.conclusion.treatmentPlan} /> : null}
          {visitDetail.conclusion.prescription ? <Info label="Đơn thuốc" value={visitDetail.conclusion.prescription} /> : null}
          {visitDetail.conclusion.followUpNote ? <Info label="Tái khám" value={visitDetail.conclusion.followUpNote} /> : null}
        </DetailSection>
      ) : <View style={styles.detailSection}><EmptyState text="Chưa có kết luận." /></View>}

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
  onboardingCopy: { alignItems: 'center', gap: 14, paddingHorizontal: 8 },
  onboardingTitle: { color: '#05070d', fontSize: 27, lineHeight: 34, fontWeight: '900', textAlign: 'center' },
  onboardingText: { color: '#1f2937', fontSize: 17, lineHeight: 24, textAlign: 'center', fontWeight: '600' },
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
  bottomTabsDock: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, backgroundColor: 'rgba(244,247,251,0.62)' },
  bottomTabsGlow: { position: 'absolute', left: 34, right: 34, top: 2, height: 24, borderRadius: 999, backgroundColor: '#bdefff', opacity: 0.34 },
  bottomTabsGlass: { minHeight: 76, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)', backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, overflow: 'hidden', shadowColor: '#4d8db8', shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
  bottomTabsSheen: { position: 'absolute', left: 12, right: 12, top: 6, height: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.72)', opacity: 0.64 },
  bottomTabItem: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  bottomTabPressed: { transform: [{ scale: 0.96 }] },
  bottomTabLiquid: { position: 'absolute', top: 3, width: 58, height: 42, borderRadius: 21, backgroundColor: 'rgba(213,244,255,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  bottomTabIcon: { width: 44, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bottomTabIconHalo: { width: 38, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bottomTabIconHaloActive: { backgroundColor: 'rgba(255,255,255,0.52)' },
  bottomTabText: { color: '#172033', fontSize: 11, lineHeight: 15, fontWeight: '800', textAlign: 'center' },
  bottomTabTextActive: { color: colors.primary, fontWeight: '900' },
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
  accountRowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#eef6ff', alignItems: 'center', justifyContent: 'center' },
  accountRowText: { flex: 1, color: '#252b37', fontSize: 17, lineHeight: 22, fontWeight: '800' },
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
  inputGroup: { gap: 10 },
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
});
