/**
 * backupExcel.ts
 * تصدير نسخة احتياطية شاملة بهوية مُصلِح — Excel متعدد الشيتات
 *
 * الشيتات:
 *   1. الغلاف        — هوية مُصلِح + ملخص البيانات
 *   2. الطلاب        — بيانات كل طالب + إنجازه + حضوره
 *   3. الكادر        — المدراء والمشرفون
 *   4. المهام        — كل مهمة بتفاصيلها الكاملة
 *   5. سجلات الإنجاز — كل عملية إكمال مع التقييمات
 *   6. الحضور        — كل سجل حضور مفصّل
 *   7. ملخص الحضور  — نسبة حضور كل طالب
 *   8. قوائم الطلاب  — القوائم وأعضاؤها
 *   9. الإشعارات     — كل الإشعارات المرسلة
 *  10. الإعدادات     — إعدادات البرنامج
 */

import * as XLSX from 'xlsx';
import type { AppData, AttendanceStatus } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. BRAND PALETTE
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  // Browns — primary brand
  brownDeep:   '2C1A0E', // darkest, used in title text
  brownDark:   '4A2F1A', // dark text on light
  brown:       '7D5A3C', // main accent
  brownMid:    'A07850', // secondary accent
  brownLight:  'D4B896', // borders, dividers
  brownPale:   'F0E8DC', // alt row bg
  brownFaint:  'FAF6F0', // lightest fill

  // Neutrals
  white:       'FFFFFF',
  offWhite:    'FAFAF8',
  gray:        '6B6560',
  grayLight:   'E8E3DC',

  // Status colors
  green:       '2E6B44',
  greenMid:    '3D8A57',
  greenLight:  'DCF0E5',
  greenBorder: 'B0D9BF',

  amber:       '8B5E0A',
  amberMid:    'B07820',
  amberLight:  'FEF3DC',
  amberBorder: 'E8D090',

  red:         '8B2222',
  redMid:      'B03030',
  redLight:    'FEECEC',
  redBorder:   'E8AAAA',

  sky:         '1A5480',
  skyMid:      '2870A8',
  skyLight:    'DCF0FE',
  skyBorder:   'A8CFEA',

  purple:      '5C2E8A',
  purpleMid:   '7848B0',
  purpleLight: 'EEDDFF',
  purpleBorder:'C8AAEA',

  gold:        'B8860B',
  goldLight:   'FFF8DC',
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. STYLE PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

type BorderStyle = 'thin' | 'medium' | 'thick' | 'double';

function makeBorder(style: BorderStyle = 'thin', color = C.brownLight) {
  const side = { style, color: { rgb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

function makeCell(
  value: string | number | null | undefined,
  opts: {
    bold?: boolean;
    italic?: boolean;
    sz?: number;
    fg?: string;        // font color
    bg?: string;        // fill color
    align?: 'center' | 'left' | 'right';
    valign?: 'center' | 'top' | 'bottom';
    wrap?: boolean;
    border?: ReturnType<typeof makeBorder> | Record<string, never>;
    indent?: number;
  } = {},
): XLSX.CellObject {
  const v = value ?? '';
  const t: XLSX.ExcelDataType = typeof v === 'number' ? 'n' : 's';
  return {
    v,
    t,
    s: {
      font: {
        name: 'Arial',
        sz: opts.sz ?? 10,
        bold: opts.bold ?? false,
        italic: opts.italic ?? false,
        color: { rgb: opts.fg ?? C.brownDark },
      },
      fill: opts.bg ? { fgColor: { rgb: opts.bg } } : { fgColor: { rgb: C.white } },
      alignment: {
        horizontal: opts.align ?? 'center',
        vertical: opts.valign ?? 'center',
        wrapText: opts.wrap ?? false,
        indent: opts.indent,
        readingOrder: 2, // RTL
      },
      border: opts.border ?? makeBorder('thin'),
    },
  };
}

/** Column-header cell: brown bg, white bold text */
function colHeader(label: string, sz = 10): XLSX.CellObject {
  return makeCell(label, {
    bold: true, sz,
    fg: C.white, bg: C.brown,
    align: 'center',
    border: makeBorder('thin', C.brownDark),
  });
}

/** Section-header cell (spanning): deep brown bg, white large text */
function sectionHeader(label: string, sz = 12): XLSX.CellObject {
  return makeCell(label, {
    bold: true, sz,
    fg: C.white, bg: C.brownDeep,
    align: 'right',
    border: makeBorder('medium', C.brownDeep),
  });
}

/** Alternating row background */
function rowBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? C.offWhite : C.brownFaint;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WORKSHEET BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface ColDef {
  label: string;
  width: number;
  align?: 'center' | 'left' | 'right';
  wrap?: boolean;
}

interface RowCellOpts {
  fg?: string;
  bg?: string;
  bold?: boolean;
  italic?: boolean;
}

type CellColorizer = (
  rowIndex: number,        // 0-based data row
  colIndex: number,
  value: string | number | null | undefined,
) => RowCellOpts | null;

function buildDataSheet(
  cols: ColDef[],
  rows: (string | number | null | undefined)[][],
  colorizer?: CellColorizer,
  opts: { freezeHeader?: boolean; autoFilter?: boolean } = { freezeHeader: true, autoFilter: true },
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // Header row (row 0)
  cols.forEach((col, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = colHeader(col.label);
  });

  // Data rows
  rows.forEach((row, ri) => {
    const bg = rowBg(ri);
    row.forEach((val, ci) => {
      const col = cols[ci];
      const extra = colorizer ? colorizer(ri, ci, val) : null;
      ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = makeCell(val, {
        align: extra?.fg ? 'center' : (col?.align ?? (ci === 0 || ci === 1 ? 'right' : 'center')),
        wrap: col?.wrap ?? false,
        bg: extra?.bg ?? bg,
        fg: extra?.fg ?? C.brownDark,
        bold: extra?.bold ?? false,
        italic: extra?.italic ?? false,
      });
    });
  });

  // Sheet range
  const lastR = rows.length; // header is row 0, data starts at row 1
  const lastC = cols.length - 1;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: lastC } });

  // Column widths
  ws['!cols'] = cols.map((c) => ({ wch: c.width }));

  // Row heights: header taller
  ws['!rows'] = [
    { hpt: 28 }, // header
    ...Array(rows.length).fill({ hpt: 18 }),
  ];

  // Freeze top row
  if (opts.freezeHeader !== false) {
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  }

  // Auto-filter on header row
  if (opts.autoFilter !== false && rows.length > 0) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: lastC } }) };
  }

  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOMAIN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const ATT_LABELS: Record<AttendanceStatus, string> = {
  present: 'حاضر', late: 'متأخر', excused: 'معذور', absent: 'غائب',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  video: 'فيديو', pdf: 'PDF', memorization: 'حفظ',
  text: 'قراءة', link: 'رابط', audio: 'صوتي', quiz: 'اختبار',
};

function attSummary(studentId: string, attendance: AppData['attendance']) {
  const recs = (attendance ?? []).filter((a) => a.studentId === studentId);
  const present = recs.filter((a) => a.status === 'present').length;
  const late    = recs.filter((a) => a.status === 'late').length;
  const excused = recs.filter((a) => a.status === 'excused').length;
  const absent  = recs.filter((a) => a.status === 'absent').length;
  const rate    = recs.length > 0 ? Math.round(((present + late) / recs.length) * 100) : null;
  return { present, late, excused, absent, total: recs.length, rate };
}

function attColor(rate: number): RowCellOpts {
  if (rate >= 80) return { fg: C.green,  bg: C.greenLight,  bold: true };
  if (rate >= 60) return { fg: C.amber,  bg: C.amberLight,  bold: true };
  return             { fg: C.red,    bg: C.redLight,    bold: true };
}

function progColor(pct: number): RowCellOpts {
  if (pct >= 80) return { fg: C.green, bg: C.greenLight, bold: true };
  if (pct >= 50) return { fg: C.amber, bg: C.amberLight, bold: true };
  return             { fg: C.red,   bg: C.redLight,   bold: true };
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return iso; }
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('ar-SA')} ${d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. COVER SHEET
// ─────────────────────────────────────────────────────────────────────────────

function buildCover(data: AppData, exportedBy: string, exportedAt: Date): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  let r = 0;

  // ── Banner ──────────────────────────────────────────────────────────────────
  const banner = [
    '╔══════════════════════════════════════════════════════════╗',
    '║                                                          ║',
    '║                  مسابقة مُصلِح                           ║',
    '║                                                          ║',
    '║              نسخة احتياطية شاملة للبيانات               ║',
    '║                                                          ║',
    '╚══════════════════════════════════════════════════════════╝',
  ];
  banner.forEach((line) => {
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell(line, {
      sz: 13, bold: true, fg: C.white, bg: C.brownDeep,
      align: 'center', border: {},
    });
    merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
    r++;
  });

  // ── Spacer ──────────────────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('', { bg: C.brownFaint, border: {} });
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  // ── Info section header ──────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = sectionHeader('  معلومات التصدير', 11);
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  const infoRows: [string, string][] = [
    ['اسم البرنامج',  data.config.programName],
    ['تاريخ التصدير', exportedAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
    ['وقت التصدير',   exportedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
    ['صدّرها',        exportedBy],
    ['إصدار الملف',   'Mislah Backup v2.1 — Excel Edition'],
    ['بداية البرنامج', fmtDate(data.config.startDate)],
    ['مدة البرنامج',  `${data.config.totalDays} يوم`],
  ];
  infoRows.forEach(([label, value], i) => {
    const bg = i % 2 === 0 ? C.offWhite : C.brownFaint;
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('  ' + label, { bold: true, fg: C.brownDark, bg, align: 'right', sz: 11, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell(value, { fg: C.brownDeep, bg, align: 'right', sz: 11, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = makeCell('', { bg, border: makeBorder('thin') });
    r++;
  });

  // ── Spacer ──────────────────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('', { bg: C.brownFaint, border: {} });
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  // ── Stats section header ─────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = sectionHeader('  📊  ملخص البيانات المُصدَّرة', 11);
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  const totalCompleted = data.progress.filter((p) => p.status === 'completed').length;
  const attDays = [...new Set((data.attendance ?? []).map((a) => a.date))].length;
  const statsRows: [string, string | number, string][] = [
    ['الطلاب المسجّلون',      data.students.length,                'شيت "الطلاب"'],
    ['أفراد الكادر',           data.users.filter((u) => u.role !== 'student').length, 'شيت "الكادر"'],
    ['المهام الكلية',          data.tasks.length,                  'شيت "المهام"'],
    ['سجلات الإنجاز',         data.progress.length,               'شيت "سجلات الإنجاز"'],
    ['منها مكتمل',             totalCompleted,                     '—'],
    ['سجلات الحضور',          (data.attendance ?? []).length,      'شيت "الحضور"'],
    ['أيام الحضور المسجّلة',  attDays,                            '—'],
    ['الإشعارات',             data.notifications.length,          'شيت "الإشعارات"'],
    ['قوائم الطلاب',          (data.studentLists ?? []).length,   'شيت "قوائم الطلاب"'],
  ];
  statsRows.forEach(([label, value, note], i) => {
    const bg = i % 2 === 0 ? C.offWhite : C.brownFaint;
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('  ' + label, { bold: true, fg: C.brownDark, bg, align: 'right', sz: 11, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell(value, { bold: true, fg: C.brown, bg, align: 'center', sz: 13, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = makeCell(note, { italic: true, fg: C.gray, bg, align: 'center', sz: 9, border: makeBorder('thin') });
    r++;
  });

  // ── Spacer ──────────────────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('', { bg: C.brownFaint, border: {} });
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  // ── Notes section ────────────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = sectionHeader('  ملاحظات مهمة', 11);
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  const notes = [
    ['🔒 الأمان',      'هذا الملف يحتوي بيانات حساسة — احتفظ به في مكان آمن'],
    ['🔄 الاستعادة',   'لاستعادة البيانات: الإعدادات ← استعادة نسخة احتياطية (ملف JSON)'],
    ['📅 الصلاحية',    'هذا الملف للأرشفة والمراجعة — الاستعادة تتطلب ملف JSON'],
  ];
  notes.forEach(([label, text], i) => {
    const bg = i % 2 === 0 ? C.goldLight : C.amberLight;
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('  ' + label, { bold: true, fg: C.gold, bg, align: 'right', sz: 10, border: makeBorder('thin', C.amberBorder) });
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell(text, { fg: C.amber, bg, align: 'right', sz: 10, border: makeBorder('thin', C.amberBorder), wrap: true });
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = makeCell('', { bg, border: makeBorder('thin', C.amberBorder) });
    r++;
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 2 } });
  ws['!cols'] = [{ wch: 28 }, { wch: 40 }, { wch: 24 }];
  ws['!rows'] = Array(r).fill({ hpt: 22 });
  // Taller banner rows
  for (let i = 0; i < 7; i++) (ws['!rows'] as XLSX.RowInfo[])[i] = { hpt: 20 };
  ws['!merges'] = merges;

  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. INDIVIDUAL SHEETS
// ─────────────────────────────────────────────────────────────────────────────

function buildStudentsSheet(data: AppData): XLSX.WorkSheet {
  const studentUsers = data.users.filter((u) => u.role === 'student');

  const cols: ColDef[] = [
    { label: '#',               width: 5  },
    { label: 'الاسم',          width: 28, align: 'right' },
    { label: 'المجموعة',       width: 18, align: 'right' },
    { label: 'الهاتف',         width: 15 },
    { label: 'تيليجرام',       width: 16 },
    { label: 'اسم المستخدم',   width: 18 },
    { label: 'مهام مكتملة',    width: 14 },
    { label: 'إجمالي المهام',  width: 14 },
    { label: '% الإنجاز',      width: 11 },
    { label: 'حضر',            width: 7  },
    { label: 'متأخر',          width: 7  },
    { label: 'معذور',          width: 7  },
    { label: 'غائب',           width: 7  },
    { label: 'إجمالي الحضور',  width: 14 },
    { label: '% الحضور',       width: 11 },
  ];

  const rows = data.students.map((s, i) => {
    const user      = studentUsers.find((u) => u.studentId === s.id);
    const att       = attSummary(s.id, data.attendance);
    const progRecs  = data.progress.filter((p) => p.studentId === s.id);
    const completed = progRecs.filter((p) => p.status === 'completed').length;
    const total     = data.tasks.length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    const groups    = (s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group || '—';
    return [
      i + 1, s.name, groups, s.phone || '—', s.telegramHandle || '—',
      user?.username || '—',
      completed, total, `${pct}%`,
      att.present, att.late, att.excused, att.absent, att.total,
      att.rate !== null ? `${att.rate}%` : '—',
    ];
  });

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 8) {
      const pct = parseInt(String(val));
      if (!isNaN(pct)) return progColor(pct);
    }
    if (ci === 14) {
      const pct = parseInt(String(val));
      if (!isNaN(pct)) return attColor(pct);
    }
    if (ci === 1) return { align: 'right' } as RowCellOpts;
    return null;
  });
}

function buildStaffSheet(data: AppData): XLSX.WorkSheet {
  const cols: ColDef[] = [
    { label: '#',              width: 5  },
    { label: 'الاسم',         width: 28, align: 'right' },
    { label: 'الدور',         width: 12 },
    { label: 'اسم المستخدم',  width: 22 },
    { label: 'الحالة',        width: 10 },
  ];

  const rows = data.users
    .filter((u) => u.role !== 'student')
    .map((u, i) => [
      i + 1, u.name,
      u.role === 'admin' ? 'مدير' : 'مشرف',
      u.username,
      u.active ? 'نشط' : 'معطّل',
    ]);

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 2) {
      return val === 'مدير'
        ? { fg: C.purple, bg: C.purpleLight, bold: true }
        : { fg: C.sky,    bg: C.skyLight,    bold: true };
    }
    if (ci === 4) {
      return val === 'نشط'
        ? { fg: C.green, bg: C.greenLight, bold: true }
        : { fg: C.red,   bg: C.redLight,   bold: true };
    }
    return null;
  });
}

function buildTasksSheet(data: AppData): XLSX.WorkSheet {
  const TYPE_COLORS: Record<string, RowCellOpts> = {
    'فيديو':   { fg: C.red,    bg: C.redLight    },
    'PDF':     { fg: C.amber,  bg: C.amberLight  },
    'حفظ':    { fg: C.purple, bg: C.purpleLight  },
    'قراءة':  { fg: C.green,  bg: C.greenLight   },
    'رابط':   { fg: C.sky,    bg: C.skyLight     },
    'صوتي':   { fg: C.brownMid, bg: C.brownFaint },
    'اختبار': { fg: C.gold,   bg: C.goldLight    },
  };

  const cols: ColDef[] = [
    { label: '#',                   width: 5  },
    { label: 'اليوم',               width: 7  },
    { label: 'العنوان',             width: 36, align: 'right', wrap: true },
    { label: 'النوع',               width: 10 },
    { label: 'الوصف',               width: 40, align: 'right', wrap: true },
    { label: 'يتطلب تسليم',         width: 14 },
    { label: 'نوع التسليم',         width: 14 },
    { label: 'المجموعات المستهدفة', width: 22, align: 'right' },
    { label: 'طلاب محددون',         width: 14 },
    { label: 'الرابط',              width: 36, align: 'right', wrap: true },
  ];

  const rows = data.tasks.map((t, i) => {
    const submType: Record<string, string> = { audio: 'صوتي', text: 'نصي', link: 'رابط' };
    return [
      i + 1, t.day, t.title,
      TASK_TYPE_LABELS[t.type] || t.type,
      t.description || '—',
      t.requiresSubmission ? 'نعم' : 'لا',
      t.submissionType ? (submType[t.submissionType] || t.submissionType) : '—',
      (t.targetGroups ?? []).join('، ') || 'الكل',
      (t.targetStudentIds ?? []).length > 0 ? `${t.targetStudentIds!.length} طالب` : '—',
      t.url || '—',
    ];
  });

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 3) return TYPE_COLORS[String(val)] ?? null;
    if (ci === 6) return val === 'نعم' ? { fg: C.green, bg: C.greenLight, bold: true } : null;
    return null;
  });
}

function buildProgressSheet(data: AppData): XLSX.WorkSheet {
  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s.name]));
  const taskMap    = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
  const userMap    = Object.fromEntries(data.users.map((u) => [u.id, u.name]));

  const cols: ColDef[] = [
    { label: '#',               width: 6  },
    { label: 'الطالب',         width: 26, align: 'right' },
    { label: 'يوم',            width: 6  },
    { label: 'المهمة',         width: 32, align: 'right', wrap: true },
    { label: 'النوع',          width: 10 },
    { label: 'الحالة',         width: 10 },
    { label: 'تاريخ الإكمال',  width: 16 },
    { label: 'تقييم المشرف',   width: 14 },
    { label: 'ملاحظة المشرف',  width: 32, align: 'right', wrap: true },
    { label: 'ملاحظة التسليم', width: 28, align: 'right', wrap: true },
    { label: 'بأثر رجعي',     width: 11 },
    { label: 'قيّمه',          width: 18, align: 'right' },
  ];

  const STATUS_MAP: Record<string, { label: string; style: RowCellOpts }> = {
    completed: { label: 'مكتمل', style: { fg: C.green,  bg: C.greenLight,  bold: true } },
    partial:   { label: 'جاري',  style: { fg: C.amber,  bg: C.amberLight,  bold: true } },
    late:      { label: 'متأخر', style: { fg: C.red,    bg: C.redLight,    bold: true } },
    pending:   { label: 'متأخر', style: { fg: C.red,    bg: C.redLight,    bold: true } },
  };

  const rows = data.progress.map((p, i) => {
    const task    = taskMap[p.taskId];
    const status  = STATUS_MAP[p.status] ?? STATUS_MAP.pending;
    const raterName = p.supervisorRating !== undefined && p.ratedAt ? 'مشرف' : '—';
    return [
      i + 1,
      studentMap[p.studentId] || p.studentId,
      task?.day ?? '—',
      task?.title || p.taskId,
      TASK_TYPE_LABELS[task?.type ?? ''] || '—',
      status.label,
      fmtDate(p.completedAt),
      p.supervisorRating ?? '—',
      p.supervisorNote || '—',
      p.submissionNote || '—',
      p.isBackdated ? 'نعم' : 'لا',
      raterName,
    ];
  });

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 5) return STATUS_MAP[['completed','partial','late','pending'].find((k) => STATUS_MAP[k].label === val) ?? '']?.style ?? null;
    if (ci === 7 && val !== '—') {
      const v = Number(val);
      if (v >= 4) return { fg: C.green, bg: C.greenLight, bold: true };
      if (v >= 3) return { fg: C.amber, bg: C.amberLight, bold: true };
      if (!isNaN(v)) return { fg: C.red, bg: C.redLight, bold: true };
    }
    if (ci === 10 && val === 'نعم') return { fg: C.purple, bg: C.purpleLight, bold: true };
    return null;
  });
}

function buildAttendanceDetailSheet(data: AppData): XLSX.WorkSheet {
  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s.name]));

  const ATT_STYLE: Record<string, RowCellOpts> = {
    'حاضر':  { fg: C.green,  bg: C.greenLight,  bold: true },
    'متأخر': { fg: C.amber,  bg: C.amberLight,  bold: true },
    'معذور': { fg: C.sky,    bg: C.skyLight,    bold: true },
    'غائب':  { fg: C.red,    bg: C.redLight,    bold: true },
  };

  const cols: ColDef[] = [
    { label: '#',            width: 6  },
    { label: 'الطالب',      width: 26, align: 'right' },
    { label: 'المجموعة',    width: 14, align: 'right' },
    { label: 'التاريخ',     width: 14 },
    { label: 'اليوم',       width: 12 },
    { label: 'الجلسة',      width: 18, align: 'right' },
    { label: 'الحالة',      width: 10 },
    { label: 'تأخر (د)',    width: 10 },
    { label: 'السبب',       width: 30, align: 'right', wrap: true },
    { label: 'ملاحظة',     width: 26, align: 'right', wrap: true },
    { label: 'سجّله',       width: 18, align: 'right' },
    { label: 'وقت التسجيل', width: 20 },
  ];

  const studentGroupMap = Object.fromEntries(
    data.students.map((s) => [s.id, (s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group])
  );

  const rows = [...(data.attendance ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a, i) => {
      const weekday = (() => {
        try { return new Date(a.date + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'long' }); }
        catch { return '—'; }
      })();
      return [
        i + 1,
        studentMap[a.studentId] || a.studentId,
        studentGroupMap[a.studentId] || '—',
        a.date,
        weekday,
        a.sessionType || '—',
        ATT_LABELS[a.status as AttendanceStatus] || a.status,
        a.lateMinutes ?? '—',
        a.excuse || '—',
        a.note || '—',
        a.markedBy || '—',
        fmtDateTime(a.markedAt),
      ];
    });

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 6) return ATT_STYLE[String(val)] ?? null;
    if (ci === 7 && val !== '—') return { fg: C.amber, bg: C.amberLight, bold: true };
    return null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Matrix Export — students × dates grid with brand colours
// ─────────────────────────────────────────────────────────────────────────────

const ATT_CODE: Record<AttendanceStatus, string> = {
  present: 'م', absent: 'غ', excused: 'ب', late: 'ت',
};

const ATT_MATRIX_STYLE: Record<AttendanceStatus, RowCellOpts> = {
  present: { fg: C.green,  bg: C.greenLight,  bold: true },
  absent:  { fg: C.red,    bg: C.redLight,    bold: true },
  excused: { fg: C.sky,    bg: C.skyLight,    bold: true },
  late:    { fg: C.amber,  bg: C.amberLight,  bold: true },
};

const DAYS_AR_SHORT = ['أحد', 'اثنين', 'ثلا', 'أربع', 'خميس', 'جمعة', 'سبت'];

function buildAttendanceCoverSheet(
  data: AppData,
  exportedBy: string,
  dates: string[],
  mode: string,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  let r = 0;

  const banner = [
    '╔══════════════════════════════════════════════════════════╗',
    '║                                                          ║',
    '║           مسابقة مُصلِح  —  سجل الحضور                  ║',
    '║                                                          ║',
    '╚══════════════════════════════════════════════════════════╝',
  ];
  banner.forEach((line) => {
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell(line, { sz: 13, bold: true, fg: C.white, bg: C.brownDeep, align: 'center', border: {} });
    merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
    r++;
  });
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('', { bg: C.brownFaint, border: {} });
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  ws[XLSX.utils.encode_cell({ r, c: 0 })] = sectionHeader('  معلومات التصدير', 11);
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  const modeLabel = mode === 'today' ? 'يوم واحد' : mode === 'all' ? 'كامل السجل المُدخَل' : 'نطاق مخصص';
  const infoRows: [string, string | number][] = [
    ['اسم البرنامج',   data.config.programName],
    ['نطاق التصدير',   modeLabel],
    ['الفترة الزمنية', dates.length > 0 ? `${dates[0]} ← ${dates[dates.length - 1]}` : '—'],
    ['أيام مُصدَّرة',  dates.length],
    ['عدد الطلاب',     data.students.length],
    ['صدّره',          exportedBy],
    ['وقت التصدير',    new Date().toLocaleString('ar-SA')],
  ];
  infoRows.forEach(([label, value], i) => {
    const bg = i % 2 === 0 ? C.offWhite : C.brownFaint;
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('  ' + label, { bold: true, fg: C.brownDark, bg, align: 'right', sz: 11, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell(value, { fg: typeof value === 'number' ? C.brown : C.brownDeep, bold: typeof value === 'number', bg, align: typeof value === 'number' ? 'center' : 'right', sz: typeof value === 'number' ? 13 : 11, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = makeCell('', { bg, border: makeBorder('thin') });
    r++;
  });

  ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('', { bg: C.brownFaint, border: {} });
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  ws[XLSX.utils.encode_cell({ r, c: 0 })] = sectionHeader('  ملخص الحضور الكلي للفترة', 11);
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  r++;

  const allRecs = (data.attendance ?? []).filter((a) => dates.includes(a.date));
  const statRows: [string, number, RowCellOpts][] = [
    ['حضور (م)',     allRecs.filter((a) => a.status === 'present').length, { fg: C.green,  bg: C.greenLight,  bold: true }],
    ['غياب (غ)',    allRecs.filter((a) => a.status === 'absent').length,  { fg: C.red,    bg: C.redLight,    bold: true }],
    ['غياب مبرر (ب)', allRecs.filter((a) => a.status === 'excused').length, { fg: C.sky,  bg: C.skyLight,    bold: true }],
    ['تأخير (ت)',   allRecs.filter((a) => a.status === 'late').length,    { fg: C.amber,  bg: C.amberLight,  bold: true }],
  ];
  statRows.forEach(([label, value, style], i) => {
    const bg = i % 2 === 0 ? C.offWhite : C.brownFaint;
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('  ' + label, { bold: true, fg: C.brownDark, bg, align: 'right', sz: 11, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell(value, { ...style, align: 'center', sz: 14, border: makeBorder('thin') });
    ws[XLSX.utils.encode_cell({ r, c: 2 })] = makeCell('', { bg, border: makeBorder('thin') });
    r++;
  });

  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 2 } });
  ws['!cols']   = [{ wch: 28 }, { wch: 40 }, { wch: 10 }];
  ws['!rows']   = Array(r).fill({ hpt: 22 });
  for (let i = 0; i < 5; i++) (ws['!rows'] as XLSX.RowInfo[])[i] = { hpt: 20 };
  ws['!merges'] = merges;
  return ws;
}

// Full Arabic day names (JS getDay(): 0=Sun … 6=Sat)
const DAY_NAMES_AR_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function fmtDateDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildAttendanceMatrixSheet(
  data: AppData,
  orderedStudentIds: string[],
  dates: string[],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s]));
  const ordered = orderedStudentIds.map((id) => studentMap[id]).filter(Boolean);

  // Build indices
  const recIdx = new Map<string, Map<string, AttendanceStatus>>();
  const sessionForDate = new Map<string, string>();
  for (const rec of (data.attendance ?? [])) {
    if (!recIdx.has(rec.studentId)) recIdx.set(rec.studentId, new Map());
    recIdx.get(rec.studentId)!.set(rec.date, rec.status as AttendanceStatus);
    if (rec.session && !sessionForDate.has(rec.date)) sessionForDate.set(rec.date, rec.session);
  }

  const FIX  = 3;                        // # | اسم الطالب | اسم المدرس
  const SUM  = 5;                        // م | غ | ب | ت | %
  const COLS = FIX + dates.length + SUM;

  // ── Rows 0-1: Title (merged across everything) ────────────────────────────
  ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = makeCell(
    `سجل الحضور - ${data.config.programName}`,
    { bold: true, sz: 14, fg: C.white, bg: C.brownDeep, align: 'center', border: makeBorder('thin', C.brownDark) },
  );
  merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: COLS - 1 } });

  // ── Row 2: Fixed headers — span rows 2-4 ──────────────────────────────────
  const HDR = 2;
  const fixedHdrs = ['الرقم', 'اسم الطالب', 'اسم المدرس'];
  fixedHdrs.forEach((label, ci) => {
    ws[XLSX.utils.encode_cell({ r: HDR, c: ci })] = makeCell(
      label,
      { bold: true, sz: 10, fg: C.white, bg: C.brownMid, align: 'center', wrap: true, border: makeBorder('thin', C.brownDark) },
    );
    merges.push({ s: { r: HDR, c: ci }, e: { r: HDR + 2, c: ci } });
  });

  // ── Row 2: Summary headers — span rows 2-4 ───────────────────────────────
  const sumHdrs = [
    { label: 'إجمالي الحضور (م)', fg: C.white, bg: C.greenMid  },
    { label: 'إجمالي الغياب (غ)', fg: C.white, bg: C.redMid    },
    { label: 'غياب مبرر (ب)',     fg: C.white, bg: C.skyMid    },
    { label: 'إجمالي التأخير (ت)', fg: C.white, bg: C.amberMid },
    { label: 'نسبة الحضور',       fg: C.white, bg: C.brownMid  },
  ];
  sumHdrs.forEach((h, si) => {
    const c = FIX + dates.length + si;
    ws[XLSX.utils.encode_cell({ r: HDR, c })] = makeCell(
      h.label,
      { bold: true, sz: 9, fg: h.fg, bg: h.bg, align: 'center', wrap: true, border: makeBorder('thin', C.brownDark) },
    );
    merges.push({ s: { r: HDR, c }, e: { r: HDR + 2, c } });
  });

  // ── Rows 2-4: Date column 3-row headers (session / day / date) ────────────
  dates.forEach((date, di) => {
    const c   = FIX + di;
    const dow = new Date(date + 'T12:00:00').getDay();
    const session = sessionForDate.get(date) || '—';
    ws[XLSX.utils.encode_cell({ r: HDR,     c })] = makeCell(session,                { bold: true,  sz: 8, fg: C.white,      bg: C.brown,      align: 'center', wrap: true,  border: makeBorder('thin', C.brownDark)  });
    ws[XLSX.utils.encode_cell({ r: HDR + 1, c })] = makeCell(DAY_NAMES_AR_FULL[dow], { bold: true,  sz: 8, fg: C.white,      bg: C.brownMid,   align: 'center', border: makeBorder('thin', C.brownDark)  });
    ws[XLSX.utils.encode_cell({ r: HDR + 2, c })] = makeCell(fmtDateDMY(date),       { bold: false, sz: 8, fg: C.brownDark,  bg: C.brownFaint, align: 'center', border: makeBorder('thin', C.brownLight) });
  });

  // ── Rows 5+: Student data ─────────────────────────────────────────────────
  const DATA_R = HDR + 3;  // row 5
  ordered.forEach((s, ri) => {
    const rr   = DATA_R + ri;
    const sRec = recIdx.get(s.id) ?? new Map<string, AttendanceStatus>();
    const bg   = rowBg(ri);
    const grp  = (s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group || '';

    ws[XLSX.utils.encode_cell({ r: rr, c: 0 })] = makeCell(ri + 1, { bg, align: 'center', sz: 10,              border: makeBorder('thin', C.brownLight) });
    ws[XLSX.utils.encode_cell({ r: rr, c: 1 })] = makeCell(s.name, { bg, align: 'right',  sz: 10, bold: true,  border: makeBorder('thin', C.brownLight) });
    ws[XLSX.utils.encode_cell({ r: rr, c: 2 })] = makeCell(grp,    { bg, align: 'center', sz: 9,               border: makeBorder('thin', C.brownLight) });

    let present = 0, absent = 0, excused = 0, late = 0;
    dates.forEach((date, di) => {
      const c      = FIX + di;
      const status = sRec.get(date);
      if (status) {
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'excused') excused++;
        else if (status === 'late') late++;
        ws[XLSX.utils.encode_cell({ r: rr, c })] = makeCell(
          ATT_CODE[status],
          { ...ATT_MATRIX_STYLE[status], sz: 12, align: 'center', border: makeBorder('thin', C.brownLight) },
        );
      } else {
        // Empty cell for unrecorded dates (matching the template)
        ws[XLSX.utils.encode_cell({ r: rr, c })] = makeCell('', { bg, border: makeBorder('thin', C.brownLight) });
      }
    });

    const total = present + absent + excused + late;
    const pct   = total > 0 ? Math.round(((present + late) / total) * 100) : null;
    const pctStyle: RowCellOpts = pct === null ? { fg: C.gray, bg } :
      pct >= 80 ? { fg: C.green, bg: C.greenLight, bold: true } :
      pct >= 60 ? { fg: C.amber, bg: C.amberLight, bold: true } :
                  { fg: C.red,   bg: C.redLight,   bold: true };

    const b = FIX + dates.length;
    ws[XLSX.utils.encode_cell({ r: rr, c: b })]     = makeCell(present, { fg: C.green,  bg: C.greenLight,  bold: true, sz: 10, align: 'center', border: makeBorder('thin', C.greenBorder)  });
    ws[XLSX.utils.encode_cell({ r: rr, c: b + 1 })] = makeCell(absent,  { fg: C.red,    bg: C.redLight,    bold: true, sz: 10, align: 'center', border: makeBorder('thin', C.redBorder)    });
    ws[XLSX.utils.encode_cell({ r: rr, c: b + 2 })] = makeCell(excused, { fg: C.sky,    bg: C.skyLight,    bold: true, sz: 10, align: 'center', border: makeBorder('thin', C.skyBorder)    });
    ws[XLSX.utils.encode_cell({ r: rr, c: b + 3 })] = makeCell(late,    { fg: C.amber,  bg: C.amberLight,  bold: true, sz: 10, align: 'center', border: makeBorder('thin', C.amberBorder)  });
    ws[XLSX.utils.encode_cell({ r: rr, c: b + 4 })] = makeCell(
      pct !== null ? `${pct.toFixed(1)}%` : '',
      { ...pctStyle, sz: 10, align: 'center', border: makeBorder('thin', C.brownLight) },
    );
  });

  const lastR = DATA_R + ordered.length - 1;
  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = [
    { wch: 6 }, { wch: 24 }, { wch: 16 },
    ...dates.map(() => ({ wch: 11 })),
    { wch: 15 }, { wch: 15 }, { wch: 13 }, { wch: 15 }, { wch: 12 },
  ];
  ws['!rows'] = [
    { hpt: 26 }, { hpt: 26 },              // title (2 rows)
    { hpt: 36 }, { hpt: 22 }, { hpt: 20 }, // 3-row header
    ...Array(ordered.length).fill({ hpt: 20 }),
  ];
  // Freeze: 3 fixed cols + 5 header rows
  ws['!freeze'] = { xSplit: 3, ySplit: 5, topLeftCell: 'D6', activePane: 'bottomRight' };
  return ws;
}

function buildAttendanceNotesSheet(
  data: AppData,
  orderedStudentIds: string[],
  dates: string[],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s]));
  const COLS = 6;

  // ── Rows 0-1: Title ────────────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = makeCell(
    `سجل الملاحظات والأعذار - ${data.config.programName}`,
    { bold: true, sz: 13, fg: C.white, bg: C.brownDeep, align: 'center', border: makeBorder('thin', C.brownDark) },
  );
  merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: COLS - 1 } });

  // ── Row 2: Note for teacher ────────────────────────────────────────────────
  ws[XLSX.utils.encode_cell({ r: 2, c: 0 })] = makeCell(
    'ملاحظة للمدرس: يُرجى توثيق أسباب الغياب والتأخير في هذه الورقة مع ذكر التفاصيل.',
    { bold: false, sz: 9, fg: C.brownDark, bg: C.amberLight, align: 'right', wrap: true, border: makeBorder('thin', C.amberBorder) },
  );
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } });

  // ── Row 3: empty spacer ────────────────────────────────────────────────────
  for (let c = 0; c < COLS; c++) {
    ws[XLSX.utils.encode_cell({ r: 3, c })] = makeCell('', { bg: C.brownFaint, border: {} });
  }
  merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: COLS - 1 } });

  // ── Row 4: Column headers ──────────────────────────────────────────────────
  const hdrDefs = [
    { label: 'م الرقم',                              w: 7  },
    { label: 'اسم الطالب',                           w: 26 },
    { label: 'التاريخ واليوم',                       w: 20 },
    { label: 'نوع الحالة الاستثنائية',               w: 16 },
    { label: 'التفاصيل (دقائق التأخير / سبب العذر)', w: 40 },
    { label: 'اسم المدرس المتابع',                   w: 20 },
  ];
  hdrDefs.forEach(({ label }, ci) => {
    ws[XLSX.utils.encode_cell({ r: 4, c: ci })] = makeCell(
      label,
      { bold: true, sz: 10, fg: C.white, bg: C.brownMid, align: 'center', wrap: true, border: makeBorder('thin', C.brownDark) },
    );
  });

  // ── Rows 5+: Data ─────────────────────────────────────────────────────────
  const EXC_STYLE: Record<string, RowCellOpts> = {
    'تأخير':      { fg: C.amber, bg: C.amberLight, bold: true },
    'غياب مبرر': { fg: C.sky,   bg: C.skyLight,   bold: true },
    'غياب':      { fg: C.red,   bg: C.redLight,   bold: true },
  };

  let n = 1;
  let rr = 5;
  for (const sid of orderedStudentIds) {
    const s = studentMap[sid];
    const grp = s ? ((s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group || '') : '';
    const recs = (data.attendance ?? [])
      .filter((a) => a.studentId === sid && dates.includes(a.date) &&
        (a.status === 'late' || a.status === 'excused' || a.status === 'absent'))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const rec of recs) {
      const bg      = rowBg(n - 1);
      const dow     = new Date(rec.date + 'T12:00:00').getDay();
      const dateDay = `${fmtDateDMY(rec.date)} — ${DAY_NAMES_AR_FULL[dow]}`;
      const type    = rec.status === 'late' ? 'تأخير' : rec.status === 'excused' ? 'غياب مبرر' : 'غياب';
      const detail  = rec.status === 'late'
        ? (rec.lateMinutes ? `${rec.lateMinutes} دقيقة` : '')
        : (rec.excuse || '');

      ws[XLSX.utils.encode_cell({ r: rr, c: 0 })] = makeCell(n,       { bg, align: 'center', sz: 10, border: makeBorder('thin', C.brownLight) });
      ws[XLSX.utils.encode_cell({ r: rr, c: 1 })] = makeCell(s?.name ?? sid, { bg, align: 'right', sz: 10, bold: true, border: makeBorder('thin', C.brownLight) });
      ws[XLSX.utils.encode_cell({ r: rr, c: 2 })] = makeCell(dateDay, { bg, align: 'center', sz: 9, border: makeBorder('thin', C.brownLight) });
      ws[XLSX.utils.encode_cell({ r: rr, c: 3 })] = makeCell(type,    { ...EXC_STYLE[type], sz: 10, align: 'center', border: makeBorder('thin', C.brownLight) });
      ws[XLSX.utils.encode_cell({ r: rr, c: 4 })] = makeCell(detail,  { bg, align: 'right', sz: 9, wrap: true, border: makeBorder('thin', C.brownLight) });
      ws[XLSX.utils.encode_cell({ r: rr, c: 5 })] = makeCell(grp,     { bg, align: 'center', sz: 9, border: makeBorder('thin', C.brownLight) });
      n++; rr++;
    }
  }

  // Fill remaining rows up to 1000 (like the template) if no exceptions
  const endR = Math.max(rr - 1, 4);
  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: endR, c: COLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = hdrDefs.map(({ w }) => ({ wch: w }));
  ws['!rows']   = [
    { hpt: 26 }, { hpt: 26 }, // title
    { hpt: 22 }, { hpt: 8 },  // note + spacer
    { hpt: 30 },               // header
    ...Array(Math.max(rr - 5, 0)).fill({ hpt: 20 }),
  ];
  return ws;
}

export function exportAttendanceMatrixExcel(
  data: AppData,
  orderedStudentIds: string[],
  exportedBy: string,
  mode: 'today' | 'all' | 'range',
  dateFrom: string,
  dateTo: string,
): void {
  const allRecordedDates = [...new Set((data.attendance ?? []).map((r) => r.date))].sort();
  const dates =
    mode === 'today' ? [dateFrom] :
    mode === 'all'   ? allRecordedDates :
    allRecordedDates.filter((d) => d >= dateFrom && d <= dateTo);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAttendanceMatrixSheet(data, orderedStudentIds, dates), 'سجل الحضور العام');
  XLSX.utils.book_append_sheet(wb, buildAttendanceNotesSheet(data, orderedStudentIds, dates), 'سجل الملاحظات والأعذار');

  const stamp = mode === 'today' ? dateFrom.replace(/-/g, '') : mode === 'all' ? 'كامل' : `${dateFrom.replace(/-/g, '')}-${dateTo.replace(/-/g, '')}`;
  XLSX.writeFile(wb, `سجل الحضور - ${data.config.programName} - ${stamp}.xlsx`, { bookType: 'xlsx', type: 'binary' });
}

function buildAttSummarySheet(data: AppData): XLSX.WorkSheet {
  const cols: ColDef[] = [
    { label: '#',              width: 5  },
    { label: 'الاسم',         width: 26, align: 'right' },
    { label: 'المجموعة',      width: 18, align: 'right' },
    { label: 'حضر',           width: 7  },
    { label: 'متأخر',         width: 7  },
    { label: 'معذور',         width: 7  },
    { label: 'غائب',          width: 7  },
    { label: 'إجمالي الأيام', width: 14 },
    { label: '% الحضور',      width: 11 },
  ];

  const rows = data.students.map((s, i) => {
    const a = attSummary(s.id, data.attendance);
    const groups = (s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group || '—';
    return [
      i + 1, s.name, groups,
      a.present, a.late, a.excused, a.absent, a.total,
      a.rate !== null ? `${a.rate}%` : '—',
    ];
  });

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 8 && val !== '—') {
      const pct = parseInt(String(val));
      if (!isNaN(pct)) return attColor(pct);
    }
    return null;
  });
}

function buildStudentListsSheet(data: AppData): XLSX.WorkSheet {
  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s.name]));

  const cols: ColDef[] = [
    { label: 'رقم القائمة',  width: 13 },
    { label: 'اسم القائمة',  width: 30, align: 'right' },
    { label: 'عدد الأعضاء',  width: 13 },
    { label: 'رقم الطالب',   width: 11 },
    { label: 'اسم الطالب',   width: 28, align: 'right' },
  ];

  const rows: (string | number)[][] = [];
  (data.studentLists ?? []).forEach((list, li) => {
    list.studentIds.forEach((sid, si) => {
      rows.push([
        li + 1,
        list.name,
        list.studentIds.length,
        si + 1,
        studentMap[sid] || sid,
      ]);
    });
    // If empty list, show a placeholder row
    if (list.studentIds.length === 0) {
      rows.push([li + 1, list.name, 0, '—', '(قائمة فارغة)']);
    }
  });

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 2) return { fg: C.brownMid, bold: true };
    return null;
  });
}

function buildNotificationsSheet(data: AppData): XLSX.WorkSheet {
  const ROLE_LABELS: Record<string, string> = {
    all: 'الجميع', student: 'الطلاب', supervisor: 'المشرفون',
  };

  const cols: ColDef[] = [
    { label: '#',            width: 5  },
    { label: 'العنوان',      width: 32, align: 'right', wrap: true },
    { label: 'المحتوى',      width: 50, align: 'right', wrap: true },
    { label: 'الموجَّه إلى', width: 14 },
    { label: 'أرسله',        width: 20, align: 'right' },
    { label: 'التاريخ',      width: 16 },
  ];

  const rows = data.notifications.map((n, i) => [
    i + 1, n.title, n.body || '—',
    ROLE_LABELS[n.targetRole] || n.targetRole,
    n.createdBy || '—',
    fmtDate(n.createdAt),
  ]);

  return buildDataSheet(cols, rows, (ri, ci, val) => {
    if (ci === 3) {
      if (val === 'الجميع')     return { fg: C.brown,  bg: C.brownFaint, bold: true };
      if (val === 'الطلاب')     return { fg: C.green,  bg: C.greenLight, bold: true };
      if (val === 'المشرفون')   return { fg: C.sky,    bg: C.skyLight,   bold: true };
    }
    return null;
  });
}

function buildSettingsSheet(data: AppData, exportedAt: Date): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const startDate = new Date(data.config.startDate);
  const endDate   = new Date(startDate);
  endDate.setDate(endDate.getDate() + data.config.totalDays - 1);

  const sections: { header: string; rows: [string, string | number][] }[] = [
    {
      header: 'إعدادات البرنامج',
      rows: [
        ['اسم البرنامج',       data.config.programName],
        ['تاريخ البداية',      startDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })],
        ['تاريخ الانتهاء',     endDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })],
        ['عدد الأيام الكلي',   data.config.totalDays],
      ],
    },
    {
      header: 'إحصائيات البيانات',
      rows: [
        ['عدد الطلاب',         data.students.length],
        ['عدد الكادر',         data.users.filter((u) => u.role !== 'student').length],
        ['عدد المدراء',        data.users.filter((u) => u.role === 'admin').length],
        ['عدد المشرفين',       data.users.filter((u) => u.role === 'supervisor').length],
        ['عدد المهام',         data.tasks.length],
        ['سجلات الإنجاز',      data.progress.length],
        ['الإنجازات المكتملة', data.progress.filter((p) => p.status === 'completed').length],
        ['سجلات الحضور',       (data.attendance ?? []).length],
        ['الإشعارات',          data.notifications.length],
        ['قوائم الطلاب',       (data.studentLists ?? []).length],
      ],
    },
    {
      header: 'معلومات التصدير',
      rows: [
        ['تاريخ التصدير', exportedAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
        ['وقت التصدير',   exportedAt.toLocaleTimeString('ar-SA')],
        ['إصدار الملف',   'Mislah Backup v2.1'],
      ],
    },
  ];

  let r = 0;
  sections.forEach((section) => {
    // Section header
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = sectionHeader(`  ${section.header}`, 11);
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell('', { bg: C.brownDeep, border: makeBorder('medium', C.brownDeep) });
    r++;

    section.rows.forEach(([label, value], i) => {
      const bg = i % 2 === 0 ? C.offWhite : C.brownFaint;
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('  ' + label, { bold: true, fg: C.brownDark, bg, align: 'right', sz: 11, border: makeBorder('thin') });
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell(value, {
        fg: typeof value === 'number' ? C.brown : C.brownDeep,
        bold: typeof value === 'number',
        bg, align: typeof value === 'number' ? 'center' : 'right',
        sz: typeof value === 'number' ? 13 : 11,
        border: makeBorder('thin'),
      });
      r++;
    });

    // Spacer
    ws[XLSX.utils.encode_cell({ r, c: 0 })] = makeCell('', { bg: C.brownFaint, border: {} });
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = makeCell('', { bg: C.brownFaint, border: {} });
    r++;
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 1 } });
  ws['!cols'] = [{ wch: 30 }, { wch: 48 }];
  ws['!rows'] = Array(r).fill({ hpt: 22 });

  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function exportBackupExcel(data: AppData, exportedBy: string): void {
  const exportedAt = new Date();
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildCover(data, exportedBy, exportedAt), 'الغلاف');
  XLSX.utils.book_append_sheet(wb, buildStudentsSheet(data),                  'الطلاب');
  XLSX.utils.book_append_sheet(wb, buildStaffSheet(data),                     'الكادر');
  XLSX.utils.book_append_sheet(wb, buildTasksSheet(data),                     'المهام');
  XLSX.utils.book_append_sheet(wb, buildProgressSheet(data),                  'سجلات الإنجاز');
  XLSX.utils.book_append_sheet(wb, buildAttendanceDetailSheet(data),          'الحضور');
  XLSX.utils.book_append_sheet(wb, buildAttSummarySheet(data),                'ملخص الحضور');

  if ((data.studentLists ?? []).length > 0) {
    XLSX.utils.book_append_sheet(wb, buildStudentListsSheet(data), 'قوائم الطلاب');
  }
  if (data.notifications.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildNotificationsSheet(data), 'الإشعارات');
  }

  XLSX.utils.book_append_sheet(wb, buildSettingsSheet(data, exportedAt), 'الإعدادات');

  // File name
  const stamp   = `${exportedAt.getFullYear()}-${String(exportedAt.getMonth() + 1).padStart(2, '0')}-${String(exportedAt.getDate()).padStart(2, '0')}`;
  const safeName = data.config.programName.replace(/[^\u0600-\u06FF\w]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `مصلح-${safeName}-${stamp}.xlsx`, { bookType: 'xlsx', type: 'binary' });
}
