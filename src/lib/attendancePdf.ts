/**
 * attendancePdf.ts
 * تصدير سجل الحضور — جدول شهري بهوية مُصلِح
 * بألوان مستخرجة من ملف Excel الرسمي للمشروع
 */

import type { AppData, AttendanceStatus } from './types';

/** م / غ / ب / ت */
const CODE: Record<AttendanceStatus, string> = {
  present: 'م',
  absent:  'غ',
  excused: 'ب',
  late:    'ت',
};

const CODE_COLOR: Record<AttendanceStatus, { bg: string; color: string }> = {
  present: { bg: '#d4edda', color: '#1e5c35' },
  absent:  { bg: '#f8d7da', color: '#7a1e1e' },
  excused: { bg: '#d6eaf8', color: '#15507a' },
  late:    { bg: '#fdf0d6', color: '#7a4f08' },
};

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// ── Brand colours (from Excel styles) ──────────────────────────────────────
const C = {
  darkBrown:  '#3B2A22',
  midBrown:   '#7A553A',
  lightBrown: '#B08968',
  cream:      '#F3E9D7',
  pageBg:     '#FAF5ED',
  border:     '#D6BFA6',
  borderDark: '#C4AA8C',
  textDark:   '#2a1a0e',
  textMid:    '#5a3e28',
  textLight:  '#8a6848',
};

interface ColDef {
  date: string;
  sessionName: string;
  dayLabel: string;
}

function buildHTML(
  data: AppData,
  orderedStudentIds: string[],
  exportedBy: string,
): string {
  const attendance  = data.attendance ?? [];
  const studentMap  = Object.fromEntries(data.students.map((s) => [s.id, s]));
  const ordered     = orderedStudentIds.map((id) => studentMap[id]).filter(Boolean);

  // ── Collect all unique dates (sorted) ──────────────────────────────────
  const allDates = [...new Set(attendance.map((r) => r.date))].sort();

  // ── Build column definitions (date × session) ──────────────────────────
  // For each date, get unique session names recorded that day
  const colMap = new Map<string, ColDef>(); // key: date|session
  for (const date of allDates) {
    const dayRecs = attendance.filter((r) => r.date === date);
    const sessions = [...new Set(dayRecs.map((r) => r.sessionType ?? ''))];
    for (const sess of sessions) {
      const key = `${date}|${sess}`;
      if (!colMap.has(key)) {
        colMap.set(key, {
          date,
          sessionName: sess,
          dayLabel: DAYS_AR[new Date(date + 'T12:00:00').getDay()],
        });
      }
    }
  }

  // If no session names, just one col per date
  if (colMap.size === 0) {
    for (const date of allDates) {
      colMap.set(`${date}|`, { date, sessionName: '', dayLabel: DAYS_AR[new Date(date + 'T12:00:00').getDay()] });
    }
  }

  const cols = [...colMap.values()];

  // ── recordIndex: studentId → date|session → record ─────────────────────
  const recIdx = new Map<string, Map<string, { status: AttendanceStatus; lateMinutes?: number; excuse?: string }>>();
  for (const r of attendance) {
    const key = `${r.date}|${r.sessionType ?? ''}`;
    if (!recIdx.has(r.studentId)) recIdx.set(r.studentId, new Map());
    recIdx.get(r.studentId)!.set(key, { status: r.status, lateMinutes: r.lateMinutes, excuse: r.excuse });
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const programName = data.config?.programName || 'مُصلِح';
  const logoUrl = `${window.location.origin}${import.meta.env.BASE_URL}logo.png`;
  const nowLabel = new Date().toLocaleString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const dateRange = allDates.length > 0
    ? `${allDates[0]} → ${allDates[allDates.length - 1]}`
    : 'لا توجد سجلات';

  // ── Exception rows (sheet 2) ─────────────────────────────────────────
  interface ExcRow { num: number; name: string; date: string; day: string; type: string; detail: string }
  const exceptions: ExcRow[] = [];
  let excNum = 1;
  for (const s of ordered) {
    const sRecs = (recIdx.get(s.id) ?? new Map());
    for (const [colKey, rec] of sRecs) {
      if (rec.status === 'late' || rec.status === 'excused') {
        const [date] = colKey.split('|');
        const day = DAYS_AR[new Date(date + 'T12:00:00').getDay()];
        exceptions.push({
          num: excNum++,
          name: s.name,
          date,
          day,
          type: rec.status === 'late' ? 'تأخير' : 'غياب مبرر',
          detail: rec.status === 'late'
            ? (rec.lateMinutes ? `${rec.lateMinutes} دقيقة` : '—')
            : (rec.excuse || '—'),
        });
      }
    }
  }

  // ── Column headers HTML ───────────────────────────────────────────────
  const sessionNames = [...new Set(cols.map((c) => c.sessionName))];

  // Group columns by date for spanning
  const dateGroups = new Map<string, number>();
  for (const c of cols) dateGroups.set(c.date, (dateGroups.get(c.date) ?? 0) + 1);

  const headerDateCells = [...dateGroups.entries()].map(([date, span]) => `
    <th colspan="${span}" style="background:${C.midBrown};color:${C.cream};padding:6px 4px;border:1px solid ${C.borderDark};font-size:10px;white-space:nowrap;font-weight:700">
      ${date}
    </th>
  `).join('');

  const headerDayCells = cols.map((c) => `
    <th style="background:${C.lightBrown};color:${C.cream};padding:5px 3px;border:1px solid ${C.borderDark};font-size:10px;white-space:nowrap;min-width:36px">
      ${c.dayLabel}
    </th>
  `).join('');

  const headerSessionCells = cols.map((c) => `
    <th style="background:${C.lightBrown};color:${C.cream};padding:5px 3px;border:1px solid ${C.borderDark};font-size:9px;white-space:nowrap;font-weight:600">
      ${c.sessionName || '—'}
    </th>
  `).join('');

  // ── Student rows ──────────────────────────────────────────────────────
  const rows = ordered.map((s, i) => {
    const sRecs  = recIdx.get(s.id) ?? new Map();
    const group  = (s.groups ?? []).filter(Boolean).join('، ') || s.group || '';
    const rowBg  = i % 2 === 0 ? C.cream : '#ffffff';

    let present = 0, absent = 0, excused = 0, late = 0;

    const dataCells = cols.map((col) => {
      const key = `${col.date}|${col.sessionName}`;
      const rec = sRecs.get(key);
      if (!rec) return `<td style="background:${rowBg};border:1px solid ${C.border};text-align:center;padding:4px 2px;color:${C.textLight};font-size:11px">—</td>`;
      const { bg, color } = CODE_COLOR[rec.status];
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'excused') excused++;
      else if (rec.status === 'late') late++;
      return `<td style="background:${bg};border:1px solid ${C.border};text-align:center;padding:4px 2px;color:${color};font-weight:800;font-size:12px">${CODE[rec.status]}</td>`;
    }).join('');

    const total = present + late + excused + absent;
    const pct   = total > 0 ? Math.round(((present + late) / total) * 100) + '%' : '—';
    const pctColor = present + late >= absent ? C.midBrown : '#7a1e1e';

    return `
      <tr>
        <td style="background:${rowBg};border:1px solid ${C.border};text-align:center;padding:5px 4px;color:${C.textLight};font-size:11px;font-weight:700">${i + 1}</td>
        <td style="background:${rowBg};border:1px solid ${C.border};padding:5px 10px;font-weight:600;font-size:12px;white-space:nowrap">${s.name}</td>
        <td style="background:${rowBg};border:1px solid ${C.border};padding:5px 8px;font-size:10px;color:${C.textMid};white-space:nowrap">${group}</td>
        ${dataCells}
        <td style="background:#e8f5e9;border:1px solid ${C.border};text-align:center;padding:5px 4px;color:#1e5c35;font-weight:800;font-size:12px">${present}</td>
        <td style="background:#fce4ec;border:1px solid ${C.border};text-align:center;padding:5px 4px;color:#7a1e1e;font-weight:800;font-size:12px">${absent}</td>
        <td style="background:#e3f2fd;border:1px solid ${C.border};text-align:center;padding:5px 4px;color:#15507a;font-weight:800;font-size:12px">${excused}</td>
        <td style="background:#fff8e1;border:1px solid ${C.border};text-align:center;padding:5px 4px;color:#7a4f08;font-weight:800;font-size:12px">${late}</td>
        <td style="background:${rowBg};border:1px solid ${C.border};text-align:center;padding:5px 4px;color:${pctColor};font-weight:700;font-size:11px">${pct}</td>
      </tr>
    `;
  }).join('');

  // ── Daily totals footer row ───────────────────────────────────────────
  const dailyTotals = cols.map((col) => {
    const key = `${col.date}|${col.sessionName}`;
    const count = ordered.filter((s) => {
      const r = recIdx.get(s.id)?.get(key);
      return r?.status === 'present' || r?.status === 'late';
    }).length;
    return `<td style="background:${C.cream};border:1px solid ${C.borderDark};text-align:center;padding:5px 4px;font-weight:800;font-size:12px;color:${C.darkBrown}">${count || '—'}</td>`;
  }).join('');

  // ── Exceptions table rows ─────────────────────────────────────────────
  const excRows = exceptions.map((e, i) => {
    const bg = i % 2 === 0 ? C.cream : '#ffffff';
    return `
      <tr>
        <td style="background:${bg};border:1px solid ${C.border};text-align:center;padding:5px 6px;color:${C.textLight};font-size:11px;font-weight:700">${e.num}</td>
        <td style="background:${bg};border:1px solid ${C.border};padding:5px 10px;font-weight:600;font-size:12px;white-space:nowrap">${e.name}</td>
        <td style="background:${bg};border:1px solid ${C.border};padding:5px 8px;font-size:11px;text-align:center">${e.date}</td>
        <td style="background:${bg};border:1px solid ${C.border};padding:5px 8px;font-size:11px;text-align:center">${e.day}</td>
        <td style="background:${bg};border:1px solid ${C.border};padding:5px 8px;font-size:11px;text-align:center;font-weight:700;color:${e.type === 'تأخير' ? '#7a4f08' : '#15507a'}">${e.type}</td>
        <td style="background:${bg};border:1px solid ${C.border};padding:5px 10px;font-size:11px;color:${C.textMid}">${e.detail}</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="6" style="text-align:center;padding:16px;color:${C.textLight};font-size:12px;background:${C.cream}">لا توجد حالات استثنائية مسجلة</td></tr>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>سجل الحضور — ${programName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    background: ${C.pageBg};
    color: ${C.textDark};
    direction: rtl;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  /* ─ Page wrapper ─ */
  .page {
    width: 100%;
    background: ${C.pageBg};
    padding: 0 0 32px;
  }

  /* ─ Section header ─ */
  .section-header {
    background: linear-gradient(135deg, ${C.darkBrown} 0%, ${C.midBrown} 60%, ${C.lightBrown} 100%);
    color: ${C.cream};
    padding: 20px 32px 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    page-break-before: auto;
  }
  .section-header + * { page-break-before: avoid; }

  .header-brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark {
    width: 46px; height: 46px;
    background: rgba(255,255,255,0.15);
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
  .brand-title { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
  .brand-sub   { font-size: 11px; opacity: 0.75; margin-top: 2px; font-weight: 500; }

  .header-info {
    display: flex; gap: 24px; align-items: flex-end;
  }
  .info-item { text-align: center; }
  .info-label { font-size: 10px; opacity: 0.7; font-weight: 600; margin-bottom: 2px; }
  .info-val   { font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.12); padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); }

  /* ─ Table wrapper (scrolls on screen, full on print) ─ */
  .table-wrap {
    padding: 16px 20px 0;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .th-fixed {
    background: ${C.darkBrown};
    color: ${C.cream};
    padding: 8px 10px;
    border: 1px solid ${C.borderDark};
    font-weight: 700;
    font-size: 11px;
    white-space: nowrap;
    vertical-align: middle;
  }

  .th-total-present { background: #1e5c35; color: white; padding: 6px 4px; border: 1px solid ${C.borderDark}; text-align: center; font-size: 10px; font-weight: 700; min-width: 34px; }
  .th-total-absent  { background: #7a1e1e; color: white; padding: 6px 4px; border: 1px solid ${C.borderDark}; text-align: center; font-size: 10px; font-weight: 700; min-width: 34px; }
  .th-total-excused { background: #15507a; color: white; padding: 6px 4px; border: 1px solid ${C.borderDark}; text-align: center; font-size: 10px; font-weight: 700; min-width: 34px; }
  .th-total-late    { background: #7a4f08; color: white; padding: 6px 4px; border: 1px solid ${C.borderDark}; text-align: center; font-size: 10px; font-weight: 700; min-width: 34px; }
  .th-total-pct     { background: ${C.midBrown}; color: white; padding: 6px 4px; border: 1px solid ${C.borderDark}; text-align: center; font-size: 10px; font-weight: 700; min-width: 44px; }

  /* ─ Footer totals row ─ */
  .totals-label {
    background: ${C.darkBrown};
    color: ${C.cream};
    border: 1px solid ${C.borderDark};
    padding: 6px 10px;
    font-weight: 700;
    font-size: 11px;
    white-space: nowrap;
  }

  /* ─ Legend ─ */
  .legend {
    display: flex; gap: 16px; align-items: center;
    padding: 10px 20px;
    background: ${C.cream};
    border-top: 1px solid ${C.border};
    font-size: 11px;
    flex-wrap: wrap;
  }
  .legend-item { display: flex; align-items: center; gap: 5px; font-weight: 600; }
  .legend-badge {
    width: 22px; height: 22px;
    border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 900; font-size: 12px;
  }

  /* ─ Section 2 heading ─ */
  .section2-header {
    background: linear-gradient(135deg, ${C.darkBrown} 0%, ${C.midBrown} 100%);
    color: ${C.cream};
    padding: 14px 32px;
    margin-top: 0;
  }
  .section2-title { font-size: 16px; font-weight: 800; }
  .section2-note  { font-size: 10.5px; opacity: 0.75; margin-top: 3px; }

  /* ─ Footer ─ */
  .footer {
    margin: 16px 20px 0;
    padding: 10px 18px;
    background: ${C.cream};
    border-radius: 8px;
    border: 1px solid ${C.border};
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    color: ${C.textMid};
    font-weight: 600;
  }

  /* ─ Print ─ */
  @media print {
    body { background: white; }
    @page { margin: 8mm; size: A4 landscape; }
    .table-wrap { padding: 8px 0 0; overflow: visible; }
    .page-break { page-break-before: always; }
  }

  @media screen {
    body { padding: 20px 0 40px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ═══ SHEET 1: MAIN ATTENDANCE GRID ═══ -->
  <div class="section-header">
    <div class="header-brand">
      <img src="${logoUrl}" alt="مُصلِح" style="width:50px;height:50px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.2)" />
      <div>
        <div class="brand-title">مسابقة مُصلِح &nbsp;|&nbsp; سجل الحضور والغياب العام</div>
        <div class="brand-sub">مسابقة مُصلِح</div>
      </div>
    </div>
    <div class="header-info">
      <div class="info-item">
        <div class="info-label">البرنامج</div>
        <div class="info-val">${programName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">الفترة</div>
        <div class="info-val">${dateRange}</div>
      </div>
      <div class="info-item">
        <div class="info-label">عدد الطلاب</div>
        <div class="info-val">${ordered.length}</div>
      </div>
    </div>
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <table>
      <thead>
        <!-- Row 1: fixed labels + dates -->
        <tr>
          <th class="th-fixed" rowspan="3" style="width:34px">#</th>
          <th class="th-fixed" rowspan="3" style="text-align:right;min-width:120px">اسم الطالب</th>
          <th class="th-fixed" rowspan="3" style="text-align:right;width:90px">المجموعة</th>
          ${headerDateCells}
          <th class="th-total-present" rowspan="3">إجمالي<br>الحضور<br>(م)</th>
          <th class="th-total-absent"  rowspan="3">إجمالي<br>الغياب<br>(غ)</th>
          <th class="th-total-excused" rowspan="3">غياب<br>مبرر<br>(ب)</th>
          <th class="th-total-late"    rowspan="3">إجمالي<br>التأخير<br>(ت)</th>
          <th class="th-total-pct"     rowspan="3">نسبة<br>الحضور</th>
        </tr>
        <!-- Row 2: day of week -->
        <tr>${headerDayCells}</tr>
        <!-- Row 3: session name -->
        <tr>${headerSessionCells}</tr>
      </thead>
      <tbody>
        ${rows}
        <!-- Totals row -->
        <tr>
          <td colspan="3" class="totals-label">إجمالي الحاضرين اليومي</td>
          ${dailyTotals}
          <td colspan="5" style="background:${C.cream};border:1px solid ${C.borderDark}"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Legend -->
  <div class="legend">
    <strong style="color:${C.textMid}">دليل الرموز:</strong>
    <div class="legend-item">
      <div class="legend-badge" style="background:#d4edda;color:#1e5c35">م</div>
      <span style="color:#1e5c35">حاضر</span>
    </div>
    <div class="legend-item">
      <div class="legend-badge" style="background:#f8d7da;color:#7a1e1e">غ</div>
      <span style="color:#7a1e1e">غائب</span>
    </div>
    <div class="legend-item">
      <div class="legend-badge" style="background:#d6eaf8;color:#15507a">ب</div>
      <span style="color:#15507a">غياب مبرر</span>
    </div>
    <div class="legend-item">
      <div class="legend-badge" style="background:#fdf0d6;color:#7a4f08">ت</div>
      <span style="color:#7a4f08">متأخر</span>
    </div>
    <div class="legend-item" style="margin-right:auto;color:${C.textLight}">
      — = لم يُسجَّل
    </div>
  </div>

  <!-- ═══ SHEET 2: EXCEPTIONS ═══ -->
  <div class="page-break"></div>

  <div class="section2-header" style="margin-top:0">
    <div class="section2-title">مسابقة مُصلِح &nbsp;|&nbsp; سجل تفاصيل الغياب المبرر ودقائق التأخير والأسباب</div>
    <div class="section2-note">ملاحظة: يتضمن هذا السجل فقط الحالات الاستثنائية (التأخير بالدقائق وأسباب الغياب المبرر) ليبقى السجل العام مختصراً ومريحاً.</div>
  </div>

  <div class="table-wrap" style="padding-top:12px">
    <table>
      <thead>
        <tr>
          <th class="th-fixed" style="width:40px">م</th>
          <th class="th-fixed" style="text-align:right;min-width:130px">اسم الطالب</th>
          <th class="th-fixed" style="width:100px">التاريخ</th>
          <th class="th-fixed" style="width:70px">اليوم</th>
          <th class="th-fixed" style="width:90px">نوع الحالة</th>
          <th class="th-fixed" style="text-align:right">التفاصيل (دقائق التأخير / سبب العذر)</th>
        </tr>
      </thead>
      <tbody>${excRows}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div style="display:flex;align-items:center;gap:8px">
      <img src="${logoUrl}" alt="مُصلِح" style="width:24px;height:24px;border-radius:6px;object-fit:cover" />
      <span>مسابقة مُصلِح</span>
    </div>
    <div>صدّره: ${exportedBy} &nbsp;·&nbsp; ${nowLabel}</div>
  </div>

</div>
<script>
  document.fonts.ready.then(() => setTimeout(() => window.print(), 500));
  window.onafterprint = () => window.close();
</script>
</body>
</html>`;
}

export async function exportAttendanceDayPDF(
  data: AppData,
  _date: string,
  _sessionName: string,
  orderedStudentIds: string[],
  exportedBy: string,
): Promise<void> {
  const html = buildHTML(data, orderedStudentIds, exportedBy);

  // ── render in a hidden off-screen iframe ──────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  // give fonts/styles a moment to finish painting
  await new Promise((r) => setTimeout(r, 400));

  const body = iframe.contentDocument?.body;
  if (!body) { document.body.removeChild(iframe); return; }

  // expand iframe to full content height so nothing is clipped
  iframe.style.height = body.scrollHeight + 'px';
  await new Promise((r) => setTimeout(r, 100));

  try {
    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF }       = await import('jspdf');

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: true,
      backgroundColor: '#ffffff',
      width:  body.scrollWidth,
      height: body.scrollHeight,
      windowWidth: 1200,
    });

    const imgW  = canvas.width;
    const imgH  = canvas.height;
    // A4 landscape in px at 96 dpi → use pt units inside jsPDF
    const pdfW  = 841.89;   // A4 landscape width  (pt)
    const pdfH  = pdfW * (imgH / imgW);

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [pdfW, pdfH] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH);

    const programName = data.config?.programName ?? 'مصلح';
    pdf.save(`سجل-الحضور-${programName}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
