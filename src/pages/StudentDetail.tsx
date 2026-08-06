import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Phone, Send, MessageCircle, Star, CheckCircle2, Clock, X, Calendar } from 'lucide-react';
import { useStore } from '../lib/store';
import { ProgressRing } from '../components/ProgressRing';
import { ProgressBar } from '../components/ProgressBar';
import { TASK_TYPE_META, ATTENDANCE_META } from '../lib/types';

export function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, getCurrentDay, getStudentProgress, rateSubmission } = useStore();
  const currentDay = getCurrentDay();
  const [dayFilter, setDayFilter] = useState(currentDay);
  const [ratingModal, setRatingModal] = useState<{ taskId: string; taskTitle: string } | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingNote, setRatingNote] = useState('');

  const student = data.students.find((s) => s.id === id);
  const progress = id ? getStudentProgress(id) : null;

  const dayTasks = useMemo(() => data.tasks.filter((t) => t.day === dayFilter), [data.tasks, dayFilter]);
  const studentProgressForDay = useMemo(() => {
    if (!id) return [];
    return dayTasks.map((task) => ({ task, progress: data.progress.find((p) => p.taskId === task.id && p.studentId === id) }));
  }, [dayTasks, data.progress, id]);

  const dailyHistory = useMemo(() => {
    if (!id) return [];
    const history = [];
    for (let d = 1; d <= currentDay; d++) {
      const tasks = data.tasks.filter((t) => t.day === d);
      const completed = tasks.filter((t) => data.progress.some((p) => p.taskId === t.id && p.studentId === id && p.status === 'completed')).length;
      history.push({ day: d, completed, total: tasks.length });
    }
    return history;
  }, [data.tasks, data.progress, id, currentDay]);

  const attendanceHistory = useMemo(() => {
    if (!id) return [];
    const today = new Date();
    const records = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const rec = (data.attendance ?? []).find((a) => a.studentId === id && a.date === dateStr);
      records.push({ date: dateStr, record: rec });
    }
    return records;
  }, [data.attendance, id]);

  if (!student || !progress) {
    return <div className="text-center py-20"><p className="text-sub">الطالب غير موجود</p><button onClick={() => navigate('/students')} className="mt-4 text-accent">العودة</button></div>;
  }

  const handleRate = () => {
    if (!id || !ratingModal) return;
    rateSubmission(id, ratingModal.taskId, rating, ratingNote);
    setRatingModal(null); setRating(0); setRatingNote('');
  };

  const whatsappLink = student.phone
    ? `https://wa.me/${student.phone.replace(/\s+/g, '').replace(/^00963/, '963').replace(/^0/, '963')}`
    : null;
  const telegramLink = student.telegramHandle ? `https://t.me/${student.telegramHandle.replace('@', '')}` : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <button onClick={() => navigate('/students')} className="flex items-center gap-2 text-dim hover:text-accent transition-colors text-sm font-medium">
        <ArrowRight className="w-4 h-4" /> العودة لقائمة الطلاب
      </button>

      <div className="glass-card rounded-2xl p-5 sm:p-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl" style={{ background: 'var(--accent-soft)' }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-extrabold text-xl sm:text-2xl flex-shrink-0" style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 0 24px -4px var(--accent-glow)' }}>{student.name.charAt(0)}</div>
            <div>
              <h2 className="text-xl font-extrabold text-app tracking-tight">{student.name}</h2>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>مجموعة {student.group}</span>
                {student.phone && <span className="flex items-center gap-1 text-xs text-dim"><Phone className="w-3 h-3" /> {student.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-all hover:scale-105 border" style={{ background: 'var(--c-emerald-bg)', color: 'var(--c-emerald)', borderColor: 'var(--c-emerald-bd)' }}><MessageCircle className="w-4 h-4" /> واتساب</a>
            ) : (
              <span className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium border opacity-40 cursor-not-allowed select-none" style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)', borderColor: 'var(--border-soft)' }}><MessageCircle className="w-4 h-4" /> واتساب</span>
            )}
            {telegramLink ? (
              <a href={telegramLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium transition-all hover:scale-105 border" style={{ background: 'var(--c-sky-bg)', color: 'var(--c-sky)', borderColor: 'var(--c-sky-bd)' }}><Send className="w-4 h-4" /> تيليجرام</a>
            ) : (
              <span className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium border opacity-40 cursor-not-allowed select-none" style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)', borderColor: 'var(--border-soft)' }}><Send className="w-4 h-4" /> تيليجرام</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="glass-card rounded-2xl p-5 text-center">
          <h3 className="text-sm font-bold text-sub mb-4">الإنجاز الكلي</h3>
          <ProgressRing percentage={progress.percentage} size={130} label={`${progress.completed}/${progress.total}`} />
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-bold text-sub mb-4">إحصائيات</h3>
          <div className="space-y-3">
            {[
              { label: 'مهام مكتملة', value: progress.completed, cv: '--c-teal' },
              { label: 'مهام متبقية', value: progress.total - progress.completed, cv: '--c-amber' },
              { label: 'إنجاز اليوم', value: `${progress.todayCompleted}/${progress.todayTotal}`, cv: '--c-sky' },
              { label: 'نسبة اليوم', value: `${progress.todayPercentage}%`, cv: '--accent' },
            ].map((s) => (
              <div key={s.label} className="flex justify-between items-center">
                <span className="text-sm text-sub">{s.label}</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: `var(${s.cv})` }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-bold text-sub mb-4">سجل الأيام</h3>
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {dailyHistory.map((d) => (
              <div key={d.day} className="flex items-center gap-2">
                <span className="text-[11px] text-dim w-10 font-medium">يوم {d.day}</span>
                <div className="flex-1"><ProgressBar percentage={d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0} height={5} /></div>
                <span className="text-[11px] text-dim w-10 text-left tabular-nums">{d.completed}/{d.total}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-bold text-sub mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            سجل الحضور
          </h3>
          <div className="space-y-2">
            {attendanceHistory.length === 0 ? (
              <p className="text-xs text-dim text-center py-3">لا يوجد سجل حضور</p>
            ) : attendanceHistory.map(({ date, record }) => {
              const label = new Date(date).toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' });
              if (!record) {
                return (
                  <div key={date} className="flex items-center justify-between text-xs">
                    <span className="text-dim">{label}</span>
                    <span className="text-dim">—</span>
                  </div>
                );
              }
              const meta = ATTENDANCE_META[record.status];
              return (
                <div key={date} className="flex items-center justify-between text-xs">
                  <span className="text-sub">{label}</span>
                  <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-dim font-medium">عرض يوم:</span>
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex items-center gap-1 min-w-max">
            {Array.from({ length: currentDay }, (_, i) => i + 1).map((d) => (
              <button key={d} onClick={() => setDayFilter(d)} className="w-9 h-9 flex-shrink-0 rounded-xl text-sm font-medium transition-all duration-300" style={dayFilter === d ? { background: 'var(--accent-soft)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-border)' } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>{d}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-app">مهام اليوم {dayFilter} — {student.name}</h3>
        {studentProgressForDay.map(({ task, progress: prog }) => {
          const meta = TASK_TYPE_META[task.type];
          const isCompleted = prog?.status === 'completed';
          const cv = meta.colorVar;
          return (
            <div key={task.id} className="glass-card rounded-2xl p-4 sm:p-5 border transition-all duration-300" style={{ borderColor: isCompleted ? 'var(--c-teal-bd)' : 'var(--border-soft)', background: isCompleted ? 'var(--c-teal-bg)' : undefined }}>
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">{isCompleted ? <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--c-teal)' }} /> : <Clock className="w-6 h-6 text-dim" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1" style={{ background: `var(${cv}-bg)`, color: `var(${cv})`, borderColor: `var(${cv}-bd)` }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${cv})` }} />{meta.label}</span>
                    {isCompleted && prog?.completedAt && <span className="text-[11px]" style={{ color: 'var(--c-teal)' }}>{new Date(prog.completedAt).toLocaleString('ar-SA')}</span>}
                  </div>
                  <h4 className={`font-bold mb-1 ${isCompleted ? 'text-dim' : 'text-app'}`}>{task.title}</h4>
                  <p className="text-sm text-sub leading-relaxed">{task.description}</p>

                  {isCompleted && task.requiresSubmission && (
                    <div className="mt-3 space-y-2">
                      {prog?.submissionNote && <div className="rounded-xl p-3 text-sm text-sub border leading-relaxed" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}><span className="text-[11px] text-dim block mb-1 font-medium">ملاحظة الطالب:</span>{prog.submissionNote}</div>}
                      {prog?.submissionLink && <a href={prog.submissionLink} target="_blank" rel="noopener noreferrer" className="text-sm inline-flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: 'var(--c-sky)' }}>📎 رابط الواجب</a>}
                      {prog?.audioDataUrl && <div className="flex items-center gap-2 rounded-xl p-2.5 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}><span className="text-xs text-dim">تسجيل الحفظ:</span><audio controls src={prog.audioDataUrl} className="h-8 max-w-xs" /></div>}
                    </div>
                  )}

                  {isCompleted && task.requiresSubmission && (
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      {prog?.supervisorRating ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-dim">تقييمك:</span>
                          <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className="w-4 h-4" style={s <= prog.supervisorRating! ? { color: 'var(--c-amber)', fill: 'var(--c-amber)' } : { color: 'var(--border)' }} />)}</div>
                          {prog.supervisorNote && <span className="text-xs text-sub">— {prog.supervisorNote}</span>}
                          <button onClick={() => { setRating(prog.supervisorRating!); setRatingNote(prog.supervisorNote ?? ''); setRatingModal({ taskId: task.id, taskTitle: task.title }); }} className="text-xs text-accent hover:underline mr-2">تعديل</button>
                        </div>
                      ) : (
                        <button onClick={() => { setRating(0); setRatingNote(''); setRatingModal({ taskId: task.id, taskTitle: task.title }); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all hover:scale-105 border" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', borderColor: 'var(--c-amber-bd)' }}><Star className="w-3.5 h-3.5" /> تقييم التسليم</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {ratingModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setRatingModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="glass-card rounded-2xl p-6 w-full max-w-md border pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-app">تقييم التسليم</h3>
                  <button onClick={() => setRatingModal(null)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
                </div>
                <div className="rounded-xl p-3 mb-4 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}><p className="text-sm text-sub">{ratingModal.taskTitle}</p></div>
                <div className="mb-4">
                  <label className="text-xs text-dim mb-2 block font-medium">التقييم:</label>
                  <div className="flex gap-2">{[1, 2, 3, 4, 5].map((s) => <button key={s} onClick={() => setRating(s)}><Star className="w-8 h-8 transition-all hover:scale-110" style={s <= rating ? { color: 'var(--c-amber)', fill: 'var(--c-amber)' } : { color: 'var(--border)' }} /></button>)}</div>
                </div>
                <div className="mb-4">
                  <label className="text-xs text-dim mb-2 block font-medium">ملاحظة (اختياري):</label>
                  <textarea value={ratingNote} onChange={(e) => setRatingNote(e.target.value)} rows={3} className="w-full rounded-2xl p-3.5 text-app text-sm focus-accent resize-none leading-relaxed border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} placeholder="اكتب ملاحظتك للطالب..." />
                </div>
                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} onClick={handleRate} disabled={rating === 0} className="w-full font-bold py-3.5 rounded-2xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: 'var(--c-amber)', color: 'var(--bg-base)' }}>حفظ التقييم</motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
