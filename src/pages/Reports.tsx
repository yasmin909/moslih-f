import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Printer, Filter, MessageCircle, Send,
  AlertCircle, CheckCircle2, Clock, Trophy, TrendingUp, TrendingDown,
  Users, Star, Flame, ChevronDown, ChevronUp, Search, X, Crown,
  BarChart3, PieChart, Calendar, FileJson, FileSpreadsheet, Award,
  Target, Activity, Zap, Medal, ArrowUpRight, Mail, Copy, Check,
  CalendarRange, FileType,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { ProgressBar } from '../components/ProgressBar';
import { ProgressRing } from '../components/ProgressRing';
import {
  buildFullReport, exportCSV, exportDetailedCSV, exportJSON,
  buildWhatsAppMessage, buildTelegramMessage, buildBroadcastMessage,
  getWhatsAppLink, getTelegramLink,
  type StudentReportRow,
} from '../lib/reportUtils';
import { exportCustomReportPDF, type CustomReportConfig } from '../lib/pdfExport';
import { exportExcel } from '../lib/excelExport';

type ReportTab = 'overview' | 'students' | 'groups' | 'trends' | 'rankings' | 'attendance';
type SortField = 'rank' | 'today' | 'overall' | 'streak' | 'rating' | 'name';
type SortDir = 'asc' | 'desc';

export function Reports() {
  const { data, getCurrentDay, getAttendanceStats } = useStore();
  const currentDay = getCurrentDay();
  const programName = data.config.programName;

  const fullReport = useMemo(() => buildFullReport(data, currentDay), [data, currentDay]);

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('today');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentReportRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const filteredRows = useMemo(() => {
    let rows = [...fullReport.rows];
    if (groupFilter !== 'all') rows = rows.filter((r) => r.student.group === groupFilter);
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);
    if (search) rows = rows.filter((r) => r.student.name.includes(search));

    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'rank': cmp = a.rank - b.rank; break;
        case 'today': cmp = a.todayPercentage - b.todayPercentage; break;
        case 'overall': cmp = a.overallPercentage - b.overallPercentage; break;
        case 'streak': cmp = a.streak - b.streak; break;
        case 'rating': cmp = a.avgRating - b.avgRating; break;
        case 'name': cmp = a.student.name.localeCompare(b.student.name, 'ar'); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [fullReport.rows, groupFilter, statusFilter, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const summary = fullReport.summary;
  const groups = [...new Set(data.students.map((s) => s.group))].sort();

  const handlePrint = () => window.print();

  const handleWhatsApp = (row: StudentReportRow) => {
    const msg = encodeURIComponent(buildWhatsAppMessage(row, currentDay, programName));
    window.open(`${getWhatsAppLink(row.student.phone)}?text=${msg}`, '_blank');
  };

  const handleTelegram = (row: StudentReportRow) => {
    if (!row.student.telegramHandle) {
      navigator.clipboard.writeText(buildTelegramMessage(row, currentDay, programName));
      return;
    }
    const msg = buildTelegramMessage(row, currentDay, programName);
    window.open(getTelegramLink(row.student.telegramHandle, msg), '_blank');
  };

  const handleBroadcast = () => {
    const msg = encodeURIComponent(buildBroadcastMessage(fullReport.rows, currentDay, programName));
    const lagging = fullReport.rows.filter((r) => r.status !== 'completed');
    if (lagging.length > 0) {
      window.open(`${getWhatsAppLink(lagging[0].student.phone)}?text=${msg}`, '_blank');
    }
  };

  const handleTelegramBroadcast = () => {
    const msg = buildBroadcastMessage(fullReport.rows, currentDay, programName);
    navigator.clipboard.writeText(msg);
    setCopiedId('tg-broadcast');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyReport = () => {
    const text = `📊 تقرير ${programName} - اليوم ${currentDay}\n` +
      `إجمالي الطلاب: ${summary.totalStudents}\n` +
      `متوسط الإنجاز الكلي: ${summary.avgOverall}%\n` +
      `متوسط إنجاز اليوم: ${summary.avgToday}%\n` +
      `أكملوا اليوم: ${summary.completedToday}\n` +
      `إنجاز جزئي: ${summary.partialToday}\n` +
      `لم يبدأوا: ${summary.lateToday}`;
    navigator.clipboard.writeText(text);
    setCopiedId('summary');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tabs: { id: ReportTab; label: string; icon: typeof FileText }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: PieChart },
    { id: 'students', label: 'تفاصيل الطلاب', icon: Users },
    { id: 'groups', label: 'تحليل المجموعات', icon: BarChart3 },
    { id: 'trends', label: 'الاتجاهات اليومية', icon: TrendingUp },
    { id: 'rankings', label: 'الترتيب والتصنيف', icon: Trophy },
    { id: 'attendance', label: 'الحضور', icon: Calendar },
  ];

  const statusBadge = (status: string) => {
    if (status === 'completed') return { label: 'مكتمل', color: 'var(--st-done)', bg: 'var(--st-done-bg)', icon: CheckCircle2 };
    if (status === 'partial') return { label: 'جاري', color: 'var(--st-prog)', bg: 'var(--st-prog-bg)', icon: Clock };
    return { label: 'متأخر', color: 'var(--st-late)', bg: 'var(--st-late-bg)', icon: AlertCircle };
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'var(--c-amber-bg)', color: 'var(--c-amber)', icon: Crown };
    if (rank === 2) return { bg: 'var(--bg-hover)', color: 'var(--text-secondary)', icon: Medal };
    if (rank === 3) return { bg: 'var(--c-clay-bg)', color: 'var(--c-clay)', icon: Award };
    return null;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* === Header === */}
      <div className="no-print flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-app tracking-tight">مركز التقارير المتقدم</h2>
          <p className="text-sm text-dim mt-1">
            تقرير شامل — اليوم {currentDay} من {data.config.totalDays} — {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleCopyReport} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-105 border" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            {copiedId === 'summary' ? <Check className="w-4 h-4" style={{ color: 'var(--st-done)' }} /> : <Copy className="w-4 h-4" />}
            {copiedId === 'summary' ? 'تم النسخ' : 'نسخ الملخص'}
          </button>
          <button onClick={handleBroadcast} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-105 border" style={{ background: 'var(--st-done-bg)', color: 'var(--st-done)', borderColor: 'var(--st-done-bg)' }}>
            <MessageCircle className="w-4 h-4" /> إذاعة واتساب
          </button>
          <button onClick={handleTelegramBroadcast} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-105 border" style={{ background: 'var(--c-sky-bg)', color: 'var(--c-sky)', borderColor: 'var(--c-sky-bg)' }}>
            {copiedId === 'tg-broadcast' ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {copiedId === 'tg-broadcast' ? 'تم نسخ الرسالة' : 'إذاعة تيليجرام'}
          </button>
          <div className="relative" ref={exportRef}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:scale-105" style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}>
              <Download className="w-4 h-4" /> تصدير
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-2 w-60 solid-card rounded-2xl p-2 z-50 slide-down"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold text-dim uppercase tracking-wide">Excel</div>
                    <button onClick={() => { exportExcel(filteredRows, fullReport.groupReports, fullReport.dayReports, fullReport.summary, currentDay, programName, data.attendance ?? []); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-app hover:bg-hover-soft transition-colors text-right">
                      <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--st-done)' }} />
                      <div><div className="font-medium">Excel — تقرير شامل</div><div className="text-[10px] text-dim">5 أوراق منسقة احترافياً</div></div>
                    </button>
                    <div className="h-px my-1" style={{ background: 'var(--border-soft)' }} />
                    <div className="px-3 py-1.5 text-[10px] font-bold text-dim uppercase tracking-wide">CSV</div>
                    <button onClick={() => { exportCSV(filteredRows, currentDay, programName); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-app hover:bg-hover-soft transition-colors text-right">
                      <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--st-done)' }} />
                      <div><div className="font-medium">CSV مبسط</div><div className="text-[10px] text-dim">بيانات أساسية</div></div>
                    </button>
                    <button onClick={() => { exportDetailedCSV(filteredRows, currentDay, programName); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-app hover:bg-hover-soft transition-colors text-right">
                      <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <div><div className="font-medium">CSV تفصيلي</div><div className="text-[10px] text-dim">سجل يومي كامل</div></div>
                    </button>
                    <div className="h-px my-1" style={{ background: 'var(--border-soft)' }} />
                    <div className="px-3 py-1.5 text-[10px] font-bold text-dim uppercase tracking-wide">PDF</div>
                    <button onClick={() => { setShowCustomReport(true); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-app hover:bg-hover-soft transition-colors text-right">
                      <FileType className="w-4 h-4" style={{ color: 'var(--c-violet)' }} />
                      <div><div className="font-medium">تقرير PDF مخصص</div><div className="text-[10px] text-dim">أسبوعي / شهري / مخصص</div></div>
                    </button>
                    <button onClick={() => { handlePrint(); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-app hover:bg-hover-soft transition-colors text-right">
                      <Printer className="w-4 h-4" style={{ color: 'var(--c-violet)' }} />
                      <div><div className="font-medium">طباعة / PDF</div><div className="text-[10px] text-dim">تقرير قابل للطباعة</div></div>
                    </button>
                    <div className="h-px my-1" style={{ background: 'var(--border-soft)' }} />
                    <div className="px-3 py-1.5 text-[10px] font-bold text-dim uppercase tracking-wide">بيانات</div>
                    <button onClick={() => { exportJSON(fullReport, programName); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-app hover:bg-hover-soft transition-colors text-right">
                      <FileJson className="w-4 h-4" style={{ color: 'var(--c-sky)' }} />
                      <div><div className="font-medium">JSON</div><div className="text-[10px] text-dim">بيانات منظمة</div></div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* === Tabs === */}
      <div className="no-print flex items-center gap-1.5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${activeTab === tab.id ? 'text-app' : 'text-dim hover:text-sub'}`}
            style={activeTab === tab.id ? { background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' } : { border: '1px solid transparent' }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* === Overview Tab === */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'إجمالي الطلاب', value: summary.totalStudents, icon: Users, cv: '--accent' },
              { label: 'متوسط الإنجاز', value: `${summary.avgOverall}%`, icon: TrendingUp, cv: '--c-sky' },
              { label: 'إنجاز اليوم', value: `${summary.avgToday}%`, icon: Target, cv: '--c-teal' },
              { label: 'أكملوا اليوم', value: summary.completedToday, icon: CheckCircle2, cv: '--st-done' },
              { label: 'بحاجة متابعة', value: summary.lateToday + summary.partialToday, icon: AlertCircle, cv: '--st-late' },
              { label: 'متوسط التقييم', value: summary.avgRating || '—', icon: Star, cv: '--c-amber' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card rounded-2xl p-4 hover-lift">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `var(${s.cv}-bg)`, color: `var(${s.cv})` }}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-extrabold text-app tabular-nums">{s.value}</div>
                <div className="text-xs text-dim mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Highlights + progress rings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Today completion ring */}
            <div className="glass-card rounded-2xl p-6 text-center">
              <h3 className="text-sm font-bold text-sub mb-4">نسبة إنجاز اليوم</h3>
              <ProgressRing percentage={summary.todayRate} size={130} colorVar="--c-teal" label="معدل اليوم" />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold" style={{ color: 'var(--st-done)' }}>{summary.completedToday}</div><div className="text-[10px] text-dim">مكتمل</div></div>
                <div><div className="text-lg font-bold" style={{ color: 'var(--st-prog)' }}>{summary.partialToday}</div><div className="text-[10px] text-dim">جاري</div></div>
                <div><div className="text-lg font-bold" style={{ color: 'var(--st-late)' }}>{summary.lateToday}</div><div className="text-[10px] text-dim">متأخر</div></div>
              </div>
            </div>

            {/* Overall ring */}
            <div className="glass-card rounded-2xl p-6 text-center">
              <h3 className="text-sm font-bold text-sub mb-4">الإنجاز الكلي للبرنامج</h3>
              <ProgressRing percentage={summary.avgOverall} size={130} colorVar="--c-sky" label="متوسط كلي" />
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div><div className="text-lg font-bold text-app tabular-nums">{summary.totalCompletions}</div><div className="text-[10px] text-dim">مهام مكتملة</div></div>
                <div><div className="text-lg font-bold text-app tabular-nums">{summary.totalTasks}</div><div className="text-[10px] text-dim">إجمالي المهام</div></div>
              </div>
            </div>

            {/* Highlights */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-sub mb-2">أبرز النتائج</h3>
              {summary.topStudent && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--c-amber-bg)' }}>
                  <Crown className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-amber)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-dim">الأعلى التزاماً</div>
                    <div className="text-sm font-bold text-app truncate">{summary.topStudent.student.name}</div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--c-amber)' }}>{summary.topStudent.overallPercentage}%</span>
                </div>
              )}
              {summary.bestGroup && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--c-teal-bg)' }}>
                  <Trophy className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-teal)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-dim">أفضل مجموعة اليوم</div>
                    <div className="text-sm font-bold text-app">مجموعة {summary.bestGroup.group}</div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--c-teal)' }}>{summary.bestGroup.avgToday}%</span>
                </div>
              )}
              {summary.mostLagging && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--st-late-bg)' }}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--st-late)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-dim">بحاجة متابعة عاجلة</div>
                    <div className="text-sm font-bold text-app truncate">{summary.mostLagging.student.name}</div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--st-late)' }}>{summary.mostLagging.todayPercentage}%</span>
                </div>
              )}
              {summary.avgRating > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--c-amber-bg)' }}>
                  <Star className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-amber)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-dim">متوسط تقييم المشرفين</div>
                    <div className="text-sm font-bold text-app">{summary.avgRating} / 5</div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--c-amber)' }}>{summary.totalRated} تقييم</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick student table preview */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
              <h3 className="text-lg font-bold text-app flex items-center gap-2"><Activity className="w-5 h-5" style={{ color: 'var(--accent)' }} /> أحدث 10 طلاب</h3>
              <button onClick={() => setActiveTab('students')} className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                عرض الكل <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
            <StudentTable rows={filteredRows.slice(0, 10)} onSelect={setSelectedStudent} onWhatsApp={handleWhatsApp} statusBadge={statusBadge} rankBadge={rankBadge} compact />
          </div>
        </motion.div>
      )}

      {/* === Students Tab === */}
      {activeTab === 'students' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Filters */}
          <div className="glass-card rounded-2xl p-4 flex items-center gap-3 flex-wrap no-print">
            <Filter className="w-5 h-5 text-dim flex-shrink-0" />
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="w-full rounded-xl py-2 pr-9 pl-3 text-sm text-app focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} />
            </div>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-xl py-2 px-3 text-sm text-app focus-accent border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
              <option value="all">كل المجموعات</option>
              {groups.map((g) => <option key={g} value={g}>مجموعة {g}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl py-2 px-3 text-sm text-app focus-accent border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
              <option value="all">كل الحالات</option>
              <option value="completed">مكتمل</option>
              <option value="partial">جاري</option>
              <option value="late">متأخر</option>
            </select>
            <span className="text-sm text-dim">{filteredRows.length} طالب</span>
          </div>

          {/* Full table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-dim text-xs border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <th className="text-right p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('rank')}>
                      <span className="flex items-center gap-1"># {sortField === 'rank' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-right p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('name')}>
                      <span className="flex items-center gap-1">الطالب {sortField === 'name' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-center p-3 font-medium">المجموعة</th>
                    <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('today')}>
                      <span className="flex items-center gap-1 justify-center">إنجاز اليوم {sortField === 'today' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('overall')}>
                      <span className="flex items-center gap-1 justify-center">الإنجاز الكلي {sortField === 'overall' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('streak')}>
                      <span className="flex items-center gap-1 justify-center">التتابع {sortField === 'streak' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-center p-3 font-medium">نسبة الحضور</th>
                    <th className="text-center p-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('rating')}>
                      <span className="flex items-center gap-1 justify-center">التقييم {sortField === 'rating' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}</span>
                    </th>
                    <th className="text-center p-3 font-medium">الحالة</th>
                    <th className="text-center p-3 font-medium no-print">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const badge = statusBadge(r.status);
                    const rk = rankBadge(r.rank);
                    return (
                      <tr key={r.student.id} className="border-b transition-colors cursor-pointer" style={{ borderColor: 'var(--border-soft)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => setSelectedStudent(r)}>
                        <td className="p-3">
                          {rk ? (
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: rk.bg, color: rk.color }}>
                              <rk.icon className="w-4 h-4" />
                            </div>
                          ) : (
                            <span className="text-dim tabular-nums text-sm">{r.rank}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-app">{r.student.name}</div>
                          <div className="text-[11px] text-dim">{r.student.phone}</div>
                        </td>
                        <td className="p-3 text-center"><span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>{r.student.group}</span></td>
                        <td className="p-3"><div className="flex items-center gap-2 min-w-[110px]"><ProgressBar percentage={r.todayPercentage} height={5} /><span className="text-[11px] text-dim tabular-nums whitespace-nowrap">{r.todayCompleted}/{r.todayTotal}</span></div></td>
                        <td className="p-3"><div className="flex items-center gap-2 min-w-[110px]"><ProgressBar percentage={r.overallPercentage} height={5} /><span className="text-[11px] text-dim tabular-nums whitespace-nowrap">{r.overallPercentage}%</span></div></td>
                        <td className="p-3 text-center"><span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: r.streak > 0 ? 'var(--c-amber)' : 'var(--text-muted)' }}><Flame className="w-3.5 h-3.5" />{r.streak}</span></td>
                        <td className="p-3 text-center">{(() => { const att = getAttendanceStats(r.student.id); const rate = att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : null; return rate !== null ? <span className="text-xs font-bold tabular-nums" style={{ color: rate >= 80 ? 'var(--c-teal)' : rate >= 60 ? 'var(--c-amber)' : 'var(--c-rose)' }}>📅 {rate}%</span> : <span className="text-dim text-xs">—</span>; })()}</td>
                        <td className="p-3 text-center">{r.avgRating > 0 ? <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--c-amber)' }}><Star className="w-3.5 h-3.5 fill-current" />{r.avgRating}</span> : <span className="text-dim text-xs">—</span>}</td>
                        <td className="p-3 text-center"><span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: badge.color, background: badge.bg }}><badge.icon className="w-3.5 h-3.5" /> {badge.label}</span></td>
                        <td className="p-3 text-center no-print" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleWhatsApp(r)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" title="واتساب" style={{ background: 'var(--st-done-bg)', color: 'var(--st-done)' }}><MessageCircle className="w-4 h-4" /></button>
                            <button onClick={() => handleTelegram(r)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" title={r.student.telegramHandle ? 'تيليجرام' : 'نسخ رسالة تيليجرام'} style={{ background: 'var(--c-sky-bg)', color: 'var(--c-sky)' }}><Send className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* === Groups Tab === */}
      {activeTab === 'groups' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fullReport.groupReports.map((g, i) => (
              <motion.div key={g.group} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass-card rounded-2xl p-5 hover-lift">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-extrabold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{g.group}</div>
                    <div>
                      <div className="font-bold text-app">مجموعة {g.group}</div>
                      <div className="text-xs text-dim">{g.totalStudents} طالب</div>
                    </div>
                  </div>
                  {fullReport.summary.bestGroup?.group === g.group && <Crown className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5"><span className="text-dim">متوسط اليوم</span><span className="font-bold text-app tabular-nums">{g.avgToday}%</span></div>
                    <ProgressBar percentage={g.avgToday} height={6} colorVar="--c-teal" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5"><span className="text-dim">متوسط كلي</span><span className="font-bold text-app tabular-nums">{g.avgOverall}%</span></div>
                    <ProgressBar percentage={g.avgOverall} height={6} colorVar="--c-sky" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="text-center p-2 rounded-xl" style={{ background: 'var(--st-done-bg)' }}><div className="text-lg font-bold tabular-nums" style={{ color: 'var(--st-done)' }}>{g.completedToday}</div><div className="text-[10px] text-dim">مكتمل</div></div>
                    <div className="text-center p-2 rounded-xl" style={{ background: 'var(--st-prog-bg)' }}><div className="text-lg font-bold tabular-nums" style={{ color: 'var(--st-prog)' }}>{g.partialToday}</div><div className="text-[10px] text-dim">جاري</div></div>
                    <div className="text-center p-2 rounded-xl" style={{ background: 'var(--st-late-bg)' }}><div className="text-lg font-bold tabular-nums" style={{ color: 'var(--st-late)' }}>{g.lateToday}</div><div className="text-[10px] text-dim">متأخر</div></div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Group comparison table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b" style={{ borderColor: 'var(--border-soft)' }}><h3 className="text-lg font-bold text-app flex items-center gap-2"><BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }} /> مقارنة المجموعات</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-dim text-xs border-b" style={{ borderColor: 'var(--border-soft)' }}><th className="text-right p-3 font-medium">المجموعة</th><th className="text-center p-3 font-medium">عدد الطلاب</th><th className="text-center p-3 font-medium">متوسط اليوم</th><th className="text-center p-3 font-medium">متوسط الكلي</th><th className="text-center p-3 font-medium">مكتمل</th><th className="text-center p-3 font-medium">جاري</th><th className="text-center p-3 font-medium">متأخر</th></tr></thead>
                <tbody>
                  {[...fullReport.groupReports].sort((a, b) => b.avgToday - a.avgToday).map((g) => (
                    <tr key={g.group} className="border-b transition-colors" style={{ borderColor: 'var(--border-soft)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td className="p-3 font-bold text-app">مجموعة {g.group}</td>
                      <td className="p-3 text-center text-sub tabular-nums">{g.totalStudents}</td>
                      <td className="p-3"><div className="flex items-center gap-2 min-w-[100px]"><ProgressBar percentage={g.avgToday} height={5} colorVar="--c-teal" /><span className="text-xs text-dim tabular-nums">{g.avgToday}%</span></div></td>
                      <td className="p-3"><div className="flex items-center gap-2 min-w-[100px]"><ProgressBar percentage={g.avgOverall} height={5} colorVar="--c-sky" /><span className="text-xs text-dim tabular-nums">{g.avgOverall}%</span></div></td>
                      <td className="p-3 text-center font-bold tabular-nums" style={{ color: 'var(--st-done)' }}>{g.completedToday}</td>
                      <td className="p-3 text-center font-bold tabular-nums" style={{ color: 'var(--st-prog)' }}>{g.partialToday}</td>
                      <td className="p-3 text-center font-bold tabular-nums" style={{ color: 'var(--st-late)' }}>{g.lateToday}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* === Trends Tab === */}
      {activeTab === 'trends' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Day-by-day completion chart */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-lg font-bold text-app flex items-center gap-2 mb-5"><TrendingUp className="w-5 h-5" style={{ color: 'var(--accent)' }} /> معدل الإنجاز اليومي عبر البرنامج</h3>
            <div className="flex items-end gap-1.5 h-48 overflow-x-auto pb-2">
              {fullReport.dayReports.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1.5 flex-shrink-0 group" style={{ width: '32px' }}>
                  <span className="text-[10px] font-bold text-dim opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{d.completionRate}%</span>
                  <div className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 cursor-pointer relative" style={{ height: `${Math.max(d.completionRate, 2)}%`, background: d.completionRate >= 75 ? 'var(--st-done)' : d.completionRate >= 50 ? 'var(--c-sky)' : d.completionRate >= 25 ? 'var(--st-prog)' : 'var(--st-late)', minHeight: '4px' }} title={`يوم ${d.day}: ${d.completionRate}%`} />
                  <span className="text-[9px] text-dim tabular-nums">{d.day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'var(--st-done)' }} /> ≥75%</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'var(--c-sky)' }} /> 50-74%</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'var(--st-prog)' }} /> 25-49%</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: 'var(--st-late)' }} /> {'<25%'}</span>
            </div>
          </div>

          {/* Day stats table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b" style={{ borderColor: 'var(--border-soft)' }}><h3 className="text-lg font-bold text-app flex items-center gap-2"><Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} /> إحصائيات يومية تفصيلية</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-dim text-xs border-b" style={{ borderColor: 'var(--border-soft)' }}><th className="text-right p-3 font-medium">اليوم</th><th className="text-center p-3 font-medium">عدد المهام</th><th className="text-center p-3 font-medium">إجمالي الإنجازات</th><th className="text-center p-3 font-medium">المعدل</th><th className="text-center p-3 font-medium">الرسم البياني</th></tr></thead>
                <tbody>
                  {fullReport.dayReports.map((d) => (
                    <tr key={d.day} className="border-b transition-colors" style={{ borderColor: 'var(--border-soft)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td className="p-3 font-bold text-app">يوم {d.day}{d.day === currentDay && <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>اليوم</span>}</td>
                      <td className="p-3 text-center text-sub tabular-nums">{d.totalTasks}</td>
                      <td className="p-3 text-center text-sub tabular-nums">{d.totalCompletions}/{d.maxCompletions}</td>
                      <td className="p-3 text-center font-bold tabular-nums" style={{ color: d.completionRate >= 75 ? 'var(--st-done)' : d.completionRate >= 50 ? 'var(--c-sky)' : d.completionRate >= 25 ? 'var(--st-prog)' : 'var(--st-late)' }}>{d.completionRate}%</td>
                      <td className="p-3"><div className="min-w-[120px]"><ProgressBar percentage={d.completionRate} height={6} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* === Rankings Tab === */}
      {activeTab === 'rankings' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 10 overall */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-lg font-bold text-app flex items-center gap-2 mb-4"><Crown className="w-5 h-5" style={{ color: 'var(--c-amber)' }} /> الأعلى التزاماً (كلي)</h3>
              <div className="space-y-2">
                {fullReport.rows.slice(0, 10).map((r, idx) => {
                  const rk = rankBadge(idx + 1);
                  return (
                    <div key={r.student.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer hover:bg-hover-soft" onClick={() => setSelectedStudent(r)}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={rk ? { background: rk.bg, color: rk.color } : { background: 'var(--bg-soft)', color: 'var(--text-muted)' }}>{idx + 1}</div>
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium text-app truncate">{r.student.name}</div><div className="text-[10px] text-dim">مجموعة {r.student.group}</div></div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{r.overallPercentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top streaks */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-lg font-bold text-app flex items-center gap-2 mb-4"><Flame className="w-5 h-5" style={{ color: 'var(--c-amber)' }} /> أطول سلسلة متتالية</h3>
              <div className="space-y-2">
                {[...fullReport.rows].sort((a, b) => b.streak - a.streak).slice(0, 10).map((r, idx) => (
                  <div key={r.student.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer hover:bg-hover-soft" onClick={() => setSelectedStudent(r)}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)' }}>{idx + 1}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-app truncate">{r.student.name}</div><div className="text-[10px] text-dim">مجموعة {r.student.group}</div></div>
                    <span className="text-sm font-bold tabular-nums flex items-center gap-1" style={{ color: 'var(--c-amber)' }}><Flame className="w-3.5 h-3.5" />{r.streak}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top rated */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-lg font-bold text-app flex items-center gap-2 mb-4"><Star className="w-5 h-5" style={{ color: 'var(--c-amber)' }} /> الأعلى تقييماً</h3>
              <div className="space-y-2">
                {[...fullReport.rows].filter((r) => r.avgRating > 0).sort((a, b) => b.avgRating - a.avgRating).slice(0, 10).map((r, idx) => (
                  <div key={r.student.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer hover:bg-hover-soft" onClick={() => setSelectedStudent(r)}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)' }}>{idx + 1}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-app truncate">{r.student.name}</div><div className="text-[10px] text-dim">{r.ratedCount} تقييم</div></div>
                    <span className="text-sm font-bold tabular-nums flex items-center gap-1" style={{ color: 'var(--c-amber)' }}><Star className="w-3.5 h-3.5 fill-current" />{r.avgRating}</span>
                  </div>
                ))}
                {fullReport.rows.filter((r) => r.avgRating > 0).length === 0 && <div className="text-center py-6 text-dim text-sm">لا توجد تقييمات بعد</div>}
              </div>
            </div>

            {/* Needs attention */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-lg font-bold text-app flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5" style={{ color: 'var(--st-late)' }} /> بحاجة متابعة عاجلة</h3>
              <div className="space-y-2">
                {[...fullReport.rows].filter((r) => r.status !== 'completed').sort((a, b) => a.todayPercentage - b.todayPercentage).slice(0, 10).map((r, idx) => (
                  <div key={r.student.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer hover:bg-hover-soft" onClick={() => setSelectedStudent(r)}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--st-late-bg)', color: 'var(--st-late)' }}>{idx + 1}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-app truncate">{r.student.name}</div><div className="text-[10px] text-dim">مجموعة {r.student.group}</div></div>
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--st-late)' }}>{r.todayPercentage}%</span>
                  </div>
                ))}
                {fullReport.rows.filter((r) => r.status !== 'completed').length === 0 && <div className="text-center py-6 text-dim text-sm"><CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--st-done)' }} /> جميع الطلاب منضبطون!</div>}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* === Attendance Tab === */}
      {activeTab === 'attendance' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(() => {
              const allAtt = fullReport.rows.map((r) => getAttendanceStats(r.student.id));
              const totalPresent = allAtt.reduce((s, a) => s + a.present, 0);
              const totalLate = allAtt.reduce((s, a) => s + a.late, 0);
              const totalAbsent = allAtt.reduce((s, a) => s + a.absent, 0);
              const totalExcused = allAtt.reduce((s, a) => s + a.excused, 0);
              return [
                { label: 'حضور', value: totalPresent, color: '--c-teal' },
                { label: 'متأخر', value: totalLate, color: '--c-amber' },
                { label: 'غياب', value: totalAbsent, color: '--c-rose' },
                { label: 'بعذر', value: totalExcused, color: '--c-sky' },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
                  <div className="text-2xl font-extrabold tabular-nums" style={{ color: `var(${s.color})` }}>{s.value}</div>
                  <div className="text-xs text-dim mt-1">{s.label} (إجمالي)</div>
                </div>
              ));
            })()}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}>
                    <th className="p-4 text-xs text-dim font-medium">الطالب</th>
                    <th className="p-4 text-xs text-dim font-medium text-center">حضور</th>
                    <th className="p-4 text-xs text-dim font-medium text-center">متأخر</th>
                    <th className="p-4 text-xs text-dim font-medium text-center">غياب</th>
                    <th className="p-4 text-xs text-dim font-medium text-center">بعذر</th>
                    <th className="p-4 text-xs text-dim font-medium text-center">معدل الحضور</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const att = getAttendanceStats(r.student.id);
                    const attended = att.present + att.late;
                    const total = att.total;
                    const rate = total > 0 ? Math.round((attended / total) * 100) : null;
                    const rateColor = rate === null ? 'var(--text-muted)' : rate >= 80 ? 'var(--c-teal)' : rate >= 60 ? 'var(--c-amber)' : 'var(--c-rose)';
                    return (
                      <tr key={r.student.id} className="border-b transition-colors hover:bg-hover-soft" style={{ borderColor: 'var(--border-soft)' }}>
                        <td className="p-4">
                          <div className="text-sm font-medium text-app">{r.student.name}</div>
                          <div className="text-[11px] text-dim">مجموعة {r.student.group}</div>
                        </td>
                        <td className="p-4 text-center"><span className="text-sm font-bold" style={{ color: 'var(--c-teal)' }}>{att.present}</span></td>
                        <td className="p-4 text-center"><span className="text-sm font-bold" style={{ color: 'var(--c-amber)' }}>{att.late}</span></td>
                        <td className="p-4 text-center"><span className="text-sm font-bold" style={{ color: 'var(--c-rose)' }}>{att.absent}</span></td>
                        <td className="p-4 text-center"><span className="text-sm font-bold" style={{ color: 'var(--c-sky)' }}>{att.excused}</span></td>
                        <td className="p-4 text-center">
                          {rate !== null ? (
                            <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ color: rateColor, background: rateColor.replace(')', '-bg)').replace('var(', 'var(') }}>{rate}%</span>
                          ) : <span className="text-xs text-dim">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* === Custom Report Modal === */}
      <AnimatePresence>
        {showCustomReport && <CustomReportModal onClose={() => setShowCustomReport(false)} rows={filteredRows} programName={programName} currentDay={currentDay} />}
      </AnimatePresence>

      {/* === Student Detail Modal === */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDetailModal row={selectedStudent} currentDay={currentDay} programName={programName} onClose={() => setSelectedStudent(null)} onWhatsApp={handleWhatsApp} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// === Student Table Component ===
function StudentTable({
  rows, onSelect, onWhatsApp, statusBadge, rankBadge, compact,
}: {
  rows: StudentReportRow[];
  onSelect: (r: StudentReportRow) => void;
  onWhatsApp: (r: StudentReportRow) => void;
  statusBadge: (s: string) => { label: string; color: string; bg: string; icon: typeof CheckCircle2 };
  rankBadge: (r: number) => { bg: string; color: string; icon: typeof Crown } | null;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead><tr className="text-dim text-xs border-b" style={{ borderColor: 'var(--border-soft)' }}><th className="text-right p-3 font-medium">#</th><th className="text-right p-3 font-medium">الطالب</th><th className="text-center p-3 font-medium">إنجاز اليوم</th>{!compact && <th className="text-center p-3 font-medium">الكلي</th>}<th className="text-center p-3 font-medium">الحالة</th><th className="text-center p-3 font-medium no-print">تواصل</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const badge = statusBadge(r.status);
            const rk = rankBadge(r.rank);
            return (
              <tr key={r.student.id} className="border-b transition-colors cursor-pointer" style={{ borderColor: 'var(--border-soft)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => onSelect(r)}>
                <td className="p-3">{rk ? <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: rk.bg, color: rk.color }}><rk.icon className="w-3.5 h-3.5" /></div> : <span className="text-dim tabular-nums">{r.rank}</span>}</td>
                <td className="p-3"><div className="font-medium text-app">{r.student.name}</div><div className="text-[11px] text-dim">{r.student.group}</div></td>
                <td className="p-3"><div className="flex items-center gap-2 min-w-[100px]"><ProgressBar percentage={r.todayPercentage} height={5} /><span className="text-[11px] text-dim tabular-nums whitespace-nowrap">{r.todayPercentage}%</span></div></td>
                {!compact && <td className="p-3"><div className="flex items-center gap-2 min-w-[100px]"><ProgressBar percentage={r.overallPercentage} height={5} /><span className="text-[11px] text-dim tabular-nums whitespace-nowrap">{r.overallPercentage}%</span></div></td>}
                <td className="p-3 text-center"><span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: badge.color, background: badge.bg }}><badge.icon className="w-3.5 h-3.5" /> {badge.label}</span></td>
                <td className="p-3 text-center no-print" onClick={(e) => e.stopPropagation()}><button onClick={() => onWhatsApp(r)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'var(--st-done-bg)', color: 'var(--st-done)' }}><MessageCircle className="w-4 h-4" /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// === Student Detail Modal ===
function StudentDetailModal({
  row, currentDay, programName, onClose, onWhatsApp,
}: {
  row: StudentReportRow;
  currentDay: number;
  programName: string;
  onClose: () => void;
  onWhatsApp: (r: StudentReportRow) => void;
}) {
  const badge = row.status === 'completed' ? { label: 'مكتمل', color: 'var(--st-done)', bg: 'var(--st-done-bg)' } : row.status === 'partial' ? { label: 'جاري', color: 'var(--st-prog)', bg: 'var(--st-prog-bg)' } : { label: 'متأخر', color: 'var(--st-late)', bg: 'var(--st-late-bg)' };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm no-print" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none no-print">
        <div className="solid-card rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto pointer-events-auto">
          {/* Header */}
          <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{row.student.name.charAt(0)}</div>
              <div>
                <h3 className="text-lg font-bold text-app">{row.student.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>مجموعة {row.student.group}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span>
                  <span className="text-[11px] text-dim">ترتيب #{row.rank}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
          </div>

          {/* Stats grid */}
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'إنجاز اليوم', value: `${row.todayPercentage}%`, sub: `${row.todayCompleted}/${row.todayTotal}`, cv: '--c-teal' },
              { label: 'الإنجاز الكلي', value: `${row.overallPercentage}%`, sub: `${row.overallCompleted}/${row.overallTotal}`, cv: '--c-sky' },
              { label: 'الأيام المتتالية', value: row.streak, sub: 'يوم', cv: '--c-amber', icon: Flame },
              { label: 'متوسط التقييم', value: row.avgRating || '—', sub: `${row.ratedCount} تقييم`, cv: '--c-amber', icon: Star },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-3 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                <div className="text-[10px] text-dim mb-1">{s.label}</div>
                <div className="text-xl font-extrabold tabular-nums flex items-center gap-1" style={{ color: `var(${s.cv})` }}>{s.icon && <s.icon className="w-4 h-4" />}{s.value}</div>
                <div className="text-[10px] text-dim mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Daily breakdown heatmap */}
          <div className="px-5 pb-5">
            <h4 className="text-sm font-bold text-sub mb-3">سجل الإنجاز اليومي</h4>
            <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
              {row.dailyBreakdown.map((d) => {
                const c = d.percentage === 100 ? 'var(--st-done)' : d.percentage >= 50 ? 'var(--c-sky)' : d.percentage > 0 ? 'var(--st-prog)' : 'var(--st-late)';
                return (
                  <div key={d.day} className="aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold cursor-pointer transition-transform hover:scale-110" style={{ background: d.percentage > 0 ? c : 'var(--bg-soft)', color: d.percentage > 0 ? 'var(--bg-base)' : 'var(--text-muted)' }} title={`يوم ${d.day}: ${d.completed}/${d.total} (${d.percentage}%)`}>
                    {d.day}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-dim">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--st-done)' }} /> 100%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--c-sky)' }} /> ≥50%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--st-prog)' }} /> {'<50%'}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--st-late)' }} /> 0%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 border-t flex items-center gap-2" style={{ borderColor: 'var(--border-soft)' }}>
            <button onClick={() => onWhatsApp(row)} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:scale-[1.02]" style={{ background: 'var(--st-done)', color: 'var(--bg-base)' }}>
              <MessageCircle className="w-4 h-4" /> إرسال التقرير عبر واتساب
            </button>
            <a href={`https://t.me/${row.student.telegramHandle?.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition-all hover:scale-[1.02] border" style={{ background: 'var(--c-sky-bg)', color: 'var(--c-sky)', borderColor: 'var(--c-sky-bd)' }}>
              <Send className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// === Custom Report Modal ===
function CustomReportModal({
  onClose, rows, programName, currentDay,
}: {
  onClose: () => void;
  rows: StudentReportRow[];
  programName: string;
  currentDay: number;
}) {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [includeStudentDetails, setIncludeStudentDetails] = useState(true);
  const [includeGroupSummary, setIncludeGroupSummary] = useState(true);
  const [includeDailyBreakdown, setIncludeDailyBreakdown] = useState(false);
  const [includeRankings, setIncludeRankings] = useState(true);

  const typeLabels: Record<typeof reportType, string> = {
    daily: 'تقرير يومي',
    weekly: 'تقرير أسبوعي',
    monthly: 'تقرير شهري',
    custom: 'تقرير مخصص',
  };

  const handleExport = () => {
    const config: CustomReportConfig = {
      title: typeLabels[reportType],
      type: reportType,
      includeStudentDetails,
      includeGroupSummary,
      includeDailyBreakdown,
      includeRankings,
    };

    const reportStudents = rows.map((r) => ({
      name: r.student.name,
      group: r.student.group,
      phone: r.student.phone,
      username: '',
      password: '',
      overallPercentage: r.overallPercentage,
      todayPercentage: r.todayPercentage,
      completedTasks: r.overallCompleted,
      totalTasks: r.overallTotal,
      streak: r.streak,
      avgRating: r.avgRating,
      status: r.status,
      dailyBreakdown: r.dailyBreakdown,
    }));

    exportCustomReportPDF(reportStudents, config, programName, currentDay);
    onClose();
  };

  const reportTypes = [
    { id: 'daily' as const, label: 'يومي', icon: Calendar, desc: 'حالة اليوم' },
    { id: 'weekly' as const, label: 'أسبوعي', icon: CalendarRange, desc: 'آخر 7 أيام' },
    { id: 'monthly' as const, label: 'شهري', icon: FileText, desc: 'كامل الشهر' },
    { id: 'custom' as const, label: 'مخصص', icon: FileType, desc: 'اختر الأقسام' },
  ];

  const sections = [
    { key: 'includeStudentDetails', label: 'تفاصيل الطلاب', desc: 'جدول بكل الطلاب وإنجازهم' },
    { key: 'includeGroupSummary', label: 'ملخص المجموعات', desc: 'متوسطات كل مجموعة' },
    { key: 'includeRankings', label: 'الترتيب', desc: 'أعلى 10 طلاب' },
    { key: 'includeDailyBreakdown', label: 'سجل يومي تفصيلي', desc: 'رسم بياني لكل يوم' },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm no-print" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none no-print">
        <div className="solid-card rounded-3xl w-full max-w-lg pointer-events-auto max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
            <h3 className="text-lg font-bold text-app flex items-center gap-2">
              <FileType className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              تقرير PDF مخصص
            </h3>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Report type */}
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">نوع التقرير</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {reportTypes.map((t) => (
                  <button key={t.id} onClick={() => setReportType(t.id)} className="flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs transition-all duration-300" style={reportType === t.id ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
                    <t.icon className="w-5 h-5" />
                    <span className="font-medium">{t.label}</span>
                    <span className="text-[10px] text-dim">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">الأقسام المضمنة</label>
              <div className="space-y-2">
                {sections.map((s) => {
                  const checked = ({ includeStudentDetails, includeGroupSummary, includeRankings, includeDailyBreakdown } as Record<string, boolean>)[s.key];
                  return (
                    <button key={s.key} onClick={() => {
                      if (s.key === 'includeStudentDetails') setIncludeStudentDetails(!includeStudentDetails);
                      if (s.key === 'includeGroupSummary') setIncludeGroupSummary(!includeGroupSummary);
                      if (s.key === 'includeRankings') setIncludeRankings(!includeRankings);
                      if (s.key === 'includeDailyBreakdown') setIncludeDailyBreakdown(!includeDailyBreakdown);
                    }} className="w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-right" style={{ background: checked ? 'var(--accent-soft)' : 'var(--bg-soft)', borderColor: checked ? 'var(--accent-border)' : 'var(--border-soft)' }}>
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: checked ? 'var(--accent)' : 'var(--bg-input)', border: '1px solid var(--border)' }}>
                        {checked && <Check className="w-3.5 h-3.5" style={{ color: 'var(--bg-base)' }} />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-app">{s.label}</div>
                        <div className="text-[11px] text-dim">{s.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl p-3 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
              <p className="text-xs text-dim">
                سيتم تصدير تقرير {typeLabels[reportType]} يتضمن {rows.length} طالب، كملف PDF متعدد الصفحات جاهز للطباعة.
              </p>
            </div>

            {/* Export button */}
            <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all duration-300" style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' }}>
              <Download className="w-5 h-5" /> تصدير PDF
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
