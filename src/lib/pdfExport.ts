import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// === Brand palette ===
const C = {
  bg: '#f7f3ed',
  card: '#ffffff',
  brown: '#9a7b4f',
  brownDark: '#3a291d',
  brownLight: '#faf6ef',
  border: '#e2d9ca',
  borderSoft: '#ece4d6',
  gray: '#8a7560',
  grayLight: '#b0a090',
  green: '#4a6b3a',
  greenLight: '#e8f0e0',
  amber: '#9a6b2e',
  amberLight: '#faf0e0',
  red: '#a8453a',
  redLight: '#f5e0de',
  gold: '#d4a96a',
  white: '#ffffff',
};

// A4 dimensions at 96 DPI (px)
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_PADDING = 40;

export interface CustomReportConfig {
  title: string;
  startDate?: string;
  endDate?: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  includeStudentDetails: boolean;
  includeGroupSummary: boolean;
  includeDailyBreakdown: boolean;
  includeRankings: boolean;
}

interface ReportStudentData {
  name: string;
  group: string;
  phone: string;
  username: string;
  password: string;
  overallPercentage: number;
  todayPercentage: number;
  completedTasks: number;
  totalTasks: number;
  streak: number;
  avgRating: number;
  status: string;
  dailyBreakdown: { day: number; percentage: number; completed: number; total: number }[];
}

function statusLabel(s: string): string {
  return s === 'completed' ? 'مكتمل' : s === 'partial' ? 'جاري' : 'متأخر';
}

function statusColor(s: string): string {
  return s === 'completed' ? C.green : s === 'partial' ? C.amber : C.red;
}

function statusBg(s: string): string {
  return s === 'completed' ? C.greenLight : s === 'partial' ? C.amberLight : C.redLight;
}

function progressBarHtml(percentage: number, color: string): string {
  return `<div style="display:flex;align-items:center;gap:6px;"><div style="flex:1;height:6px;background:${C.borderSoft};border-radius:3px;overflow:hidden;"><div style="width:${percentage}%;height:100%;background:${color};border-radius:3px;"></div></div><span style="font-size:10px;color:${C.gray};min-width:30px;text-align:left;">${percentage}%</span></div>`;
}

/**
 * Creates a page container element with consistent styling.
 */
function createPage(pageNum: number, totalPages: number, programName: string, title: string): HTMLElement {
  const page = document.createElement('div');
  page.style.cssText = `
    width:${PAGE_WIDTH}px;min-height:${PAGE_HEIGHT}px;max-height:${PAGE_HEIGHT}px;
    padding:${PAGE_PADDING}px;background:${C.bg};font-family:'Tajawal',sans-serif;
    direction:rtl;color:${C.brownDark};box-sizing:border-box;
    display:flex;flex-direction:column;position:relative;overflow:hidden;
  `;
  // Header
  const header = document.createElement('div');
  header.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:2px solid ${C.brown};margin-bottom:20px;`;
  const logoSrc = `${(typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/')}logo.png`;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="${logoSrc}" alt="مُصلِح" style="width:36px;height:36px;border-radius:9px;object-fit:cover;flex-shrink:0;" crossorigin="anonymous" />
      <div>
        <div style="font-size:14px;font-weight:800;color:${C.brownDark};">${programName}</div>
        <div style="font-size:10px;color:${C.gray};margin-top:2px;">${title}</div>
      </div>
    </div>
    <div style="font-size:10px;color:${C.gray};">${new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  `;
  page.appendChild(header);

  // Content area
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;display:flex;flex-direction:column;';
  content.setAttribute('data-pdf-content', '1');
  page.appendChild(content);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `padding-top:12px;border-top:1px solid ${C.border};font-size:9px;color:${C.grayLight};display:flex;justify-content:space-between;margin-top:auto;`;
  footer.innerHTML = `<span>${programName} — نظام مصلح</span><span>صفحة ${pageNum} من ${totalPages}</span>`;
  page.appendChild(footer);

  return page;
}

/**
 * Measures the height of an HTML element string by temporarily adding it to the DOM.
 */
function measureHeight(html: string, containerWidth: number): number {
  const temp = document.createElement('div');
  temp.style.cssText = `position:fixed;top:-9999px;width:${containerWidth}px;font-family:'Tajawal',sans-serif;direction:rtl;`;
  temp.innerHTML = html;
  document.body.appendChild(temp);
  const height = temp.scrollHeight;
  document.body.removeChild(temp);
  return height;
}

/**
 * Builds a section title element.
 */
function sectionTitle(text: string): string {
  return `<div style="font-size:16px;font-weight:700;color:${C.brownDark};margin-bottom:14px;padding-right:12px;border-right:4px solid ${C.brown};">${text}</div>`;
}

/**
 * Exports a custom multi-page PDF report.
 * Each page is rendered individually to prevent content from being cut mid-row.
 */
export async function exportCustomReportPDF(
  students: ReportStudentData[],
  config: CustomReportConfig,
  programName: string,
  currentDay: number,
) {
  if (students.length === 0) return;

  const avgOverall = students.length > 0 ? Math.round(students.reduce((s, r) => s + r.overallPercentage, 0) / students.length) : 0;
  const completedToday = students.filter((s) => s.status === 'completed').length;
  const partialToday = students.filter((s) => s.status === 'partial').length;
  const lateToday = students.filter((s) => s.status === 'late').length;
  const ratedStudents = students.filter((s) => s.avgRating > 0);
  const avgRating = ratedStudents.length > 0
    ? (ratedStudents.reduce((s, r) => s + r.avgRating, 0) / ratedStudents.length).toFixed(1)
    : '—';

  // Group data
  const groupMap = new Map<string, { count: number; avgOverall: number; avgToday: number; completed: number; partial: number; late: number }>();
  students.forEach((s) => {
    const g = groupMap.get(s.group) || { count: 0, avgOverall: 0, avgToday: 0, completed: 0, partial: 0, late: 0 };
    g.count++;
    g.avgOverall += s.overallPercentage;
    g.avgToday += s.todayPercentage;
    if (s.status === 'completed') g.completed++;
    else if (s.status === 'partial') g.partial++;
    else g.late++;
    groupMap.set(s.group, g);
  });

  // === Build content sections as HTML strings ===
  const sections: { title: string; html: string }[] = [];

  // Title section
  sections.push({
    title: '__title__',
    html: `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:13px;color:${C.gray};margin-bottom:4px;">${programName}</div>
        <div style="font-size:26px;font-weight:800;color:${C.brownDark};margin-bottom:8px;">${config.title}</div>
        <div style="font-size:13px;color:${C.gray};">اليوم ${currentDay} — ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    `,
  });

  // Summary cards
  sections.push({
    title: '__summary__',
    html: `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:${C.brown};">${students.length}</div>
          <div style="font-size:11px;color:${C.gray};margin-top:2px;">إجمالي الطلاب</div>
        </div>
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:${C.green};">${avgOverall}%</div>
          <div style="font-size:11px;color:${C.gray};margin-top:2px;">متوسط الإنجاز</div>
        </div>
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:${C.amber};">${completedToday}</div>
          <div style="font-size:11px;color:${C.gray};margin-top:2px;">أكملوا اليوم</div>
        </div>
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:${C.gold};">${avgRating}</div>
          <div style="font-size:11px;color:${C.gray};margin-top:2px;">متوسط التقييم</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <div style="flex:1;background:${C.greenLight};border:1px solid #c5d9b0;border-radius:10px;padding:10px;text-align:center;">
          <span style="font-size:12px;font-weight:700;color:${C.green};display:inline-flex;align-items:center;gap:5px;">
            <svg width="8" height="8" viewBox="0 0 8 8" style="flex-shrink:0"><circle cx="4" cy="4" r="4" fill="${C.green}"/></svg>
            مكتمل: ${completedToday}
          </span>
        </div>
        <div style="flex:1;background:${C.amberLight};border:1px solid #e5d5b0;border-radius:10px;padding:10px;text-align:center;">
          <span style="font-size:12px;font-weight:700;color:${C.amber};display:inline-flex;align-items:center;gap:5px;">
            <svg width="8" height="8" viewBox="0 0 8 8" style="flex-shrink:0"><circle cx="4" cy="4" r="4" fill="${C.amber}"/></svg>
            جاري: ${partialToday}
          </span>
        </div>
        <div style="flex:1;background:${C.redLight};border:1px solid #e5c0bc;border-radius:10px;padding:10px;text-align:center;">
          <span style="font-size:12px;font-weight:700;color:${C.red};display:inline-flex;align-items:center;gap:5px;">
            <svg width="8" height="8" viewBox="0 0 8 8" style="flex-shrink:0"><circle cx="4" cy="4" r="4" fill="${C.red}"/></svg>
            متأخر: ${lateToday}
          </span>
        </div>
      </div>
    `,
  });

  // Student details table — paginated
  if (config.includeStudentDetails) {
    const rowsPerPage = 22; // rows that fit on one page
    const numPages = Math.ceil(students.length / rowsPerPage);
    for (let p = 0; p < numPages; p++) {
      const pageStudents = students.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
      let tableHtml = sectionTitle(p === 0 ? 'تفاصيل الطلاب' : `تفاصيل الطلاب (تابع — ${p + 1})`);
      tableHtml += `<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:${C.brown};color:${C.bg};">`;
      tableHtml += '<th style="padding:8px;text-align:center;font-weight:700;">#</th><th style="padding:8px;text-align:right;font-weight:700;">الطالب</th><th style="padding:8px;text-align:center;font-weight:700;">المجموعة</th><th style="padding:8px;text-align:center;font-weight:700;">إنجاز اليوم</th><th style="padding:8px;text-align:center;font-weight:700;">الإنجاز الكلي</th><th style="padding:8px;text-align:center;font-weight:700;">التتابع</th><th style="padding:8px;text-align:center;font-weight:700;">التقييم</th><th style="padding:8px;text-align:center;font-weight:700;">الحالة</th>';
      tableHtml += '</tr></thead><tbody>';
      pageStudents.forEach((s, i) => {
        const globalIdx = p * rowsPerPage + i;
        const bg = globalIdx % 2 === 0 ? C.card : C.brownLight;
        const sc = statusColor(s.status);
        tableHtml += `<tr style="background:${bg};border-bottom:1px solid ${C.borderSoft};">`;
        tableHtml += `<td style="padding:7px;text-align:center;color:${C.gray};">${globalIdx + 1}</td>`;
        tableHtml += `<td style="padding:7px;text-align:right;font-weight:600;color:${C.brownDark};">${s.name}</td>`;
        tableHtml += `<td style="padding:7px;text-align:center;color:${C.gray};">${s.group}</td>`;
        tableHtml += `<td style="padding:7px;">${progressBarHtml(s.todayPercentage, C.green)}</td>`;
        tableHtml += `<td style="padding:7px;">${progressBarHtml(s.overallPercentage, C.brown)}</td>`;
        tableHtml += `<td style="padding:7px;text-align:center;font-weight:700;color:${C.gold};">${s.streak} يوم</td>`;
        tableHtml += `<td style="padding:7px;text-align:center;font-weight:700;color:${C.gold};">${s.avgRating > 0 ? s.avgRating + ' ★' : '—'}</td>`;
        tableHtml += `<td style="padding:7px;text-align:center;"><span style="padding:3px 8px;border-radius:10px;font-size:10px;font-weight:600;color:${sc};background:${statusBg(s.status)};">${statusLabel(s.status)}</span></td>`;
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      sections.push({ title: 'students', html: tableHtml });
    }
  }

  // Group summary
  if (config.includeGroupSummary) {
    let groupHtml = sectionTitle('ملخص المجموعات');
    groupHtml += `<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:${C.brown};color:${C.bg};">`;
    groupHtml += '<th style="padding:8px;text-align:right;font-weight:700;">المجموعة</th><th style="padding:8px;text-align:center;font-weight:700;">الطلاب</th><th style="padding:8px;text-align:center;font-weight:700;">متوسط اليوم</th><th style="padding:8px;text-align:center;font-weight:700;">متوسط الكلي</th><th style="padding:8px;text-align:center;font-weight:700;">مكتمل</th><th style="padding:8px;text-align:center;font-weight:700;">جاري</th><th style="padding:8px;text-align:center;font-weight:700;">متأخر</th>';
    groupHtml += '</tr></thead><tbody>';
    let gi = 0;
    groupMap.forEach((g, name) => {
      const avgO = Math.round(g.avgOverall / g.count);
      const avgT = Math.round(g.avgToday / g.count);
      const bg = gi % 2 === 0 ? C.card : C.brownLight;
      groupHtml += `<tr style="background:${bg};border-bottom:1px solid ${C.borderSoft};">`;
      groupHtml += `<td style="padding:8px;text-align:right;font-weight:700;color:${C.brownDark};">مجموعة ${name}</td>`;
      groupHtml += `<td style="padding:8px;text-align:center;color:${C.gray};">${g.count}</td>`;
      groupHtml += `<td style="padding:8px;">${progressBarHtml(avgT, C.green)}</td>`;
      groupHtml += `<td style="padding:8px;">${progressBarHtml(avgO, C.brown)}</td>`;
      groupHtml += `<td style="padding:8px;text-align:center;font-weight:700;color:${C.green};">${g.completed}</td>`;
      groupHtml += `<td style="padding:8px;text-align:center;font-weight:700;color:${C.amber};">${g.partial}</td>`;
      groupHtml += `<td style="padding:8px;text-align:center;font-weight:700;color:${C.red};">${g.late}</td>`;
      groupHtml += '</tr>';
      gi++;
    });
    groupHtml += '</tbody></table>';
    sections.push({ title: 'groups', html: groupHtml });
  }

  // Rankings
  if (config.includeRankings) {
    const sorted = [...students].sort((a, b) => b.overallPercentage - a.overallPercentage);
    const top10 = sorted.slice(0, Math.min(10, sorted.length));
    let rankHtml = sectionTitle('الترتيب — الأعلى التزاماً');
    rankHtml += '<div style="display:flex;flex-direction:column;gap:6px;">';
    top10.forEach((s, i) => {
      const rankNum = i + 1;
      rankHtml += `<div style="display:flex;align-items:center;gap:12px;background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:10px 14px;">`;
      rankHtml += `<span style="font-size:13px;font-weight:800;width:28px;text-align:center;color:${C.brownDark};">${rankNum}</span>`;
      rankHtml += `<span style="flex:1;font-weight:700;color:${C.brownDark};">${s.name}</span>`;
      rankHtml += `<span style="font-size:12px;color:${C.gray};">مجموعة ${s.group}</span>`;
      rankHtml += `<span style="font-weight:800;color:${C.brown};min-width:50px;text-align:left;">${s.overallPercentage}%</span>`;
      rankHtml += `<span style="font-size:12px;color:${C.gold};">${s.streak} يوم</span>`;
      rankHtml += '</div>';
    });
    rankHtml += '</div>';
    sections.push({ title: 'rankings', html: rankHtml });
  }

  // Daily breakdown heatmap
  if (config.includeDailyBreakdown && students.length > 0 && students[0].dailyBreakdown.length > 0) {
    const maxDay = Math.max(...students[0].dailyBreakdown.map((d) => d.day));
    const rowsPerHeatmapPage = 25;
    const numHeatPages = Math.ceil(students.length / rowsPerHeatmapPage);
    for (let hp = 0; hp < numHeatPages; hp++) {
      const pageStudents = students.slice(hp * rowsPerHeatmapPage, (hp + 1) * rowsPerHeatmapPage);
      let heatHtml = sectionTitle(hp === 0 ? 'سجل الإنجاز اليومي' : `سجل الإنجاز اليومي (تابع — ${hp + 1})`);
      heatHtml += `<table style="width:100%;border-collapse:collapse;font-size:9px;"><thead><tr style="background:${C.brown};color:${C.bg};">`;
      heatHtml += `<th style="padding:6px;text-align:right;font-weight:700;position:sticky;right:0;">الطالب</th>`;
      for (let d = 1; d <= maxDay; d++) {
        heatHtml += `<th style="padding:4px;text-align:center;font-weight:600;min-width:20px;">${d}</th>`;
      }
      heatHtml += '</tr></thead><tbody>';
      pageStudents.forEach((s, i) => {
        const globalIdx = hp * rowsPerHeatmapPage + i;
        const bg = globalIdx % 2 === 0 ? C.card : C.brownLight;
        heatHtml += `<tr style="background:${bg};"><td style="padding:5px;text-align:right;font-weight:600;color:${C.brownDark};white-space:nowrap;">${s.name.substring(0, 20)}</td>`;
        for (let d = 1; d <= maxDay; d++) {
          const dayData = s.dailyBreakdown.find((bd) => bd.day === d);
          if (dayData) {
            const p = dayData.percentage;
            const color = p === 100 ? C.green : p >= 50 ? '#6b9a4e' : p > 0 ? C.gold : '#e5c0bc';
            heatHtml += `<td style="padding:2px;text-align:center;"><div style="width:18px;height:18px;border-radius:4px;background:${color};margin:auto;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;">${p > 0 ? p : ''}</div></td>`;
          } else {
            heatHtml += `<td style="padding:2px;"></td>`;
          }
        }
        heatHtml += '</tr>';
      });
      heatHtml += '</tbody></table>';
      sections.push({ title: 'heatmap', html: heatHtml });
    }
  }

  // === Paginate: distribute sections across pages ===
  const contentWidth = PAGE_WIDTH - PAGE_PADDING * 2;
  const usableHeight = PAGE_HEIGHT - PAGE_PADDING * 2 - 60; // minus header/footer

  // First, measure each section
  const measuredSections = sections.map((s) => ({
    ...s,
    height: measureHeight(s.html, contentWidth),
  }));

  // Distribute into pages
  const pages: string[] = [];
  let currentPageHtml = '';
  let currentPageHeight = 0;

  for (const section of measuredSections) {
    // If section alone is taller than a page, it must go on its own (tables are already paginated)
    if (section.height > usableHeight) {
      // Flush current page
      if (currentPageHtml) {
        pages.push(currentPageHtml);
        currentPageHtml = '';
        currentPageHeight = 0;
      }
      pages.push(section.html);
      continue;
    }
    // Will it fit?
    if (currentPageHeight + section.height > usableHeight) {
      // Flush and start new
      if (currentPageHtml) pages.push(currentPageHtml);
      currentPageHtml = section.html;
      currentPageHeight = section.height;
    } else {
      currentPageHtml += section.html;
      currentPageHeight += section.height;
    }
  }
  if (currentPageHtml) pages.push(currentPageHtml);

  // === Render each page to canvas and build PDF ===
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidthMm = 210;
  const pageHeightMm = 297;

  for (let i = 0; i < pages.length; i++) {
    const pageEl = createPage(i + 1, pages.length, programName, config.title);
    const contentEl = pageEl.querySelector('[data-pdf-content]') as HTMLElement;
    if (contentEl) {
      contentEl.innerHTML = pages[i];
    }

    // Temporarily add to DOM for rendering
    pageEl.style.position = 'fixed';
    pageEl.style.top = '-9999px';
    pageEl.style.left = '0';
    document.body.appendChild(pageEl);

    try {
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        backgroundColor: C.bg,
        useCORS: true,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      });

      if (i > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);
    } catch (err) {
      console.error(`Page ${i + 1} render error:`, err);
    }

    document.body.removeChild(pageEl);
  }

  const filename = config.title.replace(/\s+/g, '-') + '.pdf';
  pdf.save(filename);
}

// === Credentials PDF (also page-by-page now) ===
export interface CredentialSlip {
  name: string;
  group: string;
  username: string;
  password: string;
  phone?: string;
}

export async function exportCredentialsPDF(slips: CredentialSlip[], programName: string) {
  if (slips.length === 0) return;

  const slipsPerPage = 8; // 2 columns × 4 rows
  const numPages = Math.ceil(slips.length / slipsPerPage);
  const pdf = new jsPDF('p', 'mm', 'a4');

  for (let p = 0; p < numPages; p++) {
    const pageSlips = slips.slice(p * slipsPerPage, (p + 1) * slipsPerPage);

    const page = document.createElement('div');
    page.style.cssText = `
      width:${PAGE_WIDTH}px;min-height:${PAGE_HEIGHT}px;max-height:${PAGE_HEIGHT}px;
      padding:${PAGE_PADDING}px;background:${C.bg};font-family:'Tajawal',sans-serif;
      direction:rtl;color:${C.brownDark};box-sizing:border-box;
      display:flex;flex-direction:column;position:relative;overflow:hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${C.brown};`;
    header.innerHTML = `
      <div style="font-size:20px;font-weight:800;color:${C.brownDark};">${programName}</div>
      <div style="font-size:12px;color:${C.gray};margin-top:4px;">قصاصات بيانات الدخول — ${new Date().toLocaleDateString('ar-SA')}</div>
    `;
    page.appendChild(header);

    // Grid of slips
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:1;';

    pageSlips.forEach((slip) => {
      const card = document.createElement('div');
      card.style.cssText = `background:${C.card};border:2px solid ${C.brown};border-radius:12px;padding:0;overflow:hidden;box-shadow:0 2px 8px rgba(58,41,29,0.08);`;
      card.innerHTML = `
        <div style="background:${C.brown};color:${C.bg};padding:8px 16px;text-align:center;font-size:11px;font-weight:700;">
          ${programName.length > 40 ? programName.substring(0, 40) + '…' : programName}
        </div>
        <div style="padding:16px;text-align:center;">
          <div style="font-size:16px;font-weight:800;color:${C.brownDark};margin-bottom:4px;">${slip.name}</div>
          <div style="font-size:11px;color:${C.gray};margin-bottom:12px;">المجموعة: ${slip.group}</div>
          <div style="border-top:1px dashed ${C.border};padding-top:12px;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;color:${C.gray};">اسم المستخدم</span>
              <span style="font-size:13px;font-weight:700;color:${C.brownDark};">${slip.username}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;color:${C.gray};">كلمة المرور</span>
              <span style="font-size:13px;font-weight:700;color:${C.brownDark};">${slip.password}</span>
            </div>
          </div>
          ${slip.phone ? `<div style="font-size:10px;color:${C.grayLight};margin-top:8px;">${slip.phone}</div>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });

    page.appendChild(grid);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `padding-top:12px;border-top:1px solid ${C.border};font-size:9px;color:${C.grayLight};display:flex;justify-content:space-between;margin-top:auto;`;
    footer.innerHTML = `<span>${programName} — نظام مصلح</span><span>صفحة ${p + 1} من ${numPages}</span>`;
    page.appendChild(footer);

    // Render
    page.style.position = 'fixed';
    page.style.top = '-9999px';
    page.style.left = '0';
    document.body.appendChild(page);

    try {
      const canvas = await html2canvas(page, {
        scale: 2,
        backgroundColor: C.bg,
        useCORS: true,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      });

      if (p > 0) pdf.addPage();
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    } catch (err) {
      console.error(`Credentials page ${p + 1} error:`, err);
    }

    document.body.removeChild(page);
  }

  pdf.save('قصاصات-الدخول.pdf');
}
