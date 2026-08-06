import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, TrendingUp, CheckCircle2, AlertCircle, Search, ChevronLeft,
  Activity, Award, Clock, Flame, BarChart3, Layers, Inbox, Zap,
  Star, FileText, Calendar, ArrowLeft, UserCheck, X,
} from 'lucide-react';
import { useStore } from '../lib/store';
import type { AttendanceStatus } from '../lib/types';
import { ATTENDANCE_META } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { ProgressRing } from '../components/ProgressRing';
import { TASK_TYPE_META } from '../lib/types';

export function SupervisorDashboard() {
  const { data, getCurrentDay, getStudentProgress, getTasksForStudent, markAttendance } = useStore();
  const navigate = useNavigate();
  const currentDay = getCurrentDay();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'progress' | 'name' | 'today'>('today');
  const [showBulkAttendance, setShowBulkAttendance] = useState(false);
  const [bulkStatuses, setBulkStatuses] = useState<Record<string, AttendanceStatus>>({});
  const todayStr = new Date().toISOString().split('T')[0];

  // === Derived data ===
  const studentsWithProgress = useMemo(() => {
    return data.students
      .map((s) => ({ student: s, progress: getStudentProgress(s.id) }))
      .filter((item) => {
        if (groupFilter !== 'all') {
          const sg = item.student.groups?.length ? item.student.groups : [item.student.group];
          if (!sg.includes(groupFilter)) return false;
        }
        if (search && !item.student.name.includes(search)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.student.name.localeCompare(b.student.name, 'ar');
        if (sortBy === 'progress') return b.progress.percentage - a.progress.percentage;
        return b.progress.todayPercentage - a.progress.todayPercentage;
      });
  }, [data.students, data.progress, search, groupFilter, sortBy, currentDay]);

  // 1. Overall stats
  const stats = useMemo(() => {
    const allProgress = data.students.map((s) => getStudentProgress(s.id));
    const avgProgress = allProgress.length > 0 ? Math.round(allProgress.reduce((sum, p) => sum + p.percentage, 0) / allProgress.length) : 0;
    const todayCompleted = allProgress.filter((p) => p.todayPercentage === 100).length;
    const todayPending = allProgress.filter((p) => p.todayPercentage < 100).length;
    const totalCompletionsToday = allProgress.reduce((s, p) => s + p.todayCompleted, 0);
    const maxCompletions = allProgress.reduce((s, p) => s + p.todayTotal, 0);
    const todayRate = maxCompletions > 0 ? Math.round((totalCompletionsToday / maxCompletions) * 100) : 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttended = (data.attendance ?? []).filter((a) => a.date === todayStr && (a.status === 'present' || a.status === 'late')).length;
    return { avgProgress, todayCompleted, todayPending, todayRate, totalCompletionsToday, todayAttended };
  }, [data.students, data.attendance, data.progress, currentDay]);

  // 2. Top performers
  const topPerformers = useMemo(() =>
    [...studentsWithProgress].sort((a, b) => b.progress.percentage - a.progress.percentage).slice(0, 5),
    [studentsWithProgress]);

  // 3. Needs attention
  const needsAttention = useMemo(() =>
    [...studentsWithProgress].filter((s) => s.progress.todayPercentage < 50).sort((a, b) => a.progress.todayPercentage - b.progress.todayPercentage).slice(0, 5),
    [studentsWithProgress]);

  // 4. Daily completion trend (last 7 days)
  const dailyTrend = useMemo(() => {
    const days = [];
    for (let d = Math.max(1, currentDay - 6); d <= currentDay; d++) {
      let totalCompletions = 0;
      let max = 0;
      data.students.forEach((s) => {
        const sTasks = getTasksForStudent(s.id).filter((t) => t.day === d);
        const sp = data.progress.filter((p) => p.studentId === s.id && p.status === 'completed');
        totalCompletions += sTasks.filter((t) => sp.some((p) => p.taskId === t.id)).length;
        max += sTasks.length;
      });
      days.push({ day: d, rate: max > 0 ? Math.round((totalCompletions / max) * 100) : 0, completed: totalCompletions, total: max });
    }
    return days;
  }, [data.tasks, data.progress, data.students, currentDay]);

  // 5. Group comparison
  const groupStats = useMemo(() => {
    const groups = Array.from(new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]).filter(Boolean)));
    return groups.map((g) => {
      const groupStudents = data.students.filter((s) => (s.groups?.length ? s.groups : [s.group]).includes(g));
      const allProg = groupStudents.map((s) => getStudentProgress(s.id));
      const avg = allProg.length > 0 ? Math.round(allProg.reduce((sum, p) => sum + p.percentage, 0) / allProg.length) : 0;
      const todayAvg = allProg.length > 0 ? Math.round(allProg.reduce((sum, p) => sum + p.todayPercentage, 0) / allProg.length) : 0;
      return { group: g, count: groupStudents.length, avg, todayAvg };
    }).sort((a, b) => b.avg - a.avg);
  }, [data.students, data.progress, currentDay]);

  // 6. Task type analysis
  const taskTypeAnalysis = useMemo(() => {
    const types = Array.from(new Set(data.tasks.map((t) => t.type)));
    return types.map((type) => {
      const typeTasks = data.tasks.filter((t) => t.type === type);
      const total = typeTasks.length * data.students.length;
      const completed = typeTasks.reduce((sum, t) =>
        sum + data.progress.filter((p) => p.taskId === t.id && p.status === 'completed').length, 0);
      return { type, count: typeTasks.length, rate: total > 0 ? Math.round((completed / total) * 100) : 0, completed, total };
    }).sort((a, b) => b.rate - a.rate);
  }, [data.tasks, data.progress, data.students]);

  // 7. Pending submissions needing review
  const pendingReviews = useMemo(() => {
    return data.progress
      .filter((p) => p.status === 'completed' && p.supervisorRating === undefined)
      .map((p) => {
        const task = data.tasks.find((t) => t.id === p.taskId);
        const student = data.students.find((s) => s.id === p.studentId);
        return { progress: p, task, student };
      })
      .filter((r) => r.task && r.student && r.task.requiresSubmission)
      .sort((a, b) => new Date(b.progress.completedAt ?? 0).getTime() - new Date(a.progress.completedAt ?? 0).getTime())
      .slice(0, 6);
  }, [data.progress, data.tasks, data.students]);

  // 8. Streak leaderboard
  const streakBoard = useMemo(() => {
    return data.students.map((s) => {
      let streak = 0;
      for (let d = currentDay; d >= 1; d--) {
        const dayTasks = data.tasks.filter((t) => t.day === d);
        if (dayTasks.length === 0) continue;
        const allDone = dayTasks.every((t) => data.progress.some((p) => p.taskId === t.id && p.studentId === s.id && p.status === 'completed'));
        if (allDone) streak++; else break;
      }
      return { student: s, streak };
    }).filter((s) => s.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 5);
  }, [data.students, data.tasks, data.progress, currentDay]);

  // 9. Recent activity feed
  const recentActivity = useMemo(() => {
    return data.progress
      .filter((p) => p.status === 'completed' && p.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 8)
      .map((p) => {
        const task = data.tasks.find((t) => t.id === p.taskId);
        const student = data.students.find((s) => s.id === p.studentId);
        return { progress: p, task, student };
      })
      .filter((r) => r.task && r.student);
  }, [data.progress, data.tasks, data.students]);

  // 10. Program timeline progress
  const programProgress = useMemo(() => {
    const totalDays = data.config.totalDays;
    const daysWithTasks = new Set(data.tasks.map((t) => t.day)).size;
    const daysElapsed = currentDay;
    const daysRemaining = Math.max(0, totalDays - currentDay);
    return { totalDays, daysWithTasks, daysElapsed, daysRemaining };
  }, [data.tasks, data.config, currentDay]);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
  const groups = Array.from(new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]).filter(Boolean)));

  const rankStyles = [
    { bg: 'var(--c-amber-bg)', color: 'var(--c-amber)' },
    { bg: 'var(--bg-soft)', color: 'var(--text-secondary)' },
    { bg: 'var(--bg-soft)', color: 'var(--text-muted)' },
    { bg: 'var(--bg-soft)', color: 'var(--text-muted)' },
    { bg: 'var(--bg-soft)', color: 'var(--text-muted)' },
  ];

  const handleBulkSave = () => {
    Object.entries(bulkStatuses).forEach(([sid, status]) => markAttendance(sid, todayStr, status));
    setBulkStatuses({});
    setShowBulkAttendance(false);
  };

  return (
    <>
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* === 0. Bulk attendance button === */}
      <motion.div variants={item} className="flex justify-end">
        <button onClick={() => { setBulkStatuses({}); setShowBulkAttendance(true); }} className="flex items-center gap-2 font-bold px-4 py-2.5 rounded-2xl transition-all border" style={{ background: 'var(--c-teal-bg)', color: 'var(--c-teal)', borderColor: 'var(--c-teal-bd)' }}>
          <UserCheck className="w-4 h-4" /> تسجيل حضور جماعي
        </button>
      </motion.div>

      {/* === 1. Stats Row === */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} label="إجمالي الطلاب" value={data.students.length} sublabel={`${groups.length} مجموعات`} colorVar="--c-sky" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="متوسط الإنجاز" value={`${stats.avgProgress}%`} sublabel="عبر جميع الطلاب" colorVar="--c-teal" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="أكملوا اليوم" value={stats.todayCompleted} sublabel={`من ${data.students.length} طالب`} colorVar="--c-violet" trend={`${stats.todayRate}%`} />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="بحاجة متابعة" value={stats.todayPending} sublabel="لم يكملوا اليوم" colorVar="--c-amber" />
        <StatCard icon={<Calendar className="w-5 h-5" />} label="حضروا اليوم" value={stats.todayAttended} sublabel={`من ${data.students.length} طالب`} colorVar="--c-sky" />
      </motion.div>

      {/* === 2. Daily Completion Trend + Program Timeline === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Daily trend chart */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            اتجاه الإنجاز اليومي — آخر 7 أيام
          </h3>
          <div className="flex items-end justify-between gap-2 h-40 mb-2">
            {dailyTrend.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group">
                <span className="text-[10px] font-bold text-dim opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{d.rate}%</span>
                <div className="w-full rounded-t-xl transition-all duration-700 ease-out relative overflow-hidden" style={{
                  height: `${Math.max(d.rate, 3)}%`,
                  background: d.rate >= 75 ? 'var(--c-teal)' : d.rate >= 50 ? 'var(--c-sky)' : d.rate >= 25 ? 'var(--c-amber)' : 'var(--c-rose)',
                  minHeight: '4px',
                }}>
                  <div className="absolute inset-0 opacity-20 bg-white rounded-t-xl" />
                </div>
                <span className="text-[10px] text-dim font-medium">يوم {d.day}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Program timeline */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center">
          <h3 className="text-sm font-bold text-sub mb-3">تقدم البرنامج</h3>
          <ProgressRing percentage={Math.round((programProgress.daysElapsed / programProgress.totalDays) * 100)} size={110} label="مكتمل" sublabel={`يوم ${currentDay} من ${programProgress.totalDays}`} />
          <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
            <div><div className="text-lg font-bold text-app tabular-nums">{programProgress.daysElapsed}</div><div className="text-[10px] text-dim">أيام مضت</div></div>
            <div><div className="text-lg font-bold text-app tabular-nums">{programProgress.daysWithTasks}</div><div className="text-[10px] text-dim">أيام بها مهام</div></div>
            <div><div className="text-lg font-bold text-app tabular-nums">{programProgress.daysRemaining}</div><div className="text-[10px] text-dim">أيام متبقية</div></div>
          </div>
        </motion.div>
      </div>

      {/* === 3. Group Comparison === */}
      <motion.div variants={item} className="glass-card rounded-2xl p-5">
        <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          مقارنة المجموعات
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groupStats.map((g) => (
            <div key={g.group} className="rounded-2xl p-4 border cursor-pointer hover-lift transition-all" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }} onClick={() => { setGroupFilter(g.group); }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{g.group}</div>
                  <div>
                    <div className="text-sm font-bold text-app">مجموعة {g.group}</div>
                    <div className="text-[10px] text-dim">{g.count} طالب</div>
                  </div>
                </div>
                <span className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>{g.avg}%</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-dim"><span>إنجاز اليوم</span><span className="tabular-nums">{g.todayAvg}%</span></div>
                <ProgressBar percentage={g.todayAvg} height={4} colorVar="--c-sky" />
                <div className="flex items-center justify-between text-[10px] text-dim"><span>الإنجاز الكلي</span><span className="tabular-nums">{g.avg}%</span></div>
                <ProgressBar percentage={g.avg} height={4} />
              </div>
            </div>
          ))}
          {groupStats.length === 0 && <div className="col-span-full text-center py-6 text-dim text-sm">لا توجد مجموعات بعد</div>}
        </div>
      </motion.div>

      {/* === 4. Top Performers + Needs Attention === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Award className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />
            الأعلى التزاماً
          </h3>
          <div className="space-y-2">
            {topPerformers.length === 0 ? <EmptyState text="لا يوجد طلاب بعد" /> : topPerformers.map((it, idx) => {
              const rs = rankStyles[idx];
              return (
                <div key={it.student.id} className="group flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-300" style={{ background: 'var(--bg-soft)' }} onClick={() => navigate(`/students/${it.student.id}`)}>
                  <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold" style={{ background: rs.bg, color: rs.color }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-app truncate group-hover:text-accent transition-colors">{it.student.name}</div>
                    <div className="text-[11px] text-dim">مجموعة {it.student.group}</div>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--c-teal)' }}>{it.progress.percentage}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" style={{ color: 'var(--c-rose)' }} />
            بحاجة متابعة اليوم
          </h3>
          <div className="space-y-2">
            {needsAttention.length === 0 ? (
              <div className="text-center py-6 text-sub text-sm">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--c-teal-bg)', border: '1px solid var(--c-teal-bd)' }}>
                  <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--c-teal)' }} />
                </div>
                <p className="font-semibold text-app text-sm">جميع الطلاب منضبطون اليوم</p>
                <p className="text-xs text-dim mt-0.5">لا يوجد طلاب بحاجة متابعة في الوقت الحالي</p>
              </div>
            ) : needsAttention.map((at) => (
              <div key={at.student.id} className="group flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-300" style={{ background: 'var(--c-rose-bg)' }} onClick={() => navigate(`/students/${at.student.id}`)}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-rose-bd)' }}>
                  <Clock className="w-4 h-4" style={{ color: 'var(--c-rose)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-app truncate group-hover:text-accent transition-colors">{at.student.name}</div>
                  <div className="text-[11px] text-dim">اليوم: {at.progress.todayCompleted}/{at.progress.todayTotal}</div>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--c-rose)' }}>{at.progress.todayPercentage}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* === 5. Pending Submissions Review Queue === */}
      <motion.div variants={item} className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-app flex items-center gap-2">
            <Inbox className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />
            تسليمات بانتظار التقييم
            {pendingReviews.length > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)' }}>{pendingReviews.length}</span>}
          </h3>
        </div>
        {pendingReviews.length === 0 ? (
          <EmptyState text="لا توجد تسليمات بانتظار التقييم" icon={<CheckCircle2 className="w-8 h-8" style={{ color: 'var(--c-teal)', opacity: 0.5 }} />} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingReviews.map((r) => (
              <div key={r.progress.taskId + r.progress.studentId} className="rounded-2xl p-3.5 border cursor-pointer hover-lift transition-all" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }} onClick={() => navigate(`/students/${r.student!.id}`)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{TASK_TYPE_META[r.task!.type].icon}</span>
                  <span className="text-xs font-medium text-dim">{TASK_TYPE_META[r.task!.type].label}</span>
                </div>
                <div className="text-sm font-bold text-app truncate mb-1">{r.student!.name}</div>
                <div className="text-[11px] text-dim truncate mb-2">{r.task!.title}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" style={{ color: 'var(--c-amber)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--c-amber)' }}>بانتظار التقييم</span>
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>تقييم ←</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* === 6. Task Type Analysis + Streak Board === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Task type analysis */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            تحليل الإنجاز حسب نوع المهمة
          </h3>
          <div className="space-y-3">
            {taskTypeAnalysis.map((tt) => {
              const meta = TASK_TYPE_META[tt.type];
              return (
                <div key={tt.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-app flex items-center gap-1.5">
                      <span>{meta.icon}</span> {meta.label}
                    </span>
                    <span className="text-xs text-dim tabular-nums">{tt.rate}%</span>
                  </div>
                  <ProgressBar percentage={tt.rate} height={6} colorVar={meta.colorVar} />
                </div>
              );
            })}
            {taskTypeAnalysis.length === 0 && <EmptyState text="لا توجد مهام بعد" />}
          </div>
        </motion.div>

        {/* Streak leaderboard */}
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />
            أطول سلسلة التزام
          </h3>
          <div className="space-y-2">
            {streakBoard.length === 0 ? <EmptyState text="لا توجد سلاسل التزام بعد" /> : streakBoard.map((s, idx) => (
              <div key={s.student.id} className="group flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-300" style={{ background: 'var(--bg-soft)' }} onClick={() => navigate(`/students/${s.student.id}`)}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-amber-bg)' }}>
                  <Flame className="w-4 h-4" style={{ color: 'var(--c-amber)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-app truncate group-hover:text-accent transition-colors">{s.student.name}</div>
                  <div className="text-[11px] text-dim">مجموعة {s.student.group}</div>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--c-amber)' }}>{s.streak} يوم</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* === 7. Recent Activity Feed === */}
      <motion.div variants={item} className="glass-card rounded-2xl p-5">
        <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          النشاط الأخير
        </h3>
        {recentActivity.length === 0 ? <EmptyState text="لا يوجد نشاط بعد" /> : (
          <div className="space-y-2">
            {recentActivity.map((r, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: idx % 2 === 0 ? 'var(--bg-soft)' : 'transparent' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-teal-bg)' }}>
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--c-teal)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-app">{r.student!.name}</span>
                  <span className="text-sm text-dim"> أكمل </span>
                  <span className="text-sm text-app">{TASK_TYPE_META[r.task!.type].icon} {r.task!.title}</span>
                </div>
                <span className="text-[11px] text-dim whitespace-nowrap flex-shrink-0">
                  {r.progress.completedAt && new Date(r.progress.completedAt).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* === 8. Students Table === */}
      <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b space-y-3" style={{ borderColor: 'var(--border-soft)' }}>
          <h3 className="text-base font-bold text-app flex items-center gap-2">
            <Activity className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <span>متابعة الطلاب — اليوم {currentDay}</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="w-full rounded-xl py-2 pr-9 pl-3 text-sm text-app placeholder:text-dim focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} />
            </div>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-xl py-2 px-3 text-sm text-app focus-accent border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
              <option value="all">كل المجموعات</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'progress' | 'name' | 'today')} className="rounded-xl py-2 px-3 text-sm text-app focus-accent border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
              <option value="today">ترتيب: إنجاز اليوم</option>
              <option value="progress">ترتيب: الإنجاز الكلي</option>
              <option value="name">ترتيب: الاسم</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr className="text-dim text-xs border-b" style={{ borderColor: 'var(--border-soft)' }}>
                <th className="text-right p-4 font-medium">الطالب</th>
                <th className="text-center p-4 font-medium">المجموعة</th>
                <th className="text-center p-4 font-medium">الحضور</th>
                <th className="text-center p-4 font-medium">إنجاز اليوم</th>
                <th className="text-center p-4 font-medium">الإنجاز الكلي</th>
                <th className="text-center p-4 font-medium">الحالة</th>
                <th className="text-center p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {studentsWithProgress.map((it) => (
                <tr key={it.student.id} className="border-b cursor-pointer group transition-colors" style={{ borderColor: 'var(--border-soft)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-soft)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} onClick={() => navigate(`/students/${it.student.id}`)}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold" style={{ background: 'var(--border)', color: 'var(--text-primary)' }}>{it.student.name.charAt(0)}</div>
                      <div>
                        <div className="font-medium text-app group-hover:text-accent transition-colors">{it.student.name}</div>
                        <div className="text-[11px] text-dim">{it.student.phone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center"><span className="text-[11px] px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>{it.student.group}</span></td>
                  <td className="p-4 text-center">
                    {(() => {
                      const rec = (data.attendance ?? []).find((a) => a.studentId === it.student.id && a.date === todayStr);
                      if (!rec) return <span className="text-[11px] text-dim">—</span>;
                      const meta = ATTENDANCE_META[rec.status];
                      return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>;
                    })()}
                  </td>
                  <td className="p-4"><div className="flex items-center gap-2 min-w-[120px]"><ProgressBar percentage={it.progress.todayPercentage} height={5} /><span className="text-[11px] text-dim whitespace-nowrap tabular-nums">{it.progress.todayCompleted}/{it.progress.todayTotal}</span></div></td>
                  <td className="p-4"><div className="flex items-center gap-2 min-w-[120px]"><ProgressBar percentage={it.progress.percentage} height={5} /><span className="text-[11px] text-dim whitespace-nowrap tabular-nums">{it.progress.percentage}%</span></div></td>
                  <td className="p-4 text-center">
                    {it.progress.todayPercentage === 100 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--c-teal-bg)', color: 'var(--c-teal)' }}><CheckCircle2 className="w-3.5 h-3.5" /> مكتمل</span>
                    ) : it.progress.todayPercentage > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)' }}><Clock className="w-3.5 h-3.5" /> جاري</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}><AlertCircle className="w-3.5 h-3.5" /> متأخر</span>
                    )}
                  </td>
                  <td className="p-4 text-center"><ChevronLeft className="w-5 h-5 inline group-hover:text-accent transition-colors text-dim" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {studentsWithProgress.length === 0 && <div className="p-10 text-center text-dim"><Users className="w-10 h-10 mx-auto mb-3 opacity-40" />لا يوجد طلاب مطابقون</div>}
        </div>
      </motion.div>
    </motion.div>

    {/* Bulk attendance modal */}
    <AnimatePresence>
      {showBulkAttendance && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowBulkAttendance(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="glass-card rounded-2xl w-full max-w-lg border pointer-events-auto flex flex-col" style={{ borderColor: 'var(--border)', maxHeight: '85vh' }}>
              <div className="flex items-center justify-between p-5 pb-3">
                <h3 className="text-lg font-bold text-app">تسجيل حضور جماعي — {new Date().toLocaleDateString('ar-SA')}</h3>
                <button onClick={() => setShowBulkAttendance(false)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-2">
                {data.students.map((s) => {
                  const existing = (data.attendance ?? []).find((a) => a.studentId === s.id && a.date === todayStr);
                  const current = bulkStatuses[s.id] ?? existing?.status ?? '';
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl p-2.5 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                      <div className="flex-1 text-sm font-medium text-app truncate">{s.name}</div>
                      <select value={current} onChange={(e) => setBulkStatuses((prev) => ({ ...prev, [s.id]: e.target.value as AttendanceStatus }))} className="rounded-xl py-1.5 px-2 text-xs border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)', minWidth: 90 }}>
                        <option value="">-- لم يُسجَّل --</option>
                        <option value="present">حاضر</option>
                        <option value="late">متأخر</option>
                        <option value="excused">بعذر</option>
                        <option value="absent">غائب</option>
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="p-5 pt-3 border-t flex gap-2" style={{ borderColor: 'var(--border-soft)' }}>
                <button onClick={handleBulkSave} className="flex-1 rounded-2xl py-3 font-bold transition-colors" style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}>حفظ الحضور</button>
                <button onClick={() => setShowBulkAttendance(false)} className="flex-1 rounded-2xl py-3 font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function EmptyState({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="text-center py-6 text-dim text-sm">
      {icon ?? <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />}
      {text}
    </div>
  );
}
