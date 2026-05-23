import { useState } from 'react';
import { useThemeLang } from '../contexts/ThemeLangContext';

/* ─────────────────────────────────────────────
   Translation dict for Support page
   ───────────────────────────────────────────── */
const supportDict = {
  vi: {
    title: 'Hỗ trợ & Trung tâm Trợ giúp',
    subtitle: 'Truy cập tài liệu, khắc phục sự cố và hỗ trợ lâm sàng.',
    searchTitle: 'Hôm nay chúng tôi có thể hỗ trợ bạn điều gì?',
    searchPlaceholder: 'Tìm kiếm tài liệu, lỗi hoặc từ khóa...',
    searchBtn: 'Tìm kiếm',
    popular: 'Phổ biến:',
    popularLinks: ['Lỗi đồng bộ node', 'Đặt lại API Key', 'Nhật ký kiểm toán'],
    quickLinkTitle1: 'Vấn đề thường gặp',
    quickLinkDesc1: 'Hướng dẫn khắc phục sự cố cho các cảnh báo thường gặp.',
    quickLinkTitle2: 'Hướng dẫn sử dụng',
    quickLinkDesc2: 'Tài liệu toàn diện cho hệ thống ZKP.',
    quickLinkTitle3: 'Tài liệu API',
    quickLinkDesc3: 'Endpoints, webhooks và giao thức tích hợp.',
    faqTitle: 'Câu hỏi thường gặp',
    faq: [
      {
        q: 'Làm thế nào để xác minh một mô hình AI chẩn đoán mới?',
        a: 'Để xác minh một mô hình mới, hãy điều hướng đến "Quản lý AI Model" trong thanh bên. Nhấp vào "Thêm AI Model" và tải lên bằng chứng mật mã cùng với trọng số của mô hình. Hệ thống sẽ tự động xếp hàng kiểm toán zero-knowledge. Xác minh thường mất 5-15 phút tùy thuộc vào tải mạng.',
      },
      {
        q: 'Điều gì xảy ra nếu giao dịch blockchain thất bại?',
        a: 'Các giao dịch thất bại được ghi lại tự động trong tab "Giao dịch Blockchain" dưới bộ lọc "Thất bại". Hệ thống sẽ thử lại tự động tối đa 3 lần cho các lỗi mạng tạm thời. Nếu vẫn tiếp tục, hãy kiểm tra trạng thái đồng bộ node hoặc liên hệ hỗ trợ kèm TxID.',
      },
      {
        q: 'Tôi có thể xuất nhật ký kiểm toán bệnh nhân không?',
        a: 'Có. Nhật ký kiểm toán có thể xuất dưới định dạng CSV hoặc JSON đã mã hóa. Đi tới Cài đặt > Tuân thủ > Xuất kiểm toán. Bạn sẽ cần khóa quản trị để giải mã tệp đã xuất.',
      },
    ],
    contactTitle: 'Liên hệ Hỗ trợ',
    subjectLabel: 'Tiêu đề vấn đề',
    subjectPlaceholder: 'Ví dụ: Vượt quá giới hạn API Rate Limit',
    categoryLabel: 'Danh mục',
    categories: ['Vấn đề kỹ thuật', 'Thanh toán & Đăng ký', 'Bảo mật & Kiểm toán', 'Câu hỏi chung'],
    descLabel: 'Mô tả',
    descPlaceholder: 'Cung cấp chi tiết về sự cố, bao gồm mã lỗi...',
    liveChat: 'Chat trực tiếp',
    submitTicket: 'Gửi yêu cầu',
    successMsg: 'Yêu cầu đã được gửi thành công! Chúng tôi sẽ phản hồi trong 24 giờ.',
  },
  en: {
    title: 'Support & Help Center',
    subtitle: 'Access documentation, troubleshooting, and clinical support.',
    searchTitle: 'How can we assist you today?',
    searchPlaceholder: 'Search for documentation, errors, or keywords...',
    searchBtn: 'Search',
    popular: 'Popular:',
    popularLinks: ['Node Sync Issue', 'Reset API Keys', 'Audit Logs'],
    quickLinkTitle1: 'Common Issues',
    quickLinkDesc1: 'Troubleshooting guides for frequent platform alerts.',
    quickLinkTitle2: 'User Manual',
    quickLinkDesc2: 'Comprehensive documentation for the ZKP system.',
    quickLinkTitle3: 'API Documentation',
    quickLinkDesc3: 'Endpoints, webhooks, and integration protocols.',
    faqTitle: 'Frequently Asked Questions',
    faq: [
      {
        q: 'How do I verify a new AI Diagnosis Model?',
        a: 'To verify a new model, navigate to "AI Model Management" in the sidebar. Click "Add AI Model" and upload the required cryptographic proof along with the model\'s weights. The system will automatically queue a zero-knowledge audit. Verification typically takes 5–15 minutes depending on network load.',
      },
      {
        q: 'What happens if a blockchain transaction fails?',
        a: 'Failed transactions are automatically logged in the "Blockchain Transactions" tab under the "Failed" filter. The system will attempt automatic retry up to 3 times for transient network errors. If it persists, check your node sync status or contact support with the TxID.',
      },
      {
        q: 'Can I export patient audit logs?',
        a: 'Yes. Audit logs can be exported as encrypted CSV or JSON formats. Go to Settings > Compliance > Audit Export. You will need your administrative key to decrypt the exported file.',
      },
    ],
    contactTitle: 'Contact Support',
    subjectLabel: 'Issue Subject',
    subjectPlaceholder: 'e.g., API Rate Limit Exceeded',
    categoryLabel: 'Category',
    categories: ['Technical Issue', 'Billing & Subscriptions', 'Security & Audits', 'General Inquiry'],
    descLabel: 'Description',
    descPlaceholder: 'Provide details about the issue, including error codes...',
    liveChat: 'Live Chat',
    submitTicket: 'Submit Ticket',
    successMsg: 'Your ticket has been submitted! We will respond within 24 hours.',
  },
};

/* ─────────────────────────────────────────────
   Accordion Item
   ───────────────────────────────────────────── */
function AccordionItem({ question, answer, theme }) {
  const [open, setOpen] = useState(false);

  const bgCard = theme === 'dark'
    ? 'bg-[#051a3e] border-white/5'
    : 'bg-slate-50 border-slate-200';
  const textQ  = theme === 'dark' ? 'text-on-surface' : 'text-slate-800';
  const textA  = theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-500';
  const divider = theme === 'dark' ? 'border-white/5' : 'border-slate-200';
  const hoverBg = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${bgCard}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-6 py-4 flex items-center justify-between text-left focus:outline-none transition-colors ${hoverBg}`}
      >
        <span className={`font-medium text-sm ${textQ}`}>{question}</span>
        <span
          className={`material-symbols-outlined flex-shrink-0 transition-transform duration-300 ${
            theme === 'dark' ? 'text-on-surface-variant' : 'text-slate-400'
          }`}
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out`}
        style={{ maxHeight: open ? '300px' : '0px' }}
      >
        <div className={`px-6 pb-5 pt-1 text-sm border-t ${divider} ${textA}`}>
          {answer}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */
export default function SupportView() {
  const { theme, lang } = useThemeLang();
  const T = supportDict[lang] ?? supportDict.en;

  const [formState, setFormState] = useState({ subject: '', category: '0', description: '' });
  const [submitted, setSubmitted] = useState(false);

  /* Theme-aware tokens */
  const isDark = theme === 'dark';

  const cardBg      = isDark ? 'bg-[#091e42] border-white/5'   : 'bg-white border-slate-200';
  const cardHover   = isDark ? 'hover:bg-[#0d2450]'            : 'hover:bg-slate-50';
  const textPrimary = isDark ? 'text-on-surface'               : 'text-slate-900';
  const textMuted   = isDark ? 'text-on-surface-variant'       : 'text-slate-500';
  const inputBg     = isDark ? 'bg-[#001233] border-white/10 text-on-surface placeholder-white/30 focus:border-accent-blue' 
                              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500';
  const searchWrap  = isDark ? 'bg-[#091e42] border-white/5'   : 'bg-white border-slate-200';
  const iconBg      = isDark ? 'bg-[#001233] border-white/5'   : 'bg-slate-100 border-slate-200';
  const sectionBg   = isDark ? 'bg-[#091e42] border-white/5'   : 'bg-white border-slate-200';
  const accentBtn   = isDark ? 'bg-accent-blue hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white';
  const ghostBtn    = isDark ? 'border-white/20 text-on-surface hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100';
  const popularLinkColor = isDark ? 'text-on-surface-variant hover:text-[#4481FF]' : 'text-slate-500 hover:text-blue-600';

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setFormState({ subject: '', category: '0', description: '' });
  };

  return (
    <div className="space-y-6">

      {/* ── Search Banner ── */}
      <section className={`rounded-2xl p-8 border ${searchWrap}`}>
        <h3 className={`text-xl font-semibold mb-6 ${textPrimary}`}>{T.searchTitle}</h3>
        <div className="relative flex gap-4 max-w-2xl">
          <div className="relative flex-1">
            <span
              className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${textMuted}`}
            >
              search
            </span>
            <input
              type="text"
              placeholder={T.searchPlaceholder}
              className={`w-full border rounded-xl py-3 pl-12 pr-4 text-sm transition-all focus:outline-none focus:ring-2 ${
                isDark ? 'focus:ring-blue-500/40' : 'focus:ring-blue-400/40'
              } ${inputBg}`}
            />
          </div>
          <button className={`px-6 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-colors ${accentBtn}`}>
            {T.searchBtn}
          </button>
        </div>
        <div className={`mt-4 flex flex-wrap gap-2 text-sm ${textMuted}`}>
          <span className="opacity-70">{T.popular}</span>
          {T.popularLinks.map((link, i) => (
            <span key={i}>
              {i > 0 && <span className="mr-2">,</span>}
              <a href="#" className={`transition-colors ${popularLinkColor}`}>{link}</a>
            </span>
          ))}
        </div>
      </section>

      {/* ── Quick Link Cards ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <a
          href="#"
          className={`rounded-2xl p-6 border flex flex-col h-48 transition-all cursor-pointer ${cardBg} ${cardHover}`}
        >
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${iconBg}`}>
            <span className="material-symbols-outlined text-[#48d7f9]">report_problem</span>
          </div>
          <h4 className={`font-semibold mb-2 ${textPrimary}`}>{T.quickLinkTitle1}</h4>
          <p className={`text-sm ${textMuted}`}>{T.quickLinkDesc1}</p>
        </a>

        {/* Card 2 */}
        <a
          href="#"
          className={`rounded-2xl p-6 border flex flex-col h-48 transition-all cursor-pointer ${cardBg} ${cardHover}`}
        >
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${iconBg}`}>
            <span className="material-symbols-outlined text-[#65dca4]">menu_book</span>
          </div>
          <h4 className={`font-semibold mb-2 ${textPrimary}`}>{T.quickLinkTitle2}</h4>
          <p className={`text-sm ${textMuted}`}>{T.quickLinkDesc2}</p>
        </a>

        {/* Card 3 */}
        <a
          href="#"
          className={`rounded-2xl p-6 border flex flex-col h-48 transition-all cursor-pointer ${cardBg} ${cardHover}`}
        >
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${iconBg}`}>
            <span className={`material-symbols-outlined ${isDark ? 'text-[#4481FF]' : 'text-blue-600'}`}>code</span>
          </div>
          <h4 className={`font-semibold mb-2 ${textPrimary}`}>{T.quickLinkTitle3}</h4>
          <p className={`text-sm ${textMuted}`}>{T.quickLinkDesc3}</p>
        </a>
      </section>

      {/* ── Lower: FAQ + Contact Form ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* FAQ */}
        <section className={`lg:col-span-7 rounded-2xl p-8 border ${sectionBg}`}>
          <h3 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${textPrimary}`}>
            <span className="material-symbols-outlined text-[#48d7f9]">forum</span>
            {T.faqTitle}
          </h3>
          <div className="space-y-3">
            {T.faq.map((item, idx) => (
              <AccordionItem
                key={idx}
                question={item.q}
                answer={item.a}
                theme={theme}
              />
            ))}
          </div>
        </section>

        {/* Contact Support Form */}
        <section className={`lg:col-span-5 rounded-2xl p-8 border ${sectionBg}`}>
          <h3 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${textPrimary}`}>
            <span className="material-symbols-outlined">support_agent</span>
            {T.contactTitle}
          </h3>

          {submitted && (
            <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              isDark
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <span className="material-symbols-outlined text-lg">check_circle</span>
              {T.successMsg}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Subject */}
            <div>
              <label className={`block font-medium text-sm mb-2 ${textPrimary}`}>
                {T.subjectLabel}
              </label>
              <input
                type="text"
                placeholder={T.subjectPlaceholder}
                value={formState.subject}
                onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                className={`w-full border rounded-lg py-2.5 px-3 text-sm transition-all focus:outline-none focus:ring-2 ${
                  isDark ? 'focus:ring-blue-500/40' : 'focus:ring-blue-400/40'
                } ${inputBg}`}
              />
            </div>

            {/* Category */}
            <div>
              <label className={`block font-medium text-sm mb-2 ${textPrimary}`}>
                {T.categoryLabel}
              </label>
              <select
                value={formState.category}
                onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                className={`w-full border rounded-lg py-2.5 px-3 text-sm appearance-none transition-all focus:outline-none focus:ring-2 ${
                  isDark ? 'focus:ring-blue-500/40' : 'focus:ring-blue-400/40'
                } ${inputBg}`}
              >
                {T.categories.map((cat, i) => (
                  <option key={i} value={String(i)}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className={`block font-medium text-sm mb-2 ${textPrimary}`}>
                {T.descLabel}
              </label>
              <textarea
                rows={4}
                placeholder={T.descPlaceholder}
                value={formState.description}
                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                className={`w-full border rounded-lg py-2.5 px-3 text-sm resize-none transition-all focus:outline-none focus:ring-2 ${
                  isDark ? 'focus:ring-blue-500/40' : 'focus:ring-blue-400/40'
                } ${inputBg}`}
              />
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${ghostBtn}`}
                onClick={() => alert(lang === 'vi' ? 'Chat trực tiếp đang được phát triển.' : 'Live chat is under development.')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chat</span>
                {T.liveChat}
              </button>
              <button
                type="submit"
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${accentBtn}`}
              >
                {T.submitTicket}
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
