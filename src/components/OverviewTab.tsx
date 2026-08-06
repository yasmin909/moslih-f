import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, UserCog, Shield, Layers, Database,
  CheckCircle2, TrendingUp, BarChart3, Zap, Inbox, Calendar,
  FileText, ArrowLeft, ClipboardList,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { ProgressBar } from '../components/ProgressBar';
import { TASK_TYPE_META } from '../lib/types';

export function OverviewTab() {
  const { data, getCurrentDay, getStudentProgress } = useStore();
  const navigate = useNavigate();
  const currentDay = getCurrentDay();

  const sysStats = useMemo(() => {
    const allProgress = data.students.map((s) => getStudentProgress(s.id));
    const avgProgress = allProgress.length > 0 ? Math.round(allProgress.reduce((s, p) => s + p.percentage, 0) / allProgress.length) : 0;
    const totalCompletionsToday = allProgress.reduce((s, p) => s + p.todayCompleted, 0);
    const maxCompletions = allProgress.reduce((s, p) => s + p.todayTotal, 0);
    const todayRate = maxCompletions > 0 ? Math.round((totalCompletionsToday / maxCompletions) * 100) : 0;
    const pendingReviews = data.progress.filter((p) => p.status === 'completed' && p.supervisorRating === undefined && data.tasks.find((t) => t.id === p.taskId)?.requiresSubmission).length;
    const activeStudents = data.users.filter((u) => u.role === 'student' && u.active !== false).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttended = (data.attendance ?? []).filter((a) => a.date === todayStr && (a.status === 'present' || a.status === 'late')).length;
    return { avgProgress, todayRate, pendingReviews, activeStudents, todayAttended };
  }, [data, currentDay]);

  const planCoverage = useMemo(() => {
    const daysWithTasks = new Set(data.tasks.map((t) => t.day)).size;
    const tasksPerDay = Array.from({ length: data.config.totalDays }, (_, i) => data.tasks.filter((t) => t.day === i + 1).length);
    return { daysWithTasks, tasksPerDay };
  }, [data.tasks, data.config.totalDays]);

  const taskTypeDist = useMemo(() => {
    const types = Array.from(new Set(data.tasks.map((t) => t.type)));
    return types.map((type) => ({ type, count: data.tasks.filter((t) => t.type === type).length })).sort((a, b) => b.count - a.count);
  }, [data.tasks]);

  const groupPerf = useMemo(() => {
    const groups = Array.from(new Set(data.students.map((s) => s.group)));
    return groups.map((g) => {
      const students = data.students.filter((s) => s.group === g);
      const allProg = students.map((s) => getStudentProgress(s.id));
      const avg = allProg.length > 0 ? Math.round(allProg.reduce((s, p) => s + p.percentage, 0) / allProg.length) : 0;
      return { group: g, count: students.length, avg };
    }).sort((a, b) => b.avg - a.avg);
  }, [data.students, data.progress, currentDay]);

  const recentActivity = useMemo(() => {
    return data.progress.filter((p) => p.status === 'completed' && p.completedAt).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()).slice(0, 6).map((p) => {
      const task = data.tasks.find((t) => t.id === p.taskId);
      const student = data.students.find((s) => s.id === p.studentId);
      return { progress: p, task, student };
    }).filter((r) => r.task && r.student);
  }, [data.progress, data.tasks, data.students]);

  const staffOverview = data.users.filter((u) => u.role === 'admin' || u.role === 'supervisor');
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  const quickActions = [
    { label: 'إضافة طالب', icon: Users, to: '/admin?tab=students', color: '--c-sky' },
    { label: 'بناء الخطة', icon: Calendar, to: '/plan', color: '--c-teal' },
    { label: 'التقارير', icon: FileText, to: '/reports', color: '--c-violet' },
    { label: 'إدارة الطلاب', icon: Users, to: '/students', color: '--c-amber' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* 1. System overview stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { icon: Users, label: 'الطلاب النشطون', value: sysStats.activeStudents, color: '--c-sky', to: '/students' },
          { icon: TrendingUp, label: 'متوسط الإنجاز', value: `${sysStats.avgProgress}%`, color: '--c-teal', to: '/dashboard' },
          { icon: Inbox, label: 'تسليمات للتقييم', value: sysStats.pendingReviews, color: '--c-amber', to: '/dashboard' },
          { icon: CheckCircle2, label: 'معدل إنجاز اليوم', value: `${sysStats.todayRate}%`, color: '--c-violet', to: '/dashboard' },
          { icon: Calendar, label: 'حضروا اليوم', value: sysStats.todayAttended ?? 0, color: '--c-amber', to: '/admin?tab=attendance' },
        ].map((s) => (
          <button key={s.label} onClick={() => navigate(s.to)} className="glass-card rounded-2xl p-4 sm:p-5 hover-lift text-right">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: `var(${s.color}-bg)`, color: `var(${s.color})` }}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-app tabular-nums">{s.value}</div>
            <div className="text-sm text-sub font-medium">{s.label}</div>
          </button>
        ))}
      </motion.div>

      {/* 2. Quick actions */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <button key={a.label} onClick={() => navigate(a.to)} className="glass-card rounded-2xl p-4 flex items-center gap-3 hover-lift transition-all text-right" style={{ borderColor: `var(${a.color}-bd)` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `var(${a.color}-bg)`, color: `var(${a.color})` }}>
              <a.icon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-app">{a.label}</span>
            <ArrowLeft className="w-4 h-4 text-dim mr-auto" />
          </button>
        ))}
      </motion.div>

      {/* 3. Plan coverage + 4. Task type distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            تغطية الخطة — {data.config.totalDays} يوم
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--border-soft)' }}>
              <div className="h-full transition-all duration-700" style={{ width: `${(planCoverage.daysWithTasks / data.config.totalDays) * 100}%`, background: 'var(--c-teal)' }} />
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--c-teal)' }}>{planCoverage.daysWithTasks}/{data.config.totalDays}</span>
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-1">
            {planCoverage.tasksPerDay.map((count, i) => (
              <button key={i} onClick={() => navigate('/plan')} className="aspect-square rounded-md flex items-center justify-center text-[9px] font-bold transition-all hover:scale-110 cursor-pointer" style={{
                background: count > 0 ? 'var(--c-teal-bg)' : 'var(--bg-soft)',
                color: count > 0 ? 'var(--c-teal)' : 'var(--text-muted)',
                boxShadow: i + 1 === currentDay ? 'inset 0 0 0 2px var(--accent)' : 'none',
              }} title={`يوم ${i + 1}: ${count} مهام — اضغط للتعديل`}>{i + 1}</button>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-dim">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--c-teal-bg)' }} /> به مهام</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--bg-soft)' }} /> فارغ</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2" style={{ borderColor: 'var(--accent)' }} /> اليوم</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            توزيع المهام حسب النوع
          </h3>
          {taskTypeDist.length === 0 ? <div className="text-center py-6 text-dim text-sm">لا توجد مهام بعد</div> : (
            <div className="space-y-2.5">
              {taskTypeDist.map((tt) => {
                const meta = TASK_TYPE_META[tt.type];
                const pct = data.tasks.length > 0 ? Math.round((tt.count / data.tasks.length) * 100) : 0;
                return (
                  <div key={tt.type} className="flex items-center gap-3">
                    <span className="text-base flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-app font-medium">{meta.label}</span>
                        <span className="text-[11px] text-dim tabular-nums">{tt.count} ({pct}%)</span>
                      </div>
                      <ProgressBar percentage={pct} height={5} colorVar={meta.colorVar} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* 5. Group performance + 6. Staff overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            أداء المجموعات
          </h3>
          {groupPerf.length === 0 ? <div className="text-center py-6 text-dim text-sm">لا توجد مجموعات</div> : (
            <div className="space-y-3">
              {groupPerf.map((g) => (
                <button key={g.group} onClick={() => navigate('/students')} className="w-full flex items-center gap-3 text-right hover:opacity-80 transition-opacity">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{g.group}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-app">مجموعة {g.group} — {g.count} طالب</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{g.avg}%</span>
                    </div>
                    <ProgressBar percentage={g.avg} height={5} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            فريق الإدارة
          </h3>
          <div className="space-y-2">
            {staffOverview.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-2xl" style={{ background: 'var(--bg-soft)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: u.role === 'admin' ? 'var(--c-rose-bg)' : 'var(--c-teal-bg)', color: u.role === 'admin' ? 'var(--c-rose)' : 'var(--c-teal)' }}>
                  {u.role === 'admin' ? <Shield className="w-4 h-4" /> : <UserCog className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-app truncate">{u.name}</div>
                  <div className="text-[11px] text-dim">{u.role === 'admin' ? 'مدير' : 'مشرف'} — {u.username}</div>
                </div>
                {u.active === false && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}>معطّل</span>}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 7. Recent activity + 8. System info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-5">
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            النشاط الأخير
          </h3>
          {recentActivity.length === 0 ? <div className="text-center py-6 text-dim text-sm">لا يوجد نشاط</div> : (
            <div className="space-y-2">
              {recentActivity.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: i % 2 === 0 ? 'var(--bg-soft)' : 'transparent' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-teal-bg)' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--c-teal)' }} />
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium text-app">{r.student!.name}</span>
                    <span className="text-dim"> أكمل </span>
                    <span className="text-app">{TASK_TYPE_META[r.task!.type].icon} {r.task!.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-5" style={{ borderColor: 'var(--c-sky-bd)', background: 'var(--c-sky-bg)' }}>
          <h3 className="text-base font-bold text-app mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" style={{ color: 'var(--c-sky)' }} />
            معلومات النظام
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Users, label: 'الطلاب', value: data.students.length, to: '/students' },
              { icon: UserCog, label: 'المشرفون', value: staffOverview.filter((u) => u.role === 'supervisor').length, to: '/admin' },
              { icon: ClipboardList, label: 'المهام', value: data.tasks.length, to: '/plan' },
              { icon: Database, label: 'سجلات الإنجاز', value: data.progress.length, to: '/reports' },
            ].map((s) => (
              <button key={s.label} onClick={() => navigate(s.to)} className="rounded-2xl p-3.5 border text-center hover-lift transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
                <s.icon className="w-5 h-5 mx-auto mb-2 text-dim" />
                <div className="text-xl font-extrabold text-app tabular-nums">{s.value}</div>
                <div className="text-[11px] text-dim">{s.label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-dim flex items-center gap-1.5 mt-4">
            <Database className="w-3.5 h-3.5" /> البيانات محفوظة على السحابة
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
