import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Target, TrendingUp, Award, CheckCircle2, Clock, Trophy, Sparkles, Calendar, Star, AlertCircle, Moon } from 'lucide-react';
import { useStore } from '../lib/store';
import { TaskCard } from '../components/TaskCard';
import { ProgressRing } from '../components/ProgressRing';
import { StatCard } from '../components/StatCard';
import { TASK_TYPE_META } from '../lib/types';

export function StudentDashboard() {
  const { data, currentUser, getCurrentDay, getStudentProgress, getTasksForStudent } = useStore();
  const navigate = useNavigate();
  const currentDay = getCurrentDay();
  const studentId = currentUser?.studentId ?? '';
  const student = data.students.find((s) => s.id === studentId);

  const studentTasks = useMemo(
    () => getTasksForStudent(studentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, data.students, studentId],
  );

  const isRestDay = useMemo(
    () => (data.restDays ?? []).includes(currentDay),
    [data.restDays, currentDay],
  );

  // ── Only count tasks up to currentDay ──
  const activeTasks = useMemo(
    () => studentTasks.filter((t) => t.day <= currentDay),
    [studentTasks, currentDay],
  );

  const activeCompleted = useMemo(
    () =>
      activeTasks.filter((t) =>
        data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      ).length,
    [activeTasks, data.progress, studentId],
  );

  const activePercentage =
    activeTasks.length > 0 ? Math.round((activeCompleted / activeTasks.length) * 100) : 0;

  // Today's tasks
  const todayTasks = useMemo(
    () => studentTasks.filter((t) => t.day === currentDay),
    [studentTasks, currentDay],
  );

  const todayCompleted = useMemo(
    () =>
      todayTasks.filter((t) =>
        data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      ).length,
    [todayTasks, data.progress, studentId],
  );

  const remainingMinutes = useMemo(
    () =>
      todayTasks
        .filter((t) =>
          !data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
        )
        .length,
    [todayTasks, data.progress, studentId],
  );

  const todaySummary = useMemo(() => {
    const typeCount: Record<string, number> = {};
    for (const task of todayTasks) {
      typeCount[task.type] = (typeCount[task.type] ?? 0) + 1;
    }
    return { typeCount };
  }, [todayTasks]);

  const streak = useMemo(() => {
    let count = 0;
    for (let d = currentDay; d >= 1; d--) {
      const dayTasks = studentTasks.filter((t) => t.day === d);
      if (dayTasks.length === 0) continue;
      if (dayTasks.every((t) => data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed' && !p.isBackdated))) count++;
      else break;
    }
    return count;
  }, [studentTasks, data.progress, studentId, currentDay]);

  const totalCompletedDays = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= currentDay; d++) {
      const dayTasks = studentTasks.filter((t) => t.day === d);
      if (dayTasks.length === 0) continue;
      const done = dayTasks.every((t) =>
        data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      );
      if (done) count++;
    }
    return count;
  }, [studentTasks, data.progress, studentId, currentDay]);

  const totalMissed = useMemo(() => {
    let missed = 0;
    for (let d = 1; d < currentDay; d++) {
      const dayTasks = studentTasks.filter((t) => t.day === d);
      const done = dayTasks.filter((t) =>
        data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      ).length;
      missed += dayTasks.length - done;
    }
    return missed;
  }, [studentTasks, data.progress, studentId, currentDay]);

  // First day with incomplete tasks (for missed tasks CTA)
  const firstMissedDay = useMemo(() => {
    for (let d = 1; d < currentDay; d++) {
      const dayTasks = studentTasks.filter((t) => t.day === d);
      const hasIncomplete = dayTasks.some(
        (t) => !data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      );
      if (hasIncomplete) return d;
    }
    return null;
  }, [studentTasks, data.progress, studentId, currentDay]);

  const goToMissedTasks = () => {
    if (firstMissedDay !== null) navigate('/student/days', { state: { initialDay: firstMissedDay } });
  };

  // ── Day-completion toast ──
  const [dayCompletedToast, setDayCompletedToast] = useState<number | null>(null);
  const prevCompletedRef = useRef<number>(0);
  const toastInitialized = useRef(false);

  useEffect(() => {
    if (!toastInitialized.current) {
      prevCompletedRef.current = todayCompleted;
      toastInitialized.current = true;
      return;
    }
    const prev = prevCompletedRef.current;
    if (prev < todayTasks.length && todayCompleted === todayTasks.length && todayTasks.length > 0) {
      setDayCompletedToast(currentDay);
    }
    prevCompletedRef.current = todayCompleted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayCompleted]);

  useEffect(() => {
    if (dayCompletedToast === null) return;
    const t = setTimeout(() => setDayCompletedToast(null), 3500);
    return () => clearTimeout(t);
  }, [dayCompletedToast]);

  // ── Program-complete check (ALL tasks across all days) ──
  const allProgramTasks = studentTasks;
  const allProgramCompleted = useMemo(
    () => allProgramTasks.filter((t) =>
      data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
    ).length,
    [allProgramTasks, data.progress, studentId],
  );
  const isProgramComplete = allProgramTasks.length > 0 && allProgramCompleted === allProgramTasks.length;

  const totalDays = data.config.totalDays;
  // Stable per-section fade-in — delay baked in, never re-triggers on re-render
  const sec = (delay = 0) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, delay, ease: 'easeOut' },
  });

  // ── Admin banners visible to this student ──
  const adminBanners = useMemo(() => {
    return (data.banners ?? []).filter((b) => {
      if (!b.active) return false;
      if (b.targetRole === 'all') return true;
      if (b.targetStudentIds?.length) return b.targetStudentIds.includes(studentId);
      if (b.targetGroups?.length) {
        const sg = student?.groups?.length ? student.groups : [student?.group ?? ''];
        return b.targetGroups.some((g) => sg.includes(g));
      }
      return true;
    });
  }, [data.banners, studentId, student]);

  const BANNER_COLOR_CSS: Record<string, string> = {
    amber: '--c-amber', teal: '--c-teal', clay: '--c-clay',
    rose: '--c-rose',   mauve: '--c-mauve', copper: '--c-copper',
  };

  // ── No tasks assigned at all ──
  if (studentTasks.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="glass-card rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-soft)' }}>
              <Calendar className="w-8 h-8" style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-xl font-extrabold text-app mb-2">مرحباً، {student?.name ?? 'طالب'}</h2>
            <p className="text-sub mb-1">لم تُضَف لك مهام حتى الآن</p>
            <p className="text-sm text-dim">سيتم عرض مهامك هنا فور إضافتها من قِبل المشرف</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Day-completion toast ── */}
      <AnimatePresence>
        {dayCompletedToast !== null && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="fixed left-4 right-4 z-50 max-w-md mx-auto rounded-2xl px-5 py-4 border flex items-start gap-3.5 shadow-2xl"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)', background: 'var(--bg-card, #fff)', borderColor: 'var(--c-teal-bd)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--c-teal-bd)' }}>
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--c-teal)' }} />
            </div>
            <div>
              <p className="font-extrabold text-sm leading-snug" style={{ color: 'var(--c-teal)' }}>
                بارك الله فيك — أتممت مهام يوم {dayCompletedToast}
              </p>
              <p className="text-xs mt-1 leading-relaxed text-dim">
                «من جدَّ وجد» — المداومة على العمل هي سرّ التقدم الحقيقي
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome card */}
      <motion.div {...sec(0)}>
        <div className="glass-card rounded-2xl p-5 sm:p-6 overflow-hidden relative" style={{ borderColor: 'var(--accent-border)' }}>
          <div className="absolute top-0 left-0 w-40 h-40 rounded-full blur-3xl" style={{ background: 'var(--accent-soft)' }} />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
                  يوم {currentDay} من {totalDays}
                </span>
                {totalMissed > 0 && (
                  <button
                    onClick={goToMissedTasks}
                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-opacity hover:opacity-80 active:opacity-60"
                    style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', borderColor: 'var(--c-amber-bd)' }}
                  >
                    {totalMissed} مهمة للاستدراك ←
                  </button>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-app mb-1 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                مرحباً، {student?.name}
              </h2>
              <p className="text-sm text-sub">
                {todayTasks.length > 0
                  ? `${todayTasks.length} مهام اليوم — ${todayCompleted} مكتملة`
                  : 'لا توجد مهام لهذا اليوم'}
              </p>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border" style={{ background: 'var(--c-amber-bg)', borderColor: 'var(--c-amber-bd)' }}>
              <Flame className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />
              <div>
                <div className="text-xl font-extrabold leading-none" style={{ color: 'var(--c-amber)' }}>{streak}</div>
                <div className="text-[10px] text-dim mt-0.5">أيام متتالية</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Banners: conditional — AnimatePresence + opacity only (no y shift) ── */}
      <AnimatePresence initial={false}>
        {isProgramComplete && (
          <motion.div key="program-banner"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="banner-program rounded-2xl p-6">
            <div className="relative flex items-center gap-5">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Trophy className="w-7 h-7" style={{ color: 'var(--bg-base)' }} />
              </div>
              <div>
                <p className="font-extrabold text-base leading-snug text-app">بارك الله فيك — لا مهام متبقية بين يديك الآن</p>
                <p className="text-sm text-sub mt-1.5 leading-relaxed">
                  حافظ على المداومة، وستجد مهام الأيام القادمة هنا فور إضافتها
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {!isProgramComplete && activePercentage === 100 && activeTasks.length > 0 && (
          <motion.div key="daily-banner"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="banner-daily rounded-2xl p-5">
            <div className="relative flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Trophy className="w-6 h-6" style={{ color: 'var(--bg-base)' }} />
              </div>
              <div>
                <p className="font-extrabold text-app text-base leading-snug">
                  أتممت جميع مهام الأيام الـ {currentDay} الماضية
                </p>
                <p className="text-sm text-sub mt-1 leading-relaxed">
                  {activeCompleted} مهمة مكتملة من يوم 1 حتى يوم {currentDay} — استمر حتى نهاية البرنامج
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {adminBanners.map((b) => {
          const cv = BANNER_COLOR_CSS[b.color] ?? '--c-amber';
          return (
            <motion.div key={b.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl p-5"
              style={{ background: `linear-gradient(to left, var(${cv}-bd) 0%, var(${cv}-bg) 44%, transparent 72%), var(--bg-card)`, border: `1px solid var(${cv}-bd)`, borderRightWidth: '4px', borderRightColor: `var(${cv})` }}>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `var(${cv})` }}>
                  {b.icon === 'trophy'   && <Trophy       className="w-6 h-6" style={{ color: 'var(--bg-base)' }} />}
                  {b.icon === 'star'     && <Star         className="w-6 h-6" style={{ color: 'var(--bg-base)' }} />}
                  {b.icon === 'award'    && <Award        className="w-6 h-6" style={{ color: 'var(--bg-base)' }} />}
                  {b.icon === 'check'    && <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--bg-base)' }} />}
                  {b.icon === 'sparkles' && <Sparkles     className="w-6 h-6" style={{ color: 'var(--bg-base)' }} />}
                </div>
                <div>
                  <p className="font-extrabold text-app text-base leading-snug">{b.title}</p>
                  {b.body && <p className="text-sm text-sub mt-1 leading-relaxed">{b.body}</p>}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Stat cards */}
      <motion.div {...sec(0.08)} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<Target className="w-5 h-5" />} label="إنجاز اليوم" value={`${todayCompleted}/${todayTasks.length}`} sublabel={`${todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0}% مكتمل`} colorVar="--c-teal" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="الإنجاز الكلي" value={`${activePercentage}%`} sublabel={`${activeCompleted} من ${activeTasks.length} مهمة`} colorVar="--c-sky" />
        <StatCard icon={<Award className="w-5 h-5" />} label="أيام مكتملة" value={totalCompletedDays} sublabel={`من ${currentDay} يوم مضى`} colorVar="--c-amber" />
        {totalMissed > 0 ? (
          <button onClick={goToMissedTasks} className="text-right transition-transform hover:scale-[1.02] active:scale-[0.98]" style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
            <StatCard icon={<AlertCircle className="w-5 h-5" />} label="الاستدراك" value={totalMissed} sublabel="اضغط لعرض المهام الفائتة" colorVar="--c-rose" />
          </button>
        ) : (
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="الاستدراك" value={totalMissed} sublabel="لا مهام فائتة" colorVar="--c-teal" />
        )}
      </motion.div>

      {/* ── Today's Tasks ── */}
      <motion.div {...sec(0.14)} className="space-y-3">
        <h3 className="text-lg font-bold text-app">مهام اليوم {currentDay}</h3>

        {todayTasks.length === 0 ? (
          isRestDay ? (
            <div className="glass-card rounded-2xl p-8 text-center border" style={{ borderColor: 'var(--c-copper-bd)', background: 'var(--c-copper-bg)' }}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(176,137,104,0.15)', boxShadow: 'inset 0 0 0 1.5px var(--c-copper-bd)' }}>
                <Moon className="w-7 h-7" style={{ color: 'var(--c-copper)' }} />
              </div>
              <p className="font-extrabold text-app text-base mb-1.5">يوم استدراك وراحة</p>
              <p className="text-sm text-sub leading-relaxed">
                خصّص اليوم لمراجعة ما فاتك والراحة<br />استعدّ لمتابعة المهام غداً
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <p className="text-sub font-medium">لا توجد مهام مجدولة لهذا اليوم</p>
              <p className="text-xs text-dim mt-1">استرح، وكن مستعداً لليوم القادم</p>
            </div>
          )
        ) : (
          <>
            {/* Day summary strip */}
            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="flex items-center gap-3 flex-wrap flex-1">
                {Object.entries(todaySummary.typeCount).map(([type, count]) => {
                  const meta = TASK_TYPE_META[type as keyof typeof TASK_TYPE_META];
                  if (!meta) return null;
                  return (
                    <span key={type} className="flex items-center gap-1 text-xs text-sub">
                      <span className="text-sm">{meta.icon}</span>
                      <span className="font-medium">{count}</span>
                      <span className="text-dim">{meta.label}</span>
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-xs text-dim shrink-0">
                {remainingMinutes > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <strong className="text-app">{remainingMinutes}</strong> مهمة متبقية
                  </span>
                )}
                <span className="flex items-center gap-1" style={{ color: todayCompleted === todayTasks.length ? 'var(--c-teal)' : 'var(--c-amber)' }}>
                  {todayCompleted === todayTasks.length && <CheckCircle2 className="w-3.5 h-3.5" />}
                  <strong>{todayCompleted}/{todayTasks.length}</strong>
                  {todayCompleted === todayTasks.length ? ' مكتمل' : ' مكتملة'}
                </span>
              </div>
            </div>

            {/* Task cards */}
            <div className="space-y-3">
              {todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  studentId={studentId}
                  progress={data.progress.find((p) => p.taskId === task.id && p.studentId === studentId)}
                  showRating
                />
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* ── Overall progress ring ── */}
      <motion.div {...sec(0.2)} className="glass-card rounded-2xl p-5 text-center">
        <h3 className="text-sm font-bold text-sub mb-4">إنجازك الكلي في البرنامج</h3>
        <div className="flex items-center justify-center gap-8">
          <ProgressRing percentage={activePercentage} size={130} label="مكتمل" sublabel={`${activeCompleted}/${activeTasks.length} مهمة`} />
          <div className="space-y-3 text-right">
            <div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--c-teal)' }}>{totalCompletedDays}</div>
              <div className="text-xs text-dim">أيام مكتملة</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--c-amber)' }}>{streak}</div>
              <div className="text-xs text-dim">أيام متتالية</div>
            </div>
            {totalMissed > 0 && (
              <div>
                <div className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--c-rose)' }}>{totalMissed}</div>
                <div className="text-xs text-dim">للاستدراك</div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

    </div>
  );
}
