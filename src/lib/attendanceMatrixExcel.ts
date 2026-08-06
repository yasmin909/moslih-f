/**
 * attendanceMatrixExcel.ts
 * تصدير سجل الحضور — xlsx-js-style للألوان + fflate لحقن RTL والـdropdowns
 */

import * as XLSX from 'xlsx-js-style';
import { unzipSync, strToU8, zipSync } from 'fflate';
import type { AppData, AttendanceStatus } from './types';

// ─── الألوان (ARGB بدون الـ#) ──────────────────────────────────────────────
const C = {
  hdrDeep:  '3E2723',  // عنوان رئيسي
  hdrDark:  '4E342E',  // رأس الجلسة
  hdrMid:   '795548',  // رأس اليوم
  hdrLight: 'D7CCC8',  // رأس التاريخ
  white:    'FFFFFF',
  dateText: '3E2723',

  rowEven:  'FFFFFF',
  rowOdd:   'FAF6F1',
  border:   'D4B896',
  borderDk: '6D4C41',
  text:     '3E2723',
  textGray: '8D6E63',

  pBg: 'E8F5E9', pFg: '1B5E20',  // حاضر
  aBg: 'FFEBEE', aFg: 'B71C1C',  // غائب
  eBg: 'E3F2FD', eFg: '0D47A1',  // معذور
  lBg: 'FFF8E1', lFg: 'F57F17',  // متأخر

  sumPBg: '2E7D32', sumGBg: 'C62828',
  sumEBg: '1565C0', sumLBg: 'F9A825',
  sumRBg: '4E342E',
};

type BS = XLSX.CellStyle['border'];

function bdr(style: 'thin' | 'medium' = 'thin', color = C.border): BS {
  const s = { style, color: { rgb: color } };
  return { top: s, bottom: s, left: s, right: s };
}

function cell(
  v: string | number | null | undefined,
  o: {
    bold?: boolean; sz?: number; fg?: string; bg?: string;
    align?: 'center' | 'left' | 'right'; wrap?: boolean;
    border?: BS;
  } = {},
): XLSX.CellObject {
  return {
    v: v ?? '',
    t: typeof v === 'number' ? 'n' : 's',
    s: {
      font:      { name: 'Arial', sz: o.sz ?? 10, bold: o.bold ?? false, color: { rgb: o.fg ?? C.text } },
      fill:      { fgColor: { rgb: o.bg ?? C.white } },
      alignment: { horizontal: o.align ?? 'center', vertical: 'center', wrapText: o.wrap ?? false, readingOrder: 2 },
      border:    o.border ?? bdr('thin'),
    } as XLSX.CellStyle,
  };
}

function hdr(v: string, bg: string, fg = C.white, sz = 10): XLSX.CellObject {
  return cell(v, { bold: true, sz, fg, bg, align: 'center', wrap: true, border: bdr('medium', C.borderDk) });
}

const DAY_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function fmtDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function enc(r: number, c: number) { return XLSX.utils.encode_cell({ r, c }); }

const STATUS: Record<AttendanceStatus, { bg: string; fg: string; code: string; sumBg: string }> = {
  present: { bg: C.pBg, fg: C.pFg, code: 'م', sumBg: C.sumPBg },
  absent:  { bg: C.aBg, fg: C.aFg, code: 'غ', sumBg: C.sumGBg },
  excused: { bg: C.eBg, fg: C.eFg, code: 'ب', sumBg: C.sumEBg },
  late:    { bg: C.lBg, fg: C.lFg, code: 'ت', sumBg: C.sumLBg },
};

// ─── بناء ورقة الحضور الشبكي ──────────────────────────────────────────────
function buildMatrixSheet(
  data: AppData,
  orderedStudentIds: string[],
  dates: string[],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s]));
  const ordered    = orderedStudentIds.map((id) => studentMap[id]).filter(Boolean);

  const recIdx    = new Map<string, Map<string, AttendanceStatus>>();
  const sessionOf = new Map<string, string>();
  for (const rec of (data.attendance ?? [])) {
    if (!recIdx.has(rec.studentId)) recIdx.set(rec.studentId, new Map());
    recIdx.get(rec.studentId)!.set(rec.date, rec.status as AttendanceStatus);
    if (rec.sessionType && !sessionOf.has(rec.date)) sessionOf.set(rec.date, rec.sessionType);
  }

  const FIX  = 3;
  const SUM  = 5;
  const DCOL = FIX + dates.length;
  const TCOL = DCOL + SUM;

  // ── صفان للعنوان (rows 0-1) ────────────────────────────────────────────────
  ws[enc(0, 0)] = hdr(`سجل الحضور - ${data.config.programName}`, C.hdrDeep, C.white, 14);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: TCOL - 1 } });

  // ── رؤوس الأعمدة (rows 2-4) ────────────────────────────────────────────────
  // الأعمدة الثابتة — merged على 3 صفوف
  ['الرقم', 'اسم الطالب', 'اسم المدرس'].forEach((label, ci) => {
    ws[enc(2, ci)] = hdr(label, C.hdrDark);
    merges.push({ s: { r: 2, c: ci }, e: { r: 4, c: ci } });
  });

  // أعمدة التواريخ — 3 صفوف (جلسة / يوم / تاريخ)
  dates.forEach((date, di) => {
    const c   = FIX + di;
    const dow = new Date(date + 'T12:00:00').getDay();
    ws[enc(2, c)] = hdr(sessionOf.get(date) || '—', C.hdrDark, C.white, 9);
    ws[enc(3, c)] = hdr(DAY_AR[dow],                C.hdrMid,  C.white, 9);
    ws[enc(4, c)] = hdr(fmtDMY(date),               C.hdrLight, C.dateText, 9);
  });

  // أعمدة الإجمالي — merged على 3 صفوف
  const sumDefs: { label: string; bg: string; fg?: string }[] = [
    { label: 'إجمالي الحضور (م)',  bg: C.sumPBg },
    { label: 'إجمالي الغياب (غ)',  bg: C.sumGBg },
    { label: 'غياب مبرر (ب)',      bg: C.sumEBg },
    { label: 'إجمالي التأخير (ت)', bg: C.sumLBg, fg: C.text },
    { label: 'نسبة الحضور',        bg: C.sumRBg },
  ];
  sumDefs.forEach(({ label, bg, fg }, si) => {
    const c = DCOL + si;
    ws[enc(2, c)] = hdr(label, bg, fg ?? C.white, 9);
    merges.push({ s: { r: 2, c }, e: { r: 4, c } });
  });

  // ── بيانات الطلاب (row 5+) ─────────────────────────────────────────────────
  const DATA_R = 5;

  ordered.forEach((s, ri) => {
    const r    = DATA_R + ri;
    const bg   = ri % 2 === 0 ? C.rowEven : C.rowOdd;
    const sRec = recIdx.get(s.id) ?? new Map<string, AttendanceStatus>();
    const grp  = (s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group || 'غير محدد';

    ws[enc(r, 0)] = cell(ri + 1, { bg, align: 'center' });
    ws[enc(r, 1)] = cell(s.name, { bg, align: 'right', bold: true });
    ws[enc(r, 2)] = cell(grp,    { bg, align: 'center', sz: 9 });

    let present = 0, absent = 0, excused = 0, late = 0;

    dates.forEach((date, di) => {
      const c      = FIX + di;
      const status = sRec.get(date);
      if (status) {
        const st = STATUS[status];
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'excused') excused++;
        else if (status === 'late') late++;
        ws[enc(r, c)] = cell(st.code, { bg: st.bg, fg: st.fg, bold: true, sz: 12 });
      } else {
        ws[enc(r, c)] = cell('', { bg });
      }
    });

    const total = present + absent + excused + late;
    const pct   = total > 0 ? ((present + late) / total) * 100 : null;
    const pctSt = pct === null ? { bg, fg: C.textGray }
      : pct >= 80 ? { bg: C.pBg, fg: C.pFg }
      : pct >= 60 ? { bg: C.lBg, fg: C.lFg }
      :             { bg: C.aBg, fg: C.aFg };

    ws[enc(r, DCOL    )] = cell(present, { bg: C.pBg, fg: C.pFg, bold: true });
    ws[enc(r, DCOL + 1)] = cell(absent,  { bg: C.aBg, fg: C.aFg, bold: true });
    ws[enc(r, DCOL + 2)] = cell(excused, { bg: C.eBg, fg: C.eFg, bold: true });
    ws[enc(r, DCOL + 3)] = cell(late,    { bg: C.lBg, fg: C.lFg, bold: true });
    ws[enc(r, DCOL + 4)] = cell(
      pct !== null ? `${pct.toFixed(1)}%` : '',
      { ...pctSt, bold: pct !== null },
    );
  });

  // ── صف الإجماليات اليومية ─────────────────────────────────────────────────
  const TOT_R = DATA_R + ordered.length;
  ws[enc(TOT_R, 0)] = hdr('إجمالي الحاضرين اليومي', C.hdrDark, C.white, 10);
  merges.push({ s: { r: TOT_R, c: 0 }, e: { r: TOT_R, c: FIX - 1 } });

  dates.forEach((date, di) => {
    const c     = FIX + di;
    const count = (data.attendance ?? []).filter(
      (a) => a.date === date && (a.status === 'present' || a.status === 'late')
    ).length;
    ws[enc(TOT_R, c)] = cell(count, { bg: C.pBg, fg: C.pFg, bold: true, sz: 11, border: bdr('medium', C.borderDk) });
  });

  for (let si = 0; si < SUM; si++) {
    ws[enc(TOT_R, DCOL + si)] = cell('', { bg: C.hdrLight, border: bdr('medium', C.borderDk) });
  }

  // ── إعدادات الورقة ────────────────────────────────────────────────────────
  const lastR = TOT_R;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastR, c: TCOL - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 7 }, { wch: 25 }, { wch: 17 },
    ...dates.map(() => ({ wch: 12 })),
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 13 },
  ];
  ws['!rows'] = [
    { hpt: 28 }, { hpt: 28 },
    { hpt: 38 }, { hpt: 22 }, { hpt: 20 },
    ...Array(ordered.length).fill({ hpt: 20 }),
    { hpt: 22 },
  ];
  // تجميد — 3 أعمدة + 5 صفوف
  ws['!freeze'] = { xSplit: FIX, ySplit: 5, topLeftCell: enc(5, FIX), activePane: 'bottomRight' };

  return ws;
}

// ─── بناء ورقة الملاحظات ──────────────────────────────────────────────────
function buildNotesSheet(
  data: AppData,
  orderedStudentIds: string[],
  dates: string[],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  const studentMap = Object.fromEntries(data.students.map((s) => [s.id, s]));
  const NCOLS = 6;

  ws[enc(0, 0)] = hdr(`سجل الملاحظات والأعذار - ${data.config.programName}`, C.hdrDeep, C.white, 13);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: NCOLS - 1 } });

  ws[enc(2, 0)] = cell('ملاحظة للمدرس: يُرجى توثيق أسباب الغياب والتأخير مع ذكر التفاصيل.', {
    bg: C.lBg, fg: C.lFg, sz: 9, align: 'right', wrap: true, border: bdr('thin', C.lFg),
  });
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: NCOLS - 1 } });

  ['م', 'اسم الطالب', 'التاريخ واليوم', 'نوع الحالة', 'التفاصيل', 'اسم المدرس'].forEach((label, ci) => {
    ws[enc(3, ci)] = hdr(label, C.hdrDark);
  });

  const EXC: Record<string, { bg: string; fg: string }> = {
    'تأخير':      { bg: C.lBg, fg: C.lFg },
    'غياب مبرر': { bg: C.eBg, fg: C.eFg },
    'غياب':      { bg: C.aBg, fg: C.aFg },
  };

  let n = 1, rr = 4;
  for (const sid of orderedStudentIds) {
    const s   = studentMap[sid];
    const grp = s ? ((s.groups ?? [s.group]).filter(Boolean).join('، ') || s.group || 'غير محدد') : 'غير محدد';
    const recs = (data.attendance ?? [])
      .filter((a) => a.studentId === sid && dates.includes(a.date) &&
        (a.status === 'late' || a.status === 'excused' || a.status === 'absent'))
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const rec of recs) {
      const bg      = n % 2 === 0 ? C.rowOdd : C.rowEven;
      const dow     = new Date(rec.date + 'T12:00:00').getDay();
      const dateDay = `${fmtDMY(rec.date)} — ${DAY_AR[dow]}`;
      const type    = rec.status === 'late' ? 'تأخير' : rec.status === 'excused' ? 'غياب مبرر' : 'غياب';
      const detail  = rec.status === 'late' ? (rec.lateMinutes ? `${rec.lateMinutes} دقيقة` : '') : (rec.excuse || '');
      const exc     = EXC[type];

      ws[enc(rr, 0)] = cell(n,            { bg, align: 'center' });
      ws[enc(rr, 1)] = cell(s?.name ?? sid, { bg, align: 'right', bold: true });
      ws[enc(rr, 2)] = cell(dateDay,      { bg, align: 'center', sz: 9 });
      ws[enc(rr, 3)] = cell(type,         { bg: exc.bg, fg: exc.fg, bold: true, align: 'center' });
      ws[enc(rr, 4)] = cell(detail,       { bg, align: 'right', sz: 9, wrap: true });
      ws[enc(rr, 5)] = cell(grp,          { bg, align: 'center', sz: 9 });
      n++; rr++;
    }
  }

  const endR = Math.max(rr - 1, 3);
  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: endR, c: NCOLS - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = [{ wch: 7 }, { wch: 27 }, { wch: 22 }, { wch: 17 }, { wch: 42 }, { wch: 22 }];
  ws['!rows']   = [{ hpt: 28 }, { hpt: 28 }, { hpt: 22 }, { hpt: 30 }, ...Array(Math.max(rr - 4, 0)).fill({ hpt: 20 })];

  return ws;
}

// ─── حقن RTL + data validation في XML مباشرة ─────────────────────────────
function injectXlsxFeatures(
  buf: Uint8Array,
  sheetIndices: number[],           // أرقام الأوراق المطلوب تعديلها (0-based)
  dvRanges: Record<number, string>, // { sheetIndex: 'D6:Z1000' } لأعمدة الـdropdown
  freezeBySheet: Record<number, { xSplit: number; ySplit: number; topLeft: string }>,
): Uint8Array {
  const zip  = unzipSync(buf);
  const enc8 = (s: string) => strToU8(s);

  sheetIndices.forEach((sheetIdx) => {
    const key = `xl/worksheets/sheet${sheetIdx + 1}.xml`;
    if (!zip[key]) return;

    let xml = new TextDecoder().decode(zip[key]);

    // 1. إضافة / تعديل sheetView ليشمل rightToLeft + freeze
    const freeze = freezeBySheet[sheetIdx];
    const paneXml = freeze
      ? `<pane xSplit="${freeze.xSplit}" ySplit="${freeze.ySplit}" topLeftCell="${freeze.topLeft}" activePane="bottomRight" state="frozen"/>`
      : '';

    const sheetViewXml = `<sheetView tabSelected="${sheetIdx === 0 ? 1 : 0}" rightToLeft="1" workbookViewId="0">${paneXml}</sheetView>`;

    if (xml.includes('<sheetViews>')) {
      // استبدل أي sheetView موجود
      xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, `<sheetViews>${sheetViewXml}</sheetViews>`);
    } else if (xml.includes('<sheetData>')) {
      xml = xml.replace('<sheetData>', `<sheetViews>${sheetViewXml}</sheetViews><sheetData>`);
    }

    // 2. حذف freezePane القديمة إن وجدت (بعد ما أضفنا الجديدة)
    // (تم تضمينها في الـsheetView أعلاه)

    // 3. إضافة dataValidations قبل نهاية الورقة
    const dvRange = dvRanges[sheetIdx];
    if (dvRange) {
      const dvXml = `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showDropDown="0" sqref="${dvRange}"><formula1>"م,ب,غ,ت"</formula1></dataValidation></dataValidations>`;
      if (xml.includes('</worksheet>')) {
        xml = xml.replace('</worksheet>', `${dvXml}</worksheet>`);
      }
    }

    zip[key] = enc8(xml);
  });

  return zipSync(zip, { level: 6 });
}

// ─── الدالة المُصدَّرة ────────────────────────────────────────────────────────
export async function exportAttendanceMatrixExcel(
  data: AppData,
  orderedStudentIds: string[],
  _exportedBy: string,
  mode: 'today' | 'all' | 'range',
  dateFrom: string,
  dateTo: string,
): Promise<void> {
  const allDates = [...new Set((data.attendance ?? []).map((r) => r.date))].sort();
  const dates =
    mode === 'today' ? [dateFrom] :
    mode === 'all'   ? allDates :
    allDates.filter((d) => d >= dateFrom && d <= dateTo);

  const wb = XLSX.utils.book_new();
  const ws1 = buildMatrixSheet(data, orderedStudentIds, dates);
  const ws2 = buildNotesSheet(data, orderedStudentIds, dates);
  XLSX.utils.book_append_sheet(wb, ws1, 'سجل الحضور العام');
  XLSX.utils.book_append_sheet(wb, ws2, 'سجل الملاحظات والأعذار');

  // اكتب إلى buffer
  const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const buf = new Uint8Array(raw);

  // حقن RTL + dropdowns في XML
  const FIX      = 3;
  const DATA_ROW = 6;                         // الصف الأول للبيانات (Excel 1-based)
  const LAST_ROW = DATA_ROW + orderedStudentIds.length - 1;

  // نطاق أعمدة التواريخ بصيغة Excel (D6:??lastRow)
  const firstDateCol = XLSX.utils.encode_col(FIX);
  const lastDateCol  = dates.length > 0 ? XLSX.utils.encode_col(FIX + dates.length - 1) : firstDateCol;
  const dvRange      = dates.length > 0 ? `${firstDateCol}${DATA_ROW}:${lastDateCol}${LAST_ROW}` : '';

  const patched = injectXlsxFeatures(
    buf,
    [0, 1],
    dvRange ? { 0: dvRange } : {},
    {
      0: { xSplit: FIX, ySplit: 5, topLeft: `${firstDateCol}${DATA_ROW}` },
    },
  );

  // تحميل الملف
  const stamp =
    mode === 'today' ? dateFrom.replace(/-/g, '') :
    mode === 'all'   ? 'كامل' :
    `${dateFrom.replace(/-/g, '')}-${dateTo.replace(/-/g, '')}`;

  const blob = new Blob([patched.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `سجل الحضور - ${data.config.programName} - ${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
