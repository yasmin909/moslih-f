import type { AppData, Student, Task, AttendanceRecord } from './types';

export interface StudentReportRow {
  student: Student;
  rank: number;
  overallPercentage: number;
  overallCompleted: number;
  overallTotal: number;
  todayPercentage: number;
  todayCompleted: number;
  todayTotal: number;
  status: 'completed' | 'partial' | 'late';
  streak: number;
  avgRating: number;
  ratedCount: number;
  dailyBreakdown: { day: number; completed: number; total: number; percentage: number }[];
  groupRank: number;
  attendanceRate: number;
}

export interface GroupReport {
  group: string;
  totalStudents: number;
  avgOverall: number;
  avgToday: number;
  completedToday: number;
  partialToday: number;
  lateToday: number;
}

export interface DayReport {
  day: number;
  totalTasks: number;
  totalCompletions: number;
  maxCompletions: number;
  completionRate: number;
  attendanceCount: number;
}

export interface ReportSummary {
  totalStudents: number;
  totalTasks: number;
  totalCompletions: number;
  avgOverall: number;
  avgToday: number;
  completedToday: number;
  partialToday: number;
  lateToday: number;
  todayRate: number;
  topStudent: StudentReportRow | null;
  mostLagging: StudentReportRow | null;
  bestGroup: GroupReport | null;
  avgRating: number;
  totalRated: number;
  todayAttendance: number;
}

function getStatus(p: number): 'completed' | 'partial' | 'late' {
  if (p === 100) return 'completed';
  if (p > 0) return 'partial';
  return 'late';
}

export function getStudentTasksFromData(data: AppData, studentId: string): Task[] {
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return data.tasks;
  const studentGroups = new Set(
    student.groups?.length ? student.groups : [student.group].filter(Boolean),
  );
  return data.tasks.filter((task) => {
    const hasGroupTarget = task.targetGroups && task.targetGroups.length > 0;
    const hasStudentTarget = task.targetStudentIds && task.targetStudentIds.length > 0;
    if (!hasGroupTarget && !hasStudentTarget) return true;
    if (hasGroupTarget && task.targetGroups!.some((g) => studentGroups.has(g))) return true;
    if (hasStudentTarget && task.targetStudentIds!.includes(studentId)) return true;
    return false;
  });
}

export function buildStudentReport(
  data: AppData,
  studentId: string,
  currentDay: number,
): StudentReportRow | null {
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return null;

  const studentTasks = getStudentTasksFromData(data, studentId);
  const sp = data.progress.filter((p) => p.studentId === studentId && p.status === 'completed');
  const total = studentTasks.length;
  const completed = sp.filter((p) => studentTasks.some((t) => t.id === p.taskId)).length;
  const overallPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const todayTasks = studentTasks.filter((t) => t.day === currentDay);
  const todayCompleted = todayTasks.filter((t) => sp.some((p) => p.taskId === t.id)).length;
  const todayTotal = todayTasks.length;
  const todayPercentage = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  let streak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const dTasks = studentTasks.filter((t) => t.day === d);
    if (dTasks.length === 0) continue;
    const dDone = dTasks.every((t) => sp.some((p) => p.taskId === t.id));
    if (dDone) streak++;
    else break;
  }

  const rated = sp.filter((p) => p.supervisorRating);
  const avgRating = rated.length > 0
    ? Math.round((rated.reduce((s, p) => s + (p.supervisorRating ?? 0), 0) / rated.length) * 10) / 10
    : 0;

  const dailyBreakdown: { day: number; completed: number; total: number; percentage: number }[] = [];
  for (let d = 1; d <= currentDay; d++) {
    const dTasks = studentTasks.filter((t) => t.day === d);
    const dCompleted = dTasks.filter((t) => sp.some((p) => p.taskId === t.id)).length;
    dailyBreakdown.push({
      day: d,
      completed: dCompleted,
      total: dTasks.length,
      percentage: dTasks.length > 0 ? Math.round((dCompleted / dTasks.length) * 100) : 0,
    });
  }

  const attendance = (data.attendance ?? []).filter((a) => a.studentId === studentId);
  const presentDays = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentDays / attendance.length) * 100) : 0;

  return {
    student,
    rank: 0,
    overallPercentage,
    overallCompleted: completed,
    overallTotal: total,
    todayPercentage,
    todayCompleted,
    todayTotal,
    status: getStatus(todayPercentage),
    streak,
    avgRating,
    ratedCount: rated.length,
    dailyBreakdown,
    groupRank: 0,
    attendanceRate,
  };
}

export function buildFullReport(data: AppData, currentDay: number) {
  const rows: StudentReportRow[] = data.students
    .map((s) => buildStudentReport(data, s.id, currentDay))
    .filter((r): r is StudentReportRow => r !== null);

  const sorted = [...rows].sort((a, b) => b.overallPercentage - a.overallPercentage);
  sorted.forEach((r, i) => { r.rank = i + 1; });

  const groups = [...new Set(data.students.map((s) => s.group))];
  for (const g of groups) {
    const groupRows = sorted.filter((r) => r.student.group === g);
    groupRows.forEach((r, i) => { r.groupRank = i + 1; });
  }

  const groupReports: GroupReport[] = groups.map((g) => {
    const gr = rows.filter((r) => r.student.group === g);
    return {
      group: g,
      totalStudents: gr.length,
      avgOverall: gr.length > 0 ? Math.round(gr.reduce((s, r) => s + r.overallPercentage, 0) / gr.length) : 0,
      avgToday: gr.length > 0 ? Math.round(gr.reduce((s, r) => s + r.todayPercentage, 0) / gr.length) : 0,
      completedToday: gr.filter((r) => r.status === 'completed').length,
      partialToday: gr.filter((r) => r.status === 'partial').length,
      lateToday: gr.filter((r) => r.status === 'late').length,
    };
  });

  const todayDateStr = new Date().toISOString().split('T')[0];
  const dayReports: DayReport[] = [];
  for (let d = 1; d <= currentDay; d++) {
    const dTasks = data.tasks.filter((t) => t.day === d);
    const dayDate = new Date(data.config.startDate);
    dayDate.setDate(dayDate.getDate() + d - 1);
    const dayDateStr = dayDate.toISOString().split('T')[0];
    const totalCompletions = rows.reduce((sum, r) => {
      const studentTasks = getStudentTasksFromData(data, r.student.id).filter((t) => t.day === d);
      const sp = data.progress.filter((p) => p.studentId === r.student.id && p.status === 'completed');
      return sum + studentTasks.filter((t) => sp.some((p) => p.taskId === t.id)).length;
    }, 0);
    const maxCompletions = rows.reduce((sum, r) =>
      sum + getStudentTasksFromData(data, r.student.id).filter((t) => t.day === d).length, 0);
    const attendanceCount = (data.attendance ?? []).filter(
      (a) => a.date === dayDateStr && (a.status === 'present' || a.status === 'late'),
    ).length;
    dayReports.push({
      day: d,
      totalTasks: dTasks.length,
      totalCompletions,
      maxCompletions,
      completionRate: maxCompletions > 0 ? Math.round((totalCompletions / maxCompletions) * 100) : 0,
      attendanceCount,
    });
  }

  const totalStudents = rows.length;
  const avgOverall = totalStudents > 0 ? Math.round(rows.reduce((s, r) => s + r.overallPercentage, 0) / totalStudents) : 0;
  const avgToday = totalStudents > 0 ? Math.round(rows.reduce((s, r) => s + r.todayPercentage, 0) / totalStudents) : 0;
  const completedToday = rows.filter((r) => r.status === 'completed').length;
  const partialToday = rows.filter((r) => r.status === 'partial').length;
  const lateToday = rows.filter((r) => r.status === 'late').length;
  const todayTotalProgress = rows.reduce((s, r) => s + r.todayCompleted, 0);
  const todayTotalPossible = rows.reduce((s, r) => s + r.todayTotal, 0);
  const todayRate = todayTotalPossible > 0 ? Math.round((todayTotalProgress / todayTotalPossible) * 100) : 0;
  const todayAttendance = (data.attendance ?? []).filter(
    (a) => a.date === todayDateStr && (a.status === 'present' || a.status === 'late'),
  ).length;

  const totalRated = rows.reduce((s, r) => s + r.ratedCount, 0);
  const avgRating = totalRated > 0
    ? Math.round((rows.reduce((s, r) => s + r.avgRating * r.ratedCount, 0) / totalRated) * 10) / 10
    : 0;

  const summary: ReportSummary = {
    totalStudents,
    totalTasks: data.tasks.length,
    totalCompletions: rows.reduce((s, r) => s + r.overallCompleted, 0),
    avgOverall,
    avgToday,
    completedToday,
    partialToday,
    lateToday,
    todayRate,
    topStudent: sorted[0] ?? null,
    mostLagging: [...rows].sort((a, b) => a.todayPercentage - b.todayPercentage)[0] ?? null,
    bestGroup: [...groupReports].sort((a, b) => b.avgToday - a.avgToday)[0] ?? null,
    avgRating,
    totalRated,
    todayAttendance,
  };

  return { rows: sorted, groupReports, dayReports, summary };
}

export function exportCSV(rows: StudentReportRow[], currentDay: number, programName: string) {
  const headers = [
    'الترتيب', 'الاسم', 'المجموعة', 'الهاتف',
    'إنجاز اليوم', 'إجمالي اليوم', 'نسبة اليوم',
    'الإنجاز الكلي', 'إجمالي المهام', 'النسبة الكلية',
    'الأيام المتتالية', 'متوسط التقييم', 'عدد التقييمات', 'الحالة', 'نسبة الحضور',
  ];
  const statusLabel = (s: string) => s === 'completed' ? 'مكتمل' : s === 'partial' ? 'جاري' : 'متأخر';

  const dataRows = rows.map((r) => [
    r.rank, r.student.name, r.student.group, r.student.phone,
    r.todayCompleted, r.todayTotal, `${r.todayPercentage}%`,
    r.overallCompleted, r.overallTotal, `${r.overallPercentage}%`,
    r.streak, r.avgRating || '-', r.ratedCount, statusLabel(r.status), `${r.attendanceRate}%`,
  ]);

  const csv = [headers, ...dataRows].map((row) =>
    row.map((cell) => {
      const s = String(cell);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','),
  ).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${programName.replace(/\s+/g, '-')}-تقرير-يوم${currentDay}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDetailedCSV(
  rows: StudentReportRow[],
  currentDay: number,
  programName: string,
) {
  const lines: string[] = [];
  lines.push(`# ${programName}`);
  lines.push(`# تقرير تفصيلي - اليوم ${currentDay}`);
  lines.push(`# تاريخ الإصدار: ${new Date().toLocaleString('ar-SA')}`);
  lines.push('');
  lines.push('## ملخص عام');
  lines.push(`إجمالي الطلاب,${rows.length}`);
  lines.push(`متوسط الإنجاز الكلي,${Math.round(rows.reduce((s, r) => s + r.overallPercentage, 0) / rows.length)}%`);
  lines.push(`متوسط إنجاز اليوم,${Math.round(rows.reduce((s, r) => s + r.todayPercentage, 0) / rows.length)}%`);
  lines.push(`أكملوا اليوم,${rows.filter((r) => r.status === 'completed').length}`);
  lines.push(`إنجاز جزئي,${rows.filter((r) => r.status === 'partial').length}`);
  lines.push(`لم يبدأوا,${rows.filter((r) => r.status === 'late').length}`);
  lines.push('');
  lines.push('## تفاصيل الطلاب');
  const headers = ['الترتيب', 'الاسم', 'المجموعة', 'إنجاز اليوم', 'النسبة الكلية', 'الأيام المتتالية', 'متوسط التقييم', 'الحالة', 'نسبة الحضور'];
  lines.push(headers.join(','));
  const statusLabel = (s: string) => s === 'completed' ? 'مكتمل' : s === 'partial' ? 'جاري' : 'متأخر';
  rows.forEach((r) => {
    lines.push([r.rank, r.student.name, r.student.group, `${r.todayCompleted}/${r.todayTotal}`, `${r.overallPercentage}%`, r.streak, r.avgRating || '-', statusLabel(r.status), `${r.attendanceRate}%`].join(','));
  });
  lines.push('');
  lines.push('## سجل الأيام لكل طالب');
  rows.forEach((r) => {
    lines.push(`### ${r.student.name} (مجموعة ${r.student.group})`);
    r.dailyBreakdown.forEach((d) => {
      lines.push(`يوم ${d.day},${d.completed}/${d.total},${d.percentage}%`);
    });
    lines.push('');
  });

  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${programName.replace(/\s+/g, '-')}-تقرير-تفصيلي-يوم${currentDay}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(
  fullReport: ReturnType<typeof buildFullReport>,
  programName: string,
) {
  const exportData = {
    programName,
    exportDate: new Date().toISOString(),
    summary: fullReport.summary,
    groupReports: fullReport.groupReports,
    dayReports: fullReport.dayReports,
    students: fullReport.rows.map((r) => ({
      rank: r.rank,
      name: r.student.name,
      group: r.student.group,
      phone: r.student.phone,
      overallPercentage: r.overallPercentage,
      todayPercentage: r.todayPercentage,
      streak: r.streak,
      avgRating: r.avgRating,
      status: r.status,
      attendanceRate: r.attendanceRate,
      dailyBreakdown: r.dailyBreakdown,
    })),
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${programName.replace(/\s+/g, '-')}-تقرير-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildReportMessage(
  row: StudentReportRow,
  currentDay: number,
  programName: string,
): string {
  const statusLabel = row.status === 'completed'
    ? `[ مكتمل ] أنجزت جميع مهام اليوم`
    : row.status === 'partial'
    ? `[ جارٍ ] أنجزت ${row.todayCompleted} من ${row.todayTotal} مهام`
    : `[ لم يبدأ ] لم تبدأ مهام اليوم بعد`;

  const streakNote = row.streak >= 3
    ? `\nالأيام المتتالية: ${row.streak} يوم متواصل — أداء متميز`
    : row.streak > 0
    ? `\nالأيام المتتالية: ${row.streak} يوم`
    : '';

  return `[ ${programName} ]\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `السلام عليكم ${row.student.name}،\n\n` +
    `تقرير اليوم ${currentDay}:\n` +
    `${statusLabel}\n\n` +
    `◆ نسبة اليوم    : ${row.todayPercentage}%\n` +
    `◆ الإنجاز الكلي : ${row.overallPercentage}%${streakNote}\n\n` +
    `واصل التقدم — أنت قادر`;
}

export function buildWhatsAppMessage(
  row: StudentReportRow,
  currentDay: number,
  programName: string,
): string {
  return buildReportMessage(row, currentDay, programName);
}

export function buildTelegramMessage(
  row: StudentReportRow,
  currentDay: number,
  programName: string,
): string {
  return buildReportMessage(row, currentDay, programName);
}

export function buildBroadcastMessage(
  rows: StudentReportRow[],
  currentDay: number,
  programName: string,
): string {
  const completed = rows.filter((r) => r.status === 'completed').length;
  const lagging = rows.filter((r) => r.status !== 'completed');
  return `[ ${programName} ]\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `تذكير لطلابنا الكرام\n\n` +
    `اليوم ${currentDay} من البرنامج\n\n` +
    `◆ أكملوا اليوم   : ${completed} طالب\n` +
    `◆ بحاجة إنجاز   : ${lagging.length} طالب\n\n` +
    `لا تؤجّل عمل اليوم إلى الغد — الوقت ثمين`;
}

export function getWhatsAppLink(phone: string): string {
  const normalized = phone.replace(/\s+/g, '').replace(/^00963/, '963').replace(/^0/, '963');
  return `https://wa.me/${normalized}`;
}

export function getTelegramLink(handle: string, message?: string): string {
  const clean = handle.replace('@', '');
  if (!clean) return '#';
  const base = `https://t.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
