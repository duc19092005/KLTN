import React from 'react';
import {
  Palette,
  Clock,
  Sparkles,
  Gauge,
  Volume2,
  VolumeX,
  Bell,
  Monitor,
  ScanFace,
  RotateCcw,
  Sun,
  Moon,
  Watch,
  Smartphone,
  Minimize2,
  FlaskConical,
} from 'lucide-react';
import { usePreferences, ACCENTS } from '../../../providers/PreferencesProvider';
import { useToast } from '../../../providers/ToastProvider';
import {
  SettingsCard,
  SettingRow,
  Toggle,
  Segmented,
  AccentPicker,
  RadioPicker,
} from './PreferenceControls';

/**
 * PreferencesPanel — the "personalization" half of the Settings page. Every control writes through
 * usePreferences() and takes effect immediately (no save button needed); a small toast confirms the
 * reset action. Purely client-side comfort settings — nothing here is security-authoritative.
 */
export default function PreferencesPanel() {
  const { prefs, setPreference, resetPreferences, formatTime, accentHex } = usePreferences();
  const toast = useToast();

  const handleReset = () => {
    resetPreferences();
    toast.success('Đã khôi phục cài đặt cá nhân hóa về mặc định.');
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <SettingsCard
        icon={Palette}
        title="Giao diện"
        description="Tùy chỉnh màu sắc và cảm giác của giao diện cho phù hợp với bạn."
        accent={accentHex}
      >
        <SettingRow
          icon={Sparkles}
          title="Màu nhấn"
          description="Màu chủ đạo cho các điểm nhấn cá nhân hóa trong giao diện."
        >
          <AccentPicker
            value={prefs.accent}
            onChange={(v) => setPreference('accent', v)}
            accents={ACCENTS}
          />
        </SettingRow>

        <SettingRow
          icon={Gauge}
          title="Mật độ hiển thị"
          description="Chế độ gọn giúp xem được nhiều dòng hơn — hợp với vai trò nhiều dữ liệu."
        >
          <Segmented
            value={prefs.compactTables ? 'compact' : 'comfortable'}
            onChange={(v) => setPreference('compactTables', v === 'compact')}
            accent={accentHex}
            options={[
              { value: 'comfortable', label: 'Thoải mái' },
              { value: 'compact', label: 'Gọn' },
            ]}
          />
        </SettingRow>

        <SettingRow
          htmlFor="pref-reduce-motion"
          icon={Monitor}
          title="Giảm chuyển động"
          description="Tắt các hiệu ứng động không cần thiết để giao diện tĩnh và êm hơn."
        >
          <Toggle
            id="pref-reduce-motion"
            checked={prefs.reduceMotion}
            onChange={(v) => setPreference('reduceMotion', v)}
            accent={accentHex}
          />
        </SettingRow>

        <SettingRow
          htmlFor="pref-greeting"
          icon={Sun}
          title="Lời chào trên bảng làm việc"
          description="Hiển thị câu chào theo thời gian trong ngày khi bạn mở bảng làm việc."
        >
          <Toggle
            id="pref-greeting"
            checked={prefs.showGreeting}
            onChange={(v) => setPreference('showGreeting', v)}
            accent={accentHex}
          />
        </SettingRow>
      </SettingsCard>

      {/* Time & locale */}
      <SettingsCard
        icon={Clock}
        title="Thời gian"
        description="Cách hệ thống hiển thị giờ giấc cho bạn."
        accent={accentHex}
      >
        <SettingRow
          icon={Clock}
          title="Định dạng giờ"
          description={`Ví dụ hiện tại: ${formatTime(new Date())}`}
        >
          <Segmented
            value={prefs.timeFormat}
            onChange={(v) => setPreference('timeFormat', v)}
            accent={accentHex}
            options={[
              { value: '24h', label: '24 giờ', icon: Moon },
              { value: '12h', label: '12 giờ', icon: Sun },
            ]}
          />
        </SettingRow>
        <SettingRow
          icon={Watch}
          title="Kiểu đồng hồ"
          description="Chọn cách hiển thị đồng hồ trên thanh tiêu đề: số, kim, hoặc tối giản."
        >
          <RadioPicker
            value={prefs.clockFace || 'digital'}
            onChange={(v) => setPreference('clockFace', v)}
            accent={accentHex}
            options={[
              { value: 'digital', label: 'Số', icon: Smartphone },
              { value: 'analog', label: 'Kim', icon: Watch },
              { value: 'minimal', label: 'Nhỏ gọn', icon: Minimize2 },
            ]}
          />
        </SettingRow>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard
        icon={Bell}
        title="Thông báo"
        description="Tín hiệu nhắc việc trong ca làm."
        accent={accentHex}
      >
        <SettingRow
          htmlFor="pref-sound"
          icon={prefs.soundAlerts ? Volume2 : VolumeX}
          title="Âm thanh báo hiệu"
          description="Phát âm thanh nhẹ khi có bệnh nhân mới vào hàng đợi hoặc có kết quả mới."
        >
          <Toggle
            id="pref-sound"
            checked={prefs.soundAlerts}
            onChange={(v) => setPreference('soundAlerts', v)}
            accent={accentHex}
          />
        </SettingRow>
      </SettingsCard>

      {/* Privacy on shared workstations */}
      <SettingsCard
        icon={ScanFace}
        title="Quyền riêng tư"
        description="Bảo vệ phiên làm việc trên máy trạm dùng chung."
        accent={accentHex}
      >
        <SettingRow
          htmlFor="pref-lock-hidden"
          icon={ScanFace}
          title="Khóa ngay khi rời cửa sổ"
          description="Tự khóa màn hình ngay khi bạn chuyển tab hoặc thu nhỏ cửa sổ, không chờ hết thời gian rảnh."
        >
          <Toggle
            id="pref-lock-hidden"
            checked={prefs.lockOnHidden}
            onChange={(v) => setPreference('lockOnHidden', v)}
            accent={accentHex}
          />
        </SettingRow>
      </SettingsCard>

      {/* Demo / Presentation mode */}
      <SettingsCard
        icon={FlaskConical}
        title="Chế độ trình diễn"
        description="Bật chế độ demo để bỏ qua kiểm tra ngày/giờ khi đăng ký ca trực — hữu ích khi thuyết trình cho giảng viên."
        accent={accentHex}
      >
        <SettingRow
          htmlFor="pref-demo-mode"
          icon={FlaskConical}
          title="Demo Mode"
          description="Khi bật: có thể chọn ngày quá khứ hoặc tương lai không giới hạn. Tắt: tuân theo ràng buộc thời gian thực."
        >
          <Toggle
            id="pref-demo-mode"
            checked={prefs.demoMode}
            onChange={(v) => setPreference('demoMode', v)}
            accent={accentHex}
          />
        </SettingRow>
      </SettingsCard>

      {/* Reset */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.25} />
          Khôi phục mặc định
        </button>
      </div>
    </div>
  );
}
