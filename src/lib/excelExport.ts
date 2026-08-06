import * as XLSX from 'xlsx';
import type { StudentReportRow, GroupReport, DayReport, ReportSummary } from './reportUtils';

type AttRec = { studentId: string; date: string; status: string };

function attendanceStats(studentId: string, attendance: AttRec[]) {
  const recs = attendance.filter((a) => a.studentId === studentId);
  const present = recs.filter((a) => a.status === 'present').length;
  const late = recs.filter((a) => a.status === 'late').length;
  const absent = recs.filter((a) => a.status === 'absent').length;
  const excused = recs.filter((a) => a.status === 'excused').length;
  const rate = recs.length > 0 ? Math.round(((present + late) / recs.length) * 100) : null;
  return { total: recs.length, present, late, absent, excused, rate };
}

// === Brand colors for Excel (hex without #) ===
const BRAND = {
  brown: '9A7B4F',
  brownDark: '3A291D',
  brownLight: 'F7F3ED',
  cream: 'FAF6EF',
  border: 'E2D9CA',
  green: '4A6B3A',
  greenLight: 'E8F0E0',
  amber: '9A6B2E',
  amberLight: 'FAF0E0',
  red: 'A8453A',
  redLight: 'F5E0DE',
  gold: 'D4A96A',
  white: 'FFFFFF',
  gray: '8A7560',
  grayLight: 'ECE4D6',
};

function statusLabel(s: string): string {
  return s === 'completed' ? 'مكتمل' : s === 'partial' ? 'جاري' : 'متأخر';
}

function statusColor(s: string): { bg: string; fg: string } {
  if (s === 'completed') return { bg: BRAND.greenLight, fg: BRAND.green };
  if (s === 'partial') return { bg: BRAND.amberLight, fg: BRAND.amber };
  return { bg: BRAND.redLight, fg: BRAND.red };
}

/**
 * Build a professionally formatted Excel workbook with multiple sheets.
 */
export function exportExcel(
  rows: StudentReportRow[],
  groupReports: GroupReport[],
  dayReports: DayReport[],
  summary: ReportSummary,
  currentDay: number,
  programName: string,
  attendance: AttRec[] = [],
) {
  const wb = XLSX.utils.book_new();

  // === Sheet 1: Summary ===
  const summaryData: (string | number)[][] = [
    [programName],
    [`تقرير شامل — اليوم ${currentDay}`],
    [new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
    [],
    ['المؤشر', 'القيمة'],
    ['إجمالي الطلاب', summary.totalStudents],
    ['إجمالي المهام', summary.totalTasks],
    ['إجمالي الإنجازات', summary.totalCompletions],
    ['متوسط الإنجاز الكلي', `${summary.avgOverall}%`],
    ['متوسط إنجاز اليوم', `${summary.avgToday}%`],
    ['معدل إنجاز اليوم', `${summary.todayRate}%`],
    ['أكملوا اليوم', summary.completedToday],
    ['إنجاز جزئي', summary.partialToday],
    ['لم يبدأوا', summary.lateToday],
    ['متوسط التقييم', summary.avgRating || '—'],
    ['إجمالي التقييمات', summary.totalRated],
    [],
    ['أبرز النتائج', ''],
  ];

  if (summary.topStudent) {
    summaryData.push(['الأعلى التزاماً', `${summary.topStudent.student.name} (${summary.topStudent.overallPercentage}%)`]);
  }
  if (summary.bestGroup) {
    summaryData.push(['أفضل مجموعة اليوم', `مجموعة ${summary.bestGroup.group} (${summary.bestGroup.avgToday}%)`]);
  }
  if (summary.mostLagging) {
    summaryData.push(['بحاجة متابعة', `${summary.mostLagging.student.name} (${summary.mostLagging.todayPercentage}%)`]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  applySummaryStyles(wsSummary, summaryData.length);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 45 }];
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص');

  // === Sheet 2: Students ===
  const studentHeaders = [
    'الترتيب', 'الاسم', 'المجموعة', 'الهاتف',
    'إنجاز اليوم', 'إجمالي مهام اليوم', 'نسبة اليوم',
    'الإنجاز الكلي', 'إجمالي المهام', 'النسبة الكلية',
    'الأيام المتتالية', 'متوسط التقييم', 'عدد التقييمات', 'الحالة',
    'نسبة الحضور', 'أيام الحضور', 'أيام التأخر', 'أيام الغياب',
  ];
  const studentRows = rows.map((r) => {
    const att = attendanceStats(r.student.id, attendance);
    return [
      r.rank, r.student.name, r.student.group, r.student.phone,
      r.todayCompleted, r.todayTotal, `${r.todayPercentage}%`,
      r.overallCompleted, r.overallTotal, `${r.overallPercentage}%`,
      r.streak, r.avgRating || '—', r.ratedCount, statusLabel(r.status),
      att.rate !== null ? `${att.rate}%` : '—', att.present, att.late, att.absent,
    ];
  });
  const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
  applyTableStyles(wsStudents, rows.length + 1, studentHeaders.length, 0);
  wsStudents['!cols'] = [
    { wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  // Color status column (col 13)
  rows.forEach((r, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 13 });
    const cell = wsStudents[cellRef];
    if (cell) {
      const sc = statusColor(r.status);
      cell.s = { ...cell.s, fill: { fgColor: { rgb: sc.bg } }, font: { ...cell.s?.font, color: { rgb: sc.fg }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
    // Color attendance rate column (col 14)
    const attRef = XLSX.utils.encode_cell({ r: i + 1, c: 14 });
    const attCell = wsStudents[attRef];
    const att = attendanceStats(r.student.id, attendance);
    if (attCell && att.rate !== null) {
      const color = att.rate >= 80 ? BRAND.green : att.rate >= 60 ? BRAND.amber : BRAND.red;
      const bg = att.rate >= 80 ? BRAND.greenLight : att.rate >= 60 ? BRAND.amberLight : BRAND.redLight;
      attCell.s = { ...attCell.s, fill: { fgColor: { rgb: bg } }, font: { ...attCell.s?.font, color: { rgb: color }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
  });
  XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');

  // === Sheet 3: Groups ===
  const groupHeaders = ['المجموعة', 'عدد الطلاب', 'متوسط اليوم', 'متوسط الكلي', 'مكتمل', 'جاري', 'متأخر'];
  const groupRows = [...groupReports].sort((a, b) => b.avgToday - a.avgToday).map((g) => [
    `مجموعة ${g.group}`, g.totalStudents, `${g.avgToday}%`, `${g.avgOverall}%`,
    g.completedToday, g.partialToday, g.lateToday,
  ]);
  const wsGroups = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupRows]);
  applyTableStyles(wsGroups, groupRows.length + 1, groupHeaders.length, 0);
  wsGroups['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsGroups, 'المجموعات');

  // === Sheet 4: Daily Trends ===
  const dayHeaders = ['اليوم', 'عدد المهام', 'إجمالي الإنجازات', 'أقصى إنجاز', 'معدل الإنجاز'];
  const dayRows = dayReports.map((d) => [
    d.day === currentDay ? `يوم ${d.day} (اليوم)` : `يوم ${d.day}`,
    d.totalTasks, d.totalCompletions, d.maxCompletions, `${d.completionRate}%`,
  ]);
  const wsDays = XLSX.utils.aoa_to_sheet([dayHeaders, ...dayRows]);
  applyTableStyles(wsDays, dayRows.length + 1, dayHeaders.length, 0);
  wsDays['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsDays, 'الاتجاهات اليومية');

  // === Sheet 5: Daily Breakdown per student ===
  const maxDay = dayReports.length;
  const breakdownHeaders = ['الترتيب', 'الاسم', 'المجموعة', ...Array.from({ length: maxDay }, (_, i) => `يوم ${i + 1}`)];
  const breakdownRows = rows.map((r) => {
    const dayCells: (string | number)[] = [];
    for (let d = 1; d <= maxDay; d++) {
      const bd = r.dailyBreakdown.find((x) => x.day === d);
      dayCells.push(bd ? `${bd.completed}/${bd.total}` : '—');
    }
    return [r.rank, r.student.name, r.student.group, ...dayCells];
  });
  const wsBreakdown = XLSX.utils.aoa_to_sheet([breakdownHeaders, ...breakdownRows]);
  applyTableStyles(wsBreakdown, breakdownRows.length + 1, breakdownHeaders.length, 0);
  wsBreakdown['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 10 }, ...Array.from({ length: maxDay }, () => ({ wch: 10 }))];
  XLSX.utils.book_append_sheet(wb, wsBreakdown, 'السجل اليومي');

  // === Sheet 6: Attendance ===
  const attHeaders = [
    'الاسم', 'المجموعة', 'إجمالي الأيام المسجّلة', 'حضر', 'متأخر', 'غائب', 'معذور', 'نسبة الحضور',
  ];
  const attRows = rows.map((r) => {
    const a = attendanceStats(r.student.id, attendance);
    return [
      r.student.name, r.student.group,
      a.total, a.present, a.late, a.absent, a.excused,
      a.rate !== null ? `${a.rate}%` : '—',
    ];
  });
  const wsAtt = XLSX.utils.aoa_to_sheet([attHeaders, ...attRows]);
  applyTableStyles(wsAtt, attRows.length + 1, attHeaders.length, 0);
  wsAtt['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
  // Color attendance rate (col 7)
  rows.forEach((r, i) => {
    const a = attendanceStats(r.student.id, attendance);
    if (a.rate === null) return;
    const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 7 });
    const cell = wsAtt[cellRef];
    if (cell) {
      const color = a.rate >= 80 ? BRAND.green : a.rate >= 60 ? BRAND.amber : BRAND.red;
      const bg = a.rate >= 80 ? BRAND.greenLight : a.rate >= 60 ? BRAND.amberLight : BRAND.redLight;
      cell.s = { ...cell.s, fill: { fgColor: { rgb: bg } }, font: { ...cell.s?.font, color: { rgb: color }, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
  });
  XLSX.utils.book_append_sheet(wb, wsAtt, 'سجل الحضور');

  // === Write file ===
  const filename = `${programName.replace(/\s+/g, '-')}-تقرير-يوم${currentDay}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
}

// === Styling helpers ===

function applySummaryStyles(ws: XLSX.WorkSheet, rowCount: number) {
  // Title row
  const titleCell = ws['A1'];
  if (titleCell) {
    titleCell.s = {
      font: { name: 'Tajawal', sz: 18, bold: true, color: { rgb: BRAND.brownDark } },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: BRAND.brownLight } },
    };
  }
  // Subtitle
  for (const ref of ['A2', 'A3']) {
    const cell = ws[ref];
    if (cell) {
      cell.s = {
        font: { name: 'Tajawal', sz: 12, color: { rgb: BRAND.gray } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  }
  // Header row (row 5: "المؤشر", "القيمة")
  for (let c = 0; c < 2; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 4, c });
    const cell = ws[cellRef];
    if (cell) {
      cell.s = {
        font: { name: 'Tajawal', sz: 12, bold: true, color: { rgb: BRAND.white } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: BRAND.brown } },
        border: thinBorder(),
      };
    }
  }
  // Data rows
  for (let r = 5; r < rowCount; r++) {
    for (let c = 0; c < 2; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (cell) {
        const isAlt = r % 2 === 0;
        cell.s = {
          font: { name: 'Tajawal', sz: 11, color: { rgb: BRAND.brownDark } },
          alignment: { horizontal: c === 0 ? 'right' : 'center', vertical: 'center' },
          fill: { fgColor: { rgb: isAlt ? BRAND.cream : BRAND.white } },
          border: thinBorder(),
        };
      }
    }
  }
}

function applyTableStyles(ws: XLSX.WorkSheet, rowCount: number, colCount: number, headerRow: number) {
  // Header row
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = ws[cellRef];
    if (cell) {
      cell.s = {
        font: { name: 'Tajawal', sz: 11, bold: true, color: { rgb: BRAND.white } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { fgColor: { rgb: BRAND.brown } },
        border: thinBorder(),
      };
    }
  }
  // Data rows
  for (let r = headerRow + 1; r < rowCount; r++) {
    const isAlt = (r - headerRow) % 2 === 0;
    for (let c = 0; c < colCount; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (cell) {
        cell.s = {
          font: { name: 'Tajawal', sz: 10, color: { rgb: BRAND.brownDark } },
          alignment: { horizontal: c <= 1 ? 'right' : 'center', vertical: 'center' },
          fill: { fgColor: { rgb: isAlt ? BRAND.cream : BRAND.white } },
          border: thinBorder(),
        };
      }
    }
  }
}

function thinBorder() {
  const b = { style: 'thin' as const, color: { rgb: BRAND.border } };
  return { top: b, bottom: b, left: b, right: b };
}
