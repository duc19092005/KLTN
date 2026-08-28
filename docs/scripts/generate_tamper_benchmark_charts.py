import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

os.makedirs('docs/assets', exist_ok=True)

# Data from Hardhat Tamper Benchmark (Strict Sequential Verification)
scenarios = [
    '1. Sửa 1 trường\n(Log #450)',
    '2. Xóa lén log\n(Log #720)',
    '3. Tráo thứ tự\n(Log #300-#301)',
    '4. Chèn log giả\n(Log #151)'
]

# Detection Success (100% for both methods)
detect_raw = [100, 100, 100, 100]
detect_merkle = [100, 100, 100, 100]

# Detection Latency (ms)
time_raw = [307.11, 453.58, 189.99, 98.60]
time_merkle = [5.36, 4.90, 4.92, 4.73]

# Network Bandwidth (KB)
bandwidth_raw = [112.53, 180.03, 75.03, 37.78]
bandwidth_merkle = [0.06, 0.06, 0.06, 0.06]

COLOR_RAW = '#f43f5e'       # Crimson Red
BORDER_RAW = '#e11d48'
COLOR_MERKLE = '#10b981'    # Emerald Green
BORDER_MERKLE = '#059669'
COLOR_DARK = '#0f172a'
COLOR_MUTED = '#475569'

plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#cbd5e1'
plt.rcParams['axes.linewidth'] = 1.2

fig = plt.figure(figsize=(18, 12), dpi=300)
fig.patch.set_facecolor('#f8fafc')

# Header
fig.text(0.5, 0.965, 'BENCHMARK: HIỆU NĂNG PHÁT HIỆN SAI SÓT & SỬA ĐỔI DỮ LIỆU (TAMPER DETECTION)',
         ha='center', va='center', fontsize=20, fontweight='bold', color=COLOR_DARK)
fig.text(0.5, 0.935, 'Thực nghiệm 4 kịch bản tấn công: Cả 2 phương pháp đều đạt 100% phát hiện, so sánh chi phí & tốc độ đối soát',
         ha='center', va='center', fontsize=12, color=COLOR_MUTED, style='italic')

box_raw = dict(boxstyle='round,pad=0.5', facecolor='#ffffff', edgecolor=BORDER_RAW, alpha=0.95, lw=1.2)
box_merkle = dict(boxstyle='round,pad=0.5', facecolor='#ffffff', edgecolor=BORDER_MERKLE, alpha=0.95, lw=1.2)

x = np.arange(len(scenarios))
width = 0.35

# ==============================================================================
# SUBPLOT 1: TỶ LỆ PHÁT HIỆN SAI LỆCH (DETECTION RATE)
# ==============================================================================
ax1 = fig.add_subplot(2, 2, 1)
ax1.set_facecolor('#ffffff')

b1 = ax1.bar(x - width/2, detect_raw, width, label='Ghi Raw On-Chain (Tuần tự)', color=COLOR_RAW, edgecolor=BORDER_RAW)
b2 = ax1.bar(x + width/2, detect_merkle, width, label='Cây Merkle KLTN (1 Root)', color=COLOR_MERKLE, edgecolor=BORDER_MERKLE)

ax1.set_ylim(0, 140)
ax1.set_yticks([0, 20, 40, 60, 80, 100])
ax1.set_yticklabels(['0%', '20%', '40%', '60%', '80%', '100%'], fontsize=9.5, color='#334155')

ax1.set_ylabel('Tỷ Lệ Phát Hiện Thành Công', color=COLOR_DARK, fontsize=11, fontweight='bold')
ax1.set_title('1. ĐỘ CHÍNH XÁC PHÁT HIỆN SAI LỆCH (100% CẢ 2)', color=COLOR_DARK, fontsize=13, fontweight='bold', pad=12)
ax1.set_xticks(x)
ax1.set_xticklabels(scenarios, color='#334155', fontsize=9.5)
ax1.tick_params(colors='#475569')
ax1.legend(facecolor='#ffffff', edgecolor='#cbd5e1', labelcolor=COLOR_DARK, fontsize=9.5, loc='upper left')
ax1.grid(axis='y', linestyle='--', alpha=0.5, color='#e2e8f0')

ax1.annotate('100% TOÀN DIỆN\n(Cả 2 phương pháp đều phát hiện)', 
             xy=(2.5, 100), xytext=(2.5, 120),
             color=COLOR_DARK, fontsize=8.5, fontweight='bold', ha='center',
             bbox=dict(boxstyle='round,pad=0.5', facecolor='#ffffff', edgecolor='#64748b', alpha=0.95, lw=1.2),
             arrowprops=dict(arrowstyle="->", color='#64748b', lw=1.2))

# ==============================================================================
# SUBPLOT 2: THỜI GIAN PHÁT HIỆN SAI SÓT (DETECTION LATENCY)
# ==============================================================================
ax2 = fig.add_subplot(2, 2, 2)
ax2.set_facecolor('#ffffff')

ax2.bar(x - width/2, time_raw, width, label='Raw On-Chain (ms)', color=COLOR_RAW, edgecolor=BORDER_RAW)
ax2.bar(x + width/2, time_merkle, width, label='Cây Merkle (ms)', color=COLOR_MERKLE, edgecolor=BORDER_MERKLE)

ax2.set_yscale('log')
ax2.set_ylim(0.05, 8000)
ax2.set_yticks([0.1, 1, 10, 100, 1000])
ax2.set_yticklabels(['0.1 ms', '1 ms', '10 ms', '100 ms', '1.000 ms (1s)'], fontsize=9, color='#334155')

ax2.set_ylabel('Thời Gian Đối Soát & Phát Hiện', color=COLOR_DARK, fontsize=11, fontweight='bold')
ax2.set_title('2. TỐC ĐỘ ĐỐI SOÁT (EXECUTION LATENCY)', color=COLOR_DARK, fontsize=13, fontweight='bold', pad=12)
ax2.set_xticks(x)
ax2.set_xticklabels(scenarios, color='#334155', fontsize=9.5)
ax2.tick_params(colors='#475569')
ax2.legend(facecolor='#ffffff', edgecolor='#cbd5e1', labelcolor=COLOR_DARK, fontsize=9.5, loc='upper left')
ax2.grid(axis='y', linestyle='--', alpha=0.5, color='#e2e8f0')

# Clean non-overlapping annotations
ax2.annotate('Raw: Tốn 98 - 453 ms\n(Phải gọi 152 - 721 RPC calls)', 
             xy=(1 - width/2, time_raw[1]), xytext=(2.2, 1800),
             color='#be123c', fontsize=8.5, fontweight='bold', ha='center',
             bbox=box_raw,
             arrowprops=dict(arrowstyle="->", color=BORDER_RAW, lw=1.2))

ax2.annotate('Merkle: Ổn định ~4.9 ms\n(Chỉ 1 RPC call - Nhanh gấp ~50-90x)', 
             xy=(0 + width/2, time_merkle[0]), xytext=(0.8, 0.2),
             color='#047857', fontsize=8.5, fontweight='bold', ha='center',
             bbox=box_merkle,
             arrowprops=dict(arrowstyle="->", color=BORDER_MERKLE, lw=1.2))

# ==============================================================================
# SUBPLOT 3: BĂNG THÔNG MẠNG TIÊU THỤ (NETWORK OVERHEAD)
# ==============================================================================
ax3 = fig.add_subplot(2, 2, 3)
ax3.set_facecolor('#ffffff')

ax3.bar(x - width/2, bandwidth_raw, width, label='Raw On-Chain (KB)', color=COLOR_RAW, edgecolor=BORDER_RAW)
ax3.bar(x + width/2, bandwidth_merkle, width, label='Cây Merkle (KB)', color=COLOR_MERKLE, edgecolor=BORDER_MERKLE)

ax3.set_yscale('log')
ax3.set_ylim(0.002, 6000)
ax3.set_yticks([0.01, 0.1, 1, 10, 100, 500])
ax3.set_yticklabels(['0.01 KB', '0.1 KB', '1 KB', '10 KB', '100 KB', '500 KB'], fontsize=9, color='#334155')

ax3.set_ylabel('Băng Thông Mạng Tải Về', color=COLOR_DARK, fontsize=11, fontweight='bold')
ax3.set_title('3. BĂNG THÔNG RPC ĐỐI SOÁT (BANDWIDTH)', color=COLOR_DARK, fontsize=13, fontweight='bold', pad=12)
ax3.set_xticks(x)
ax3.set_xticklabels(scenarios, color='#334155', fontsize=9.5)
ax3.tick_params(colors='#475569')
ax3.legend(facecolor='#ffffff', edgecolor='#cbd5e1', labelcolor=COLOR_DARK, fontsize=9.5, loc='upper left')
ax3.grid(axis='y', linestyle='--', alpha=0.5, color='#e2e8f0')

# Position annotations in completely clear spaces
ax3.annotate('Raw tải 37 - 180 KB dữ liệu\n(Quét từng bản ghi trên chuỗi)', 
             xy=(1 - width/2, bandwidth_raw[1]), xytext=(2.2, 1200),
             color='#be123c', fontsize=8.5, fontweight='bold', ha='center',
             bbox=box_raw,
             arrowprops=dict(arrowstyle="->", color=BORDER_RAW, lw=1.2))

ax3.annotate('Merkle chỉ tải 0.06 KB (32 bytes hash)\n[Tiết kiệm tới 3,000 lần băng thông]', 
             xy=(0 + width/2, bandwidth_merkle[0]), xytext=(0.9, 0.009),
             color='#047857', fontsize=8.5, fontweight='bold', ha='center',
             bbox=box_merkle,
             arrowprops=dict(arrowstyle="->", color=BORDER_MERKLE, lw=1.2))

# ==============================================================================
# SUBPLOT 4: BẢNG SO SÁNH MA TRẬN PHÁT HIỆN SAI SÓT
# ==============================================================================
ax4 = fig.add_subplot(2, 2, 4)
ax4.set_facecolor('#ffffff')
ax4.axis('off')

table_data = [
    ['Kịch Bản Sai Lệch', 'Ghi Raw On-Chain', 'Cây Merkle (KLTN)', 'So Sánh Hiệu Quả'],
    ['1. Sửa 1 trường (#450)', 'Phát hiện (307 ms, 451 RPC)', 'Phát hiện (5.3 ms, 1 RPC)', 'Merkle nhanh gấp 57 LẦN'],
    ['2. Xóa lén log (#720)', 'Phát hiện (453 ms, 721 RPC)', 'Phát hiện (4.9 ms, 1 RPC)', 'Merkle nhanh gấp 92 LẦN'],
    ['3. Tráo thứ tự (#300-#301)', 'Phát hiện (190 ms, 301 RPC)', 'Phát hiện (4.9 ms, 1 RPC)', 'Merkle nhanh gấp 38 LẦN'],
    ['4. Chèn log giả (#151)', 'Phát hiện (98 ms, 152 RPC)', 'Phát hiện (4.7 ms, 1 RPC)', 'Merkle nhanh gấp 21 LẦN'],
    ['Tổng RPC cần gọi', '152 - 721 calls', '1 call duy nhất', 'Giảm tới 721 lần số RPC'],
    ['Độ chính xác định vị', '100% (Quét tuần tự)', '100% (Cây nhị phân)', 'Cả 2 đều bắt trúng vị trí']
]

col_widths = [0.26, 0.26, 0.25, 0.27]
table = ax4.table(cellText=table_data, colWidths=col_widths, loc='center', cellLoc='center')
table.auto_set_font_size(False)
table.set_fontsize(9.0)
table.scale(1.0, 2.1)

for (row, col), cell in table.get_celld().items():
    cell.set_edgecolor('#cbd5e1')
    cell.set_linewidth(1.0)
    if row == 0:
        cell.set_facecolor('#0f172a')
        cell.set_text_props(color='#ffffff', fontweight='bold')
    else:
        if col == 2:
            cell.set_facecolor('#ecfdf5')
            cell.set_text_props(color='#047857', fontweight='bold')
        elif col == 3:
            cell.set_facecolor('#f0f9ff')
            cell.set_text_props(color='#0369a1', fontweight='bold')
        elif col == 1:
            cell.set_facecolor('#fff1f2')
            cell.set_text_props(color='#be123c')
        else:
            cell.set_facecolor('#ffffff')
            cell.set_text_props(color='#1e293b')

plt.subplots_adjust(top=0.87, bottom=0.06, left=0.08, right=0.96, hspace=0.32, wspace=0.25)
output_path = 'docs/assets/benchmark_tamper_detection.png'
plt.savefig(output_path, dpi=300, facecolor=fig.get_facecolor())
plt.close()

print(f'✓ Đã xuất ảnh biểu đồ benchmark phát hiện sai sót hoàn chỉnh tại: {output_path}')