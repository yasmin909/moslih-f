import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock, Lock } from 'lucide-react';
import { useStore } from '../lib/store';
import { TaskCard } from '../components/TaskCard';
import { TASK_TYPE_META } from '../lib/types';

export function DaysGrid() {
  const { data, currentUser, getCurrentDay, getTasksForStudent } = useStore();
  const location = useLocation();
  const currentDay = getCurrentDay();
  const studentId = currentUser?.studentId ?? '';

  const initialDay = (location.state as { initialDay?: number } | null)?.initialDay;
  const [selectedDay, setSelectedDay] = useState(() => initialDay ?? currentDay);

  const studentTasks = useMemo(
    () => getTasksForStudent(studentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, data.students, studentId],
  );

  const dayStats = useMemo(() => {
    const map: Record<number, { total: number; completed: number }> = {};
    for (let d = 1; d <= data.config.totalDays; d++) {
      const dayTasks = studentTasks.filter((t) => t.day === d);
      const completed = dayTasks.filter((t) =>
        data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      ).length;
      map[d] = { total: dayTasks.length, completed };
    }
    return map;
  }, [studentTasks, data.progress, studentId, data.config.totalDays]);

  const selectedTasks = useMemo(
    () => studentTasks.filter((t) => t.day === selectedDay),
    [studentTasks, selectedDay],
  );

  const selectedCompleted = useMemo(
    () =>
      selectedTasks.filter((t) =>
        data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
      ).length,
    [selectedTasks, data.progress, studentId],
  );

  const remainingMinutes = useMemo(
    () =>
      selectedTasks
        .filter((t) =>
          !data.progress.some((p) => p.taskId === t.id && p.studentId === studentId && p.status === 'completed'),
        )
        .length,
    [selectedTasks, data.progress, studentId],
  );

  const selectedDaySummary = useMemo(() => {
    const typeCount: Record<string, number> = {};
    for (const task of selectedTasks) {
      typeCount[task.type] = (typeCount[task.type] ?? 0) + 1;
    }
    return { typeCount };
  }, [selectedTasks]);

  const isPast = selectedDay < currentDay;
  const selectedDayDone =
    (dayStats[selectedDay]?.total ?? 0) > 0 &&
    (dayStats[selectedDay]?.completed ?? 0) === (dayStats[selectedDay]?.total ?? 0);
  const totalDays = data.config.totalDays;

  function dayChipStyle(day: number) {
    const s = dayStats[day] ?? { total: 0, completed: 0 };
    const allDone = s.total > 0 && s.completed === s.total;
    const partial = s.completed > 0 && s.completed < s.total;
    const none = s.total > 0 && s.completed === 0;
    const selected = day === selectedDay;
    const future = day > currentDay;
    const current = day === currentDay;
    const past = day < currentDay;

    if (current) return { bg: selected ? 'var(--accent)' : 'var(--accent-soft)', color: selected ? 'var(--bg-base)' : 'var(--accent)', border: 'var(--accent-border)', ring: selected };
    if (past) {
      if (s.total === 0) return { bg: 'var(--bg-soft)', color: 'var(--text-muted)', border: 'var(--border-soft)', ring: selected };
      if (allDone) return { bg: selected ? 'var(--c-teal)' : 'var(--c-teal-bg)', color: selected ? 'var(--bg-base)' : 'var(--c-teal)', border: 'var(--c-teal-bd)', ring: selected };
      if (partial) return { bg: selected ? 'var(--c-amber)' : 'var(--c-amber-bg)', color: selected ? 'var(--bg-base)' : 'var(--c-amber)', border: 'var(--c-amber-bd)', ring: selected };
      if (none) return { bg: selected ? 'var(--c-rose)' : 'var(--c-rose-bg)', color: selected ? 'var(--bg-base)' : 'var(--c-rose)', border: 'var(--c-rose-bd)', ring: selected };
    }
    if (future) return { bg: 'var(--bg-card)', color: 'var(--text-muted)', border: 'var(--border-soft)', ring: false };
    return { bg: 'var(--bg-soft)', color: 'var(--text-muted)', border: 'var(--border-soft)', ring: selected };
  }

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">

      {/* ── Days Grid ── */}
      <motion.div variants={item} className="glass-card rounded-2xl p-5 sm:p-6">
        {/* Header + legend */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-app">جدول أيام البرنامج</h3>
          <div className="flex items-center gap-3 text-[10px] text-dim flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--c-teal)' }} />مكتمل</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--c-amber)' }} />ناقص</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--c-rose)' }} />لم يُنجز</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />اليوم</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--bg-soft)', border: '1px solid var(--border-soft)' }} />لا مهام</span>
            <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" style={{ opacity: 0.5 }} />قادم</span>
          </div>
        </div>

        {/* Chips — flex-wrap */}
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
            const cs = dayChipStyle(day);
            const future = day > currentDay;
            const s = dayStats[day] ?? { total: 0, completed: 0 };
            const showCount = !future && s.total > 0;
            return (
              <button
                key={day}
                disabled={future}
                onClick={() => !future && setSelectedDay(day)}
                className="relative flex flex-col items-center justify-center w-11 h-12 rounded-xl border transition-all duration-150"
                style={{
                  background: future ? 'transparent' : cs.bg,
                  color: future ? 'var(--text-muted)' : cs.color,
                  borderColor: future ? 'var(--border-soft)' : cs.border,
                  borderStyle: future ? 'dashed' : 'solid',
                  cursor: future ? 'default' : 'pointer',
                  boxShadow: cs.ring
                    ? `0 0 0 2px var(--bg-base), 0 0 0 4px ${cs.border}`
                    : undefined,
                }}
                title={future ? `يوم ${day} — لم يحن بعد` : `يوم ${day} · ${s.completed}/${s.total}`}
              >
                {future && (
                  <Lock
                    className="absolute top-1 right-1 w-2.5 h-2.5 pointer-events-none"
                    style={{ color: 'var(--text-muted)', opacity: 0.45 }}
                  />
                )}
                <span className="text-sm font-bold leading-none" style={{ opacity: future ? 0.4 : 1 }}>{day}</span>
                {showCount && (
                  <span className="text-[9px] leading-none mt-0.5 font-medium opacity-75">
                    {s.completed}/{s.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Selected Day Tasks ── */}
      <motion.div variants={item} className="space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-app">مهام اليوم {selectedDay}</h3>
            {isPast ? (
              selectedDayDone ? (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold border" style={{ background: 'var(--c-teal-bg)', color: 'var(--c-teal)', borderColor: 'var(--c-teal-bd)' }}>
                  ✓ مكتمل
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold border" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', borderColor: 'var(--c-amber-bd)' }}>
                  استدراك
                </span>
              )
            ) : (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold border" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
                اليوم الحالي
              </span>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1.5">
            {selectedDay !== currentDay && (
              <button
                onClick={() => setSelectedDay(currentDay)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 2px 8px -2px var(--accent-glow)' }}
              >
                <Calendar className="w-3.5 h-3.5" />
                العودة لليوم الحالي
              </button>
            )}
            <button
              disabled={selectedDay <= 1}
              onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all"
              style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)', opacity: selectedDay <= 1 ? 0.3 : 1 }}
              title="اليوم السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              disabled={selectedDay >= currentDay}
              onClick={() => setSelectedDay((d) => Math.min(currentDay, d + 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all"
              style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)', opacity: selectedDay >= currentDay ? 0.3 : 1 }}
              title="اليوم التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {selectedTasks.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-dim" />
            <p className="text-sub">لا توجد مهام لهذا اليوم</p>
          </div>
        ) : (
          <>
            {/* Day summary strip */}
            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="flex items-center gap-3 flex-wrap flex-1">
                {Object.entries(selectedDaySummary.typeCount).map(([type, count]) => {
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
                <span className="flex items-center gap-1" style={{ color: selectedCompleted === selectedTasks.length ? 'var(--c-teal)' : 'var(--c-amber)' }}>
                  <strong>{selectedCompleted}/{selectedTasks.length}</strong>
                  {selectedCompleted === selectedTasks.length ? ' ✓ مكتمل' : ' مكتملة'}
                </span>
              </div>
            </div>

            {/* Task cards */}
            <div className="space-y-3">
              {selectedTasks.map((task) => (
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

    </motion.div>
  );
}
