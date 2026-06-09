import React, { useState, useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '../../providers/ToastProvider';

export default function AvatarUpload({ value, onChange, uploadFn, ringTone = 'cyan' }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB.');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadFn(file);
      onChange(res.data.url);
      toast.success('Tải ảnh đại diện lên thành công!');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Tải ảnh thất bại');
    } finally {
      setUploading(false);
    }
  };

  const focusRing = ringTone === 'cyan' ? 'hover:border-cyan-400 focus:ring-cyan-100' : 'hover:border-cyan-400 focus:ring-cyan-100';
  const textTone = ringTone === 'cyan' ? 'text-cyan-600 group-hover:text-cyan-600' : 'text-cyan-600 group-hover:text-cyan-600';
  const spinnerColor = ringTone === 'cyan' ? 'text-cyan-600' : 'text-cyan-600';

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-[13px] font-bold text-slate-700">Ảnh đại diện</span>
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative group cursor-pointer w-full h-[42px] bg-slate-50 border border-slate-200 border-dashed rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 ${focusRing} transition-colors overflow-hidden`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        {uploading ? (
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Loader2 className={`animate-spin h-4 w-4 ${spinnerColor}`} strokeWidth={2.5} />
            Đang tải lên...
          </span>
        ) : value ? (
          <div className="flex items-center justify-between w-full px-3 h-full">
            <div className="flex items-center gap-2 overflow-hidden">
              <img src={value} alt="Preview" className="w-7 h-7 rounded-lg object-cover border border-slate-200 bg-white" />
              <span className="text-xs text-emerald-600 font-bold truncate">Đã tải ảnh lên</span>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider ${textTone} group-hover:underline`}>Thay đổi</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 font-semibold group-hover:text-cyan-600 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-slate-400 group-hover:text-cyan-600" strokeWidth={2.5} />
            Chọn ảnh đại diện
          </span>
        )}
      </div>
    </div>
  );
}
