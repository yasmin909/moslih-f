import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users, TrendingUp, Award, Search, X,
  Phone, MessageCircle, Send, Star, ChevronUp, ChevronDown,
  Calendar, CheckCircle2, Target, Flame, ArrowLeft, Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { ProgressBar } from '../components/ProgressBar';
import { TASK_TYPE_META } from '../lib/types';

type Task = { id: string; day: number; group?: string };
type ProgressEntry = { studentId: string; taskId: string; status: string; supervisorRating?: number; supervisorNote?: string; submissionNote?: string; submissionLink?: string; audioDataUrl?: string; completedAt?: string };

function computeStreak(studentId: string, tasks: Task[], progress: ProgressEntry[], currentDay: number): number {
  const sp = progress.filter(p => p.studentId === studentId && p.status === 'completed' && !p.isBackdated);
  let streak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const dTasks = tasks.filter(t => t.day === d);
    if (dTasks.length === 0) continue;
    const allDone = dTasks.every(t => sp.some(p => p.taskId === t.id));
    if (allDone) streak++;
    else break;
  }
  return streak;
}

// ─── SVG line chart ────────────────────────────────────────────────────────────
function LineChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const W = 360, H = 90, PAD = 10;
  const pts = data.map((v, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: H - PAD - (v / 100) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
      <defs>
        <linearGradient id={`chart-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#chart-grad-${color.replace(/[^a-zA-Z0-9]/g, '')})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1" />
      ))}
    </svg>
  );
}

// ─── Attendance heatmap (last 30 days) ─────────────────────────────────────────
function AttendanceHeatmap({ studentId, attendance }: { studentId: string; attendance: { studentId: string; date: string; status: string }[] }) {
  const recMap = useMemo(() => {
    const m = new Map<string, string>();
    attendance.filter(a => a.studentId === studentId).forEach(a => m.set(a.date, a.status));
    return m;
  }, [studentId, attendance]);

  const days = useMemo(() => Array.from({ length: 35 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (34 - i));
    return d.toISOString().split('T')[0];
  }), []);

  const COLOR: Record<string, string> = {
    present: 'var(--c-teal)',
    late: 'var(--c-amber)',
    absent: 'var(--c-rose)',
    excused: 'var(--c-sky)',
  };
  const BG: Record<string, string> = {
    present: 'var(--c-teal-bg)',
    late: 'var(--c-amber-bg)',
    absent: 'var(--c-rose-bg)',
    excused: 'var(--c-sky-bg)',
  };
  const LABEL: Record<string, string> = { present: 'حضر', late: 'متأخر', absent: 'غائب', excused: 'معذور' };

  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map(day => {
          const st = recMap.get(day);
          return (
            <div
              key={day}
              title={`${day}${st ? `: ${LABEL[st]}` : ': غير مسجّل'}`}
              className="aspect-square rounded-md border transition-all"
              style={{
                background: st ? BG[st] : 'var(--bg-soft)',
                borderColor: st ? COLOR[st] + '55' : 'var(--border-soft)',
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {(['present', 'late', 'absent', 'excused'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border" style={{ background: BG[s], borderColor: COLOR[s] + '55' }} />
            <span className="text-[10px] text-dim">{LABEL[s]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }} />
          <span className="text-[10px] text-dim">غير مسجّل</span>
        </div>
      </div>
    </div>
  );
}

// ─── Full student dossier drawer ───────────────────────────────────────────────
function StudentDossier({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { data, getCurrentDay, getStudentProgress, getAttendanceStats } = useStore();
  const currentDay = getCurrentDay();
  const student = data.students.find(s => s.id === studentId)!;
  const progress = getStudentProgress(studentId);
  const attStats = getAttendanceStats(studentId);

  const dailyHistory = useMemo(() => Array.from({ length: currentDay }, (_, i) => {
    const d = i + 1;
    const tasks = data.tasks.filter(t => t.day === d);
    const done = tasks.filter(t => data.progress.some(p => p.taskId === t.id && p.studentId === studentId && p.status === 'completed')).length;
    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return { day: d, done, total: tasks.length, pct };
  }), [data.tasks, data.progress, studentId, currentDay]);

  const taskTypeBreakdown = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    data.tasks.forEach(task => {
      const done = data.progress.some(p => p.taskId === task.id && p.studentId === studentId && p.status === 'completed');
      const cur = m.get(task.type) ?? { done: 0, total: 0 };
      cur.total++;
      if (done) cur.done++;
      m.set(task.type, cur);
    });
    return Array.from(m.entries()).map(([type, s]) => ({
      type, done: s.done, total: s.total,
      pct: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
    }));
  }, [data.tasks, data.progress, studentId]);

  const ratings = useMemo(() =>
    data.progress.filter(p => p.studentId === studentId && (p.supervisorRating ?? 0) > 0),
    [data.progress, studentId]
  );

  const rank = useMemo(() => {
    const sorted = [...data.students]
      .map(s => ({ id: s.id, pct: getStudentProgress(s.id).percentage }))
      .sort((a, b) => b.pct - a.pct);
    return sorted.findIndex(s => s.id === studentId) + 1;
  }, [data.students, studentId]);

  const groupRank = useMemo(() => {
    const members = data.students.filter(s => s.group === student.group);
    const sorted = members
      .map(s => ({ id: s.id, pct: getStudentProgress(s.id).percentage }))
      .sort((a, b) => b.pct - a.pct);
    return { rank: sorted.findIndex(s => s.id === studentId) + 1, total: members.length };
  }, [data.students, studentId, student.group]);

  const attRate = attStats.total > 0
    ? Math.round(((attStats.present + attStats.late) / attStats.total) * 100)
    : null;
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + (r.supervisorRating ?? 0), 0) / ratings.length
    : null;

  const lineData = dailyHistory.map(d => d.pct);

  const whatsappUrl = `https://wa.me/${student.phone.replace(/\s+/g, '').replace(/^00963/, '963').replace(/^0/, '963')}`;
  const telegramUrl = student.telegramHandle ? `https://t.me/${student.telegramHandle.replace('@', '')}` : null;

  const attCv = attRate === null ? '--text-muted' : attRate >= 80 ? '--c-teal' : attRate >= 60 ? '--c-amber' : '--c-rose';

  const kpis = [
    { label: 'الإنجاز الكلي', value: `${progress.percentage}%`, sub: `${progress.completed}/${progress.total} مهمة`, cv: '--accent', icon: Target },
    { label: 'إنجاز اليوم', value: `${progress.todayPercentage}%`, sub: `${progress.todayCompleted}/${progress.todayTotal}`, cv: '--c-teal', icon: CheckCircle2 },
    { label: 'نسبة الحضور', value: attRate !== null ? `${attRate}%` : '—', sub: `${attStats.present + attStats.late}/${attStats.total} يوم`, cv: attCv, icon: Calendar },
    { label: 'التتابع', value: `${computeStreak(studentId, data.tasks, data.progress, currentDay)}`, sub: 'يوم متتالي', cv: '--c-amber', icon: Flame },
    { label: 'متوسط التقييم', value: avgRating !== null ? `${avgRating.toFixed(1)} ★` : '—', sub: `${ratings.length} تقييم`, cv: '--c-amber', icon: Star },
    { label: 'الترتيب البرنامج', value: `#${rank}`, sub: `مجموعته: ${groupRank.rank}/${groupRank.total}`, cv: '--c-sky', icon: Award },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto shadow-2xl"
        style={{ background: 'var(--bg-base)', borderLeft: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-5 pb-10">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-2xl flex-shrink-0"
                style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 0 24px -4px var(--accent-glow)' }}
              >
                {student.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-app">{student.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                    مجموعة {student.group}
                  </span>
                  <span className="text-[11px] text-dim flex items-center gap-1">
                    <Phone className="w-3 h-3" />{student.phone}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-xl border transition-all hover:scale-105"
                style={{ background: 'var(--c-emerald-bg)', borderColor: 'var(--c-emerald-bd)', color: 'var(--c-emerald)' }}>
                <MessageCircle className="w-4 h-4" />
              </a>
              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-xl border transition-all hover:scale-105"
                  style={{ background: 'var(--c-sky-bg)', borderColor: 'var(--c-sky-bd)', color: 'var(--c-sky)' }}>
                  <Send className="w-4 h-4" />
                </a>
              )}
              <button onClick={onClose}
                className="p-2 rounded-xl transition-all hover:scale-105"
                style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {kpis.map(({ label, value, sub, cv, icon: Icon }) => (
              <div key={label} className="glass-card rounded-2xl p-3.5 text-center">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2"
                  style={{ background: `color-mix(in srgb, var(${cv}) 14%, transparent)` }}>
                  <Icon className="w-4 h-4" style={{ color: `var(${cv})` }} />
                </div>
                <div className="text-xl font-extrabold tabular-nums leading-none" style={{ color: `var(${cv})` }}>{value}</div>
                <div className="text-[11px] font-semibold text-app mt-1">{label}</div>
                <div className="text-[10px] text-dim mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Daily line chart */}
          {lineData.length >= 2 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-app mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                منحنى الإنجاز اليومي
              </h3>
              <LineChart data={lineData} color="var(--accent)" />
              <div className="flex justify-between mt-1 text-[10px] text-dim">
                <span>يوم 1</span>
                <span>يوم {currentDay}</span>
              </div>
            </div>
          )}

          {/* Attendance heatmap */}
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-app mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              خريطة الحضور — آخر 5 أسابيع
            </h3>
            <AttendanceHeatmap studentId={studentId} attendance={data.attendance ?? []} />
          </div>

          {/* Task type breakdown */}
          {taskTypeBreakdown.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-app mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                الإنجاز حسب نوع المهمة
              </h3>
              <div className="space-y-3">
                {taskTypeBreakdown.map(({ type, done, total, pct }) => {
                  const meta = TASK_TYPE_META[type as keyof typeof TASK_TYPE_META];
                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-app flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: `var(${meta?.colorVar ?? '--accent'})` }} />
                          {meta?.label ?? type}
                        </span>
                        <span className="text-xs text-dim tabular-nums">{done}/{total} — {pct}%</span>
                      </div>
                      <ProgressBar percentage={pct} height={7} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily breakdown grid */}
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-app mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              سجل الأيام اليومي
            </h3>
            {dailyHistory.length === 0 ? (
              <p className="text-sm text-dim text-center py-4">لا توجد بيانات بعد</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-56 overflow-y-auto">
                {dailyHistory.map(({ day, done, total, pct }) => (
                  <div key={day}
                    className="rounded-xl p-2.5 text-center border"
                    style={{
                      background: pct === 100 ? 'var(--c-teal-bg)' : pct >= 50 ? 'var(--c-amber-bg)' : 'var(--bg-soft)',
                      borderColor: pct === 100 ? 'var(--c-teal-bd)' : pct >= 50 ? 'var(--c-amber-bd)' : 'var(--border-soft)',
                    }}>
                    <div className="text-[10px] text-dim">يوم {day}</div>
                    <div className="text-sm font-bold tabular-nums" style={{ color: pct === 100 ? 'var(--c-teal)' : pct >= 50 ? 'var(--c-amber)' : 'var(--text-secondary)' }}>{pct}%</div>
                    <div className="text-[10px] text-dim">{done}/{total}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ratings history */}
          {ratings.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-app mb-3 flex items-center gap-2">
                <Star className="w-4 h-4" style={{ color: 'var(--c-amber)' }} />
                سجل التقييمات ({ratings.length})
              </h3>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {ratings.map(r => {
                  const task = data.tasks.find(t => t.id === r.taskId);
                  return (
                    <div key={`${r.taskId}`}
                      className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                      <div className="flex gap-0.5 flex-shrink-0 mt-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className="w-3.5 h-3.5"
                            style={s <= (r.supervisorRating ?? 0)
                              ? { color: 'var(--c-amber)', fill: 'var(--c-amber)' }
                              : { color: 'var(--border)' }} />
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-app truncate">{task?.title ?? 'مهمة'}</p>
                        <p className="text-[10px] text-dim">يوم {task?.day ?? '—'}</p>
                        {r.supervisorNote && (
                          <p className="text-[11px] text-sub mt-1 leading-snug">{r.supervisorNote}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Group comparison */}
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-app mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              مقارنة داخل المجموعة {student.group}
            </h3>
            <div className="space-y-2.5">
              {data.students
                .filter(s => s.group === student.group)
                .map(s => {
                  const p = getStudentProgress(s.id);
                  const isMe = s.id === studentId;
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className={`text-[11px] w-24 truncate font-medium ${isMe ? 'text-accent' : 'text-sub'}`}>
                        {isMe ? '▶ ' : ''}{s.name}
                      </span>
                      <div className="flex-1">
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${p.percentage}%`, background: isMe ? 'var(--accent)' : 'var(--border)' }} />
                        </div>
                      </div>
                      <span className={`text-[11px] tabular-nums w-10 text-left ${isMe ? 'font-bold text-accent' : 'text-dim'}`}>
                        {p.percentage}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      </motion.div>
    </>
  );
}

// ─── Main Analytics page ───────────────────────────────────────────────────────
export function Analytics() {
  const { data, getCurrentDay, getStudentProgress, getAttendanceStats } = useStore();
  const currentDay = getCurrentDay();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'overall' | 'today' | 'attendance' | 'streak' | 'name'>('overall');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => [...new Set(data.students.map(s => s.group))].sort(), [data.students]);

  const studentStats = useMemo(() => data.students.map(s => {
    const prog = getStudentProgress(s.id);
    const att = getAttendanceStats(s.id);
    const attRate = att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : null;
    const ratedProgs = data.progress.filter(p => p.studentId === s.id && (p.supervisorRating ?? 0) > 0);
    const avgRating = ratedProgs.length > 0
      ? ratedProgs.reduce((sum, p) => sum + (p.supervisorRating ?? 0), 0) / ratedProgs.length
      : null;
    const streak = computeStreak(s.id, data.tasks, data.progress, currentDay);
    return { student: s, prog, att, attRate, avgRating, streak };
  }), [data.students, data.tasks, data.progress, currentDay]);

  const filtered = useMemo(() => {
    let list = studentStats.filter(({ student }) => {
      const matchName = search === '' || student.name.includes(search);
      const matchGroup = groupFilter === 'all' || student.group === groupFilter;
      return matchName && matchGroup;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        const r = a.student.name.localeCompare(b.student.name, 'ar');
        return sortDir === 'asc' ? r : -r;
      }
      let av = 0, bv = 0;
      if (sortBy === 'overall') { av = a.prog.percentage; bv = b.prog.percentage; }
      else if (sortBy === 'today') { av = a.prog.todayPercentage; bv = b.prog.todayPercentage; }
      else if (sortBy === 'attendance') { av = a.attRate ?? -1; bv = b.attRate ?? -1; }
      else if (sortBy === 'streak') { av = a.streak; bv = b.streak; }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [studentStats, search, groupFilter, sortBy, sortDir]);

  const summary = useMemo(() => {
    if (studentStats.length === 0) return null;
    const avgOverall = Math.round(studentStats.reduce((s, r) => s + r.prog.percentage, 0) / studentStats.length);
    const avgToday = Math.round(studentStats.reduce((s, r) => s + r.prog.todayPercentage, 0) / studentStats.length);
    const completedToday = studentStats.filter(r => r.prog.todayPercentage === 100).length;
    const ratesArr = studentStats.filter(r => r.attRate !== null).map(r => r.attRate!);
    const avgAtt = ratesArr.length > 0 ? Math.round(ratesArr.reduce((s, v) => s + v, 0) / ratesArr.length) : null;
    const top = [...studentStats].sort((a, b) => b.prog.percentage - a.prog.percentage)[0];
    return { avgOverall, avgToday, completedToday, avgAtt, top };
  }, [studentStats]);

  const groupStats = useMemo(() => groups.map(g => {
    const members = studentStats.filter(r => r.student.group === g);
    const avg = members.length > 0 ? Math.round(members.reduce((s, r) => s + r.prog.percentage, 0) / members.length) : 0;
    const avgT = members.length > 0 ? Math.round(members.reduce((s, r) => s + r.prog.todayPercentage, 0) / members.length) : 0;
    return { group: g, count: members.length, avg, avgT };
  }).sort((a, b) => b.avg - a.avg), [groups, studentStats]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-extrabold text-app tracking-tight">تحليل البيانات</h1>
        <p className="text-sm text-dim mt-1">اضبارة شاملة لكل طالب — اليوم {currentDay} من البرنامج</p>
      </div>

      {/* Day-1 empty state — students exist but no data recorded yet */}
      {data.students.length > 0 && data.progress.length === 0 && (data.attendance ?? []).length === 0 && (
        <div className="glass-card rounded-2xl p-8 text-center border" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-soft)', border: '1.5px solid var(--accent-border)' }}>
            <Zap className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="font-bold text-app text-base mb-1">البرنامج جاهز للانطلاق</p>
          <p className="text-sm text-dim max-w-sm mx-auto">ستظهر هنا إحصاءات الطلاب وتحليلاتهم بمجرد تسجيل أول يوم حضور وإنجاز.</p>
        </div>
      )}

      {/* Program-wide KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'متوسط الإنجاز الكلي', value: `${summary.avgOverall}%`, icon: Target, cv: '--accent' },
            { label: 'متوسط اليوم', value: `${summary.avgToday}%`, icon: TrendingUp, cv: '--c-teal' },
            { label: 'أكملوا اليوم', value: `${summary.completedToday}/${studentStats.length}`, icon: CheckCircle2, cv: '--c-emerald' },
            { label: 'متوسط الحضور', value: summary.avgAtt !== null ? `${summary.avgAtt}%` : '—', icon: Calendar, cv: '--c-sky' },
          ].map(({ label, value, icon: Icon, cv }) => (
            <div key={label} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, var(${cv}) 14%, transparent)` }}>
                <Icon className="w-5 h-5" style={{ color: `var(${cv})` }} />
              </div>
              <div>
                <div className="text-xl font-extrabold tabular-nums leading-none" style={{ color: `var(${cv})` }}>{value}</div>
                <div className="text-[11px] text-dim mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group performance */}
      {groupStats.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-bold text-app mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            أداء المجموعات مقارنةً
          </h2>
          <div className="space-y-3.5">
            {groupStats.map(({ group, count, avg, avgT }) => (
              <div key={group}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-app">
                    مجموعة {group}
                    <span className="text-dim text-xs font-normal mr-1">({count} طالب)</span>
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-dim">كلي: <strong className="text-app">{avg}%</strong></span>
                    <span style={{ color: 'var(--c-teal)' }}>اليوم: <strong>{avgT}%</strong></span>
                  </div>
                </div>
                <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: `${avg}%`, background: 'var(--accent)', opacity: 0.85 }} />
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: `${avgT}%`, background: 'var(--c-teal)', opacity: 0.5 }} />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ background: 'var(--accent)', opacity: 0.85 }} />
                <span className="text-[10px] text-dim">الإنجاز الكلي</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ background: 'var(--c-teal)', opacity: 0.5 }} />
                <span className="text-[10px] text-dim">إنجاز اليوم</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top performer callout */}
      {summary?.top && (
        <button
          onClick={() => setSelectedId(summary.top.student.id)}
          className="w-full glass-card rounded-2xl p-4 flex items-center gap-4 text-right hover:scale-[1.01] transition-all duration-200 border"
          style={{ borderColor: 'var(--accent-border)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}>
            <Award className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-dim mb-0.5">الأعلى التزاماً في البرنامج</p>
            <p className="font-extrabold text-app">{summary.top.student.name}</p>
            <p className="text-xs text-dim">مجموعة {summary.top.student.group} · {summary.top.prog.percentage}% إنجاز كلي</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-dim" />
        </button>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم الطالب…"
            className="w-full pr-9 pl-4 py-2.5 rounded-xl text-sm border bg-transparent text-app outline-none transition-colors"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', ...groups].map(g => (
            <button key={g}
              onClick={() => setGroupFilter(g)}
              className="px-3 py-2 rounded-xl text-xs font-medium border transition-all"
              style={groupFilter === g
                ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }
                : { background: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
              {g === 'all' ? 'الكل' : `م ${g}`}
            </button>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-1 flex-wrap text-xs">
        <span className="text-dim ml-1">ترتيب:</span>
        {([
          ['overall', 'الإنجاز الكلي'],
          ['today', 'إنجاز اليوم'],
          ['attendance', 'الحضور'],
          ['streak', 'التتابع'],
          ['name', 'الاسم'],
        ] as [typeof sortBy, string][]).map(([field, label]) => (
          <button key={field}
            onClick={() => toggleSort(field)}
            className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-all"
            style={sortBy === field
              ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }
              : { background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
            {label}
            {sortBy === field && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
          </button>
        ))}
        <span className="text-dim mr-2">{filtered.length} طالب</span>
      </div>

      {/* Student cards grid */}
      {data.students.length === 0 ? (
        <div className="glass-card rounded-2xl p-14 text-center">
          <Users className="w-10 h-10 text-dim mx-auto mb-3" />
          <p className="text-dim text-sm">لا يوجد طلاب بعد — أضف طلاباً من لوحة الإدارة</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Search className="w-8 h-8 text-dim mx-auto mb-2" />
          <p className="text-dim text-sm">لا نتائج للبحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(({ student, prog, attRate, avgRating, streak }, idx) => {
            const attCv = attRate === null ? '--text-muted' : attRate >= 80 ? '--c-teal' : attRate >= 60 ? '--c-amber' : '--c-rose';
            return (
              <motion.button
                key={student.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.025, 0.4) }}
                onClick={() => setSelectedId(student.id)}
                className="glass-card rounded-2xl p-4 text-right hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 border group"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 mb-3.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}>
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-app truncate">{student.name}</p>
                    <p className="text-[10px] text-dim">مجموعة {student.group}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    #{idx + 1}
                  </span>
                </div>

                {/* Stats mini-grid */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
                    <div className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>{prog.percentage}%</div>
                    <div className="text-[9px] text-dim mt-0.5">الكلي</div>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
                    <div className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--c-teal)' }}>{prog.todayPercentage}%</div>
                    <div className="text-[9px] text-dim mt-0.5">اليوم</div>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-soft)' }}>
                    <div className="text-sm font-extrabold tabular-nums" style={{ color: `var(${attCv})` }}>
                      {attRate !== null ? `${attRate}%` : '—'}
                    </div>
                    <div className="text-[9px] text-dim mt-0.5">الحضور</div>
                  </div>
                </div>

                {/* Overall progress bar */}
                <ProgressBar percentage={prog.percentage} height={5} />

                {/* Streak & rating */}
                <div className="flex items-center justify-between mt-2.5">
                  {streak > 0 ? (
                    <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'var(--c-amber)' }}><Flame className="w-3 h-3" /> {streak} يوم</span>
                  ) : <span />}
                  {avgRating !== null && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className="w-2.5 h-2.5"
                          style={s <= Math.round(avgRating)
                            ? { color: 'var(--c-amber)', fill: 'var(--c-amber)' }
                            : { color: 'var(--border)' }} />
                      ))}
                      <span className="text-[10px] text-dim mr-0.5">{avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Dossier drawer */}
      <AnimatePresence>
        {selectedId && (
          <StudentDossier key={selectedId} studentId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
