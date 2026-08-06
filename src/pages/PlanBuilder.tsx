import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3, X, Calendar, ChevronLeft, ChevronRight, Clock, Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, FileDown, Users, User, Save, BookOpen, Moon, Sunrise } from 'lucide-react';
import { useStore } from '../lib/store';
import { TASK_TYPE_META, type Task, type TaskType } from '../lib/types';
import { parseTasksFromExcel, downloadTaskTemplate, type ImportedTask } from '../lib/excelImport';

export function PlanBuilder() {
  const { data, addTask, addTasks, updateTask, deleteTask, deleteDayTasks, getCurrentDay, toggleRestDay } = useStore();
  const currentDay = getCurrentDay();
  const [selectedDay, setSelectedDay] = useState(currentDay);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCopyDay, setShowCopyDay] = useState(false);
  const [copyTargetDay, setCopyTargetDay] = useState(1);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);

  const dayTasks = useMemo(() => data.tasks.filter((t) => t.day === selectedDay).sort((a, b) => a.id.localeCompare(b.id)), [data.tasks, selectedDay]);
  const totalTasks = data.tasks.length;
  const daysWithTasks = new Set(data.tasks.map((t) => t.day));
  const restDaysSet = useMemo(() => new Set(data.restDays ?? []), [data.restDays]);
  const isRestDay = restDaysSet.has(selectedDay);
  const totalDays = data.config.totalDays;

  const openAdd = () => { setEditingTask(null); setShowModal(true); };
  const openEdit = (task: Task) => { setEditingTask(task); setShowModal(true); };

  const handleCopyDay = () => {
    dayTasks.forEach(({ id: _id, ...rest }) => addTask({ ...rest, day: copyTargetDay }));
    setShowCopyDay(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-app tracking-tight">الخطة اليومية — {totalDays} يوم</h2>
          <p className="text-sm text-dim mt-1">{totalTasks} مهمة موزعة على {daysWithTasks.size} يوم</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 font-medium px-4 py-2.5 rounded-2xl transition-all border" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
            <Upload className="w-4 h-4" /> استيراد من Excel
          </button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={openAdd} className="flex items-center gap-2 font-bold px-5 py-2.5 rounded-2xl transition-all" style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' }}>
            <Plus className="w-5 h-5" /> إضافة مهمة
          </motion.button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-medium text-sub">اختر اليوم</span>
        </div>
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex items-center gap-1 min-w-max">
            <button onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><ChevronRight className="w-4 h-4" /></button>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
              <button key={d} onClick={() => setSelectedDay(d)} className="w-9 h-9 rounded-xl text-sm font-medium transition-all duration-300 relative flex-shrink-0"
                style={selectedDay === d
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-border)' }
                  : restDaysSet.has(d)
                    ? { background: 'rgba(176,137,104,0.12)', color: 'var(--c-copper)' }
                    : daysWithTasks.has(d)
                      ? { background: 'var(--bg-soft)', color: 'var(--text-secondary)' }
                      : { background: 'transparent', color: 'var(--text-muted)' }}>
                {restDaysSet.has(d) ? <Moon className="w-3.5 h-3.5 mx-auto" /> : d}
                {d === currentDay && <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ background: 'var(--c-amber)' }} />}
              </button>
            ))}
            <button onClick={() => setSelectedDay(Math.min(totalDays, selectedDay + 1))} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><ChevronLeft className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-bold text-app">مهام اليوم {selectedDay}{selectedDay === currentDay && <span className="mr-2 text-[11px] px-2 py-0.5 rounded-full border" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', borderColor: 'var(--c-amber-bd)' }}>اليوم</span>}</h3>
          <div className="flex items-center gap-2">
            {dayTasks.length > 0 && (
              <>
                <button onClick={() => { setCopyTargetDay(selectedDay < totalDays ? selectedDay + 1 : 1); setShowCopyDay(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
                  <Save className="w-3.5 h-3.5" /> نسخ لليوم
                </button>
                <button onClick={() => setConfirmDeleteDay(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)', borderColor: 'var(--c-rose-bd)' }}>
                  <Trash2 className="w-3.5 h-3.5" /> حذف الكل
                </button>
              </>
            )}
          </div>
        </div>

        {dayTasks.length === 0 ? (
          isRestDay ? (
            /* ── Rest day banner ── */
            <div className="glass-card rounded-2xl p-10 text-center border" style={{ borderColor: 'var(--c-copper-bd)', background: 'var(--c-copper-bg)' }}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--c-copper-bg)', boxShadow: 'inset 0 0 0 1.5px var(--c-copper-bd)' }}>
                <Moon className="w-7 h-7" style={{ color: 'var(--c-copper)' }} />
              </div>
              <h3 className="text-lg font-bold text-app mb-1">يوم استدراك وراحة</h3>
              <p className="text-sm text-dim mb-5">هذا اليوم مخصص للاستدراك والراحة ولا توجد مهام مقررة</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
                  <Plus className="w-4 h-4" /> إضافة مهمة
                </button>
                <button onClick={() => toggleRestDay(selectedDay)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)', borderColor: 'var(--c-rose-bd)' }}>
                  <Sunrise className="w-4 h-4" /> إلغاء التعيين
                </button>
              </div>
            </div>
          ) : (
            /* ── Normal empty state ── */
            <div className="glass-card rounded-2xl p-12 text-center border-dashed" style={{ borderColor: 'var(--border)' }}>
              <Calendar className="w-10 h-10 mx-auto mb-3 text-dim" />
              <p className="text-sub mb-4">لا توجد مهام لهذا اليوم</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}><Plus className="w-4 h-4" /> إضافة مهمة</button>
                <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}><Upload className="w-4 h-4" /> استيراد</button>
                <button onClick={() => toggleRestDay(selectedDay)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border" style={{ background: 'var(--c-copper-bg)', color: 'var(--c-copper)', borderColor: 'var(--c-copper-bd)' }}>
                  <Moon className="w-4 h-4" /> تعيين كيوم استدراك
                </button>
              </div>
            </div>
          )
        ) : (
          dayTasks.map((task, i) => {
            const meta = TASK_TYPE_META[task.type];
            const cv = meta.colorVar;
            return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card rounded-2xl p-4 sm:p-5 border transition-all duration-300 group hover-lift" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl border flex items-center justify-center text-xl flex-shrink-0" style={{ background: `var(${cv}-bg)`, borderColor: `var(${cv}-bd)` }}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ background: `var(${cv}-bg)`, color: `var(${cv})` }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${cv})` }} />{meta.label}</span>
                      {task.requiresSubmission && <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', borderColor: 'var(--c-amber-bd)' }}>يتطلب تسليم</span>}
                      {task.targetGroups?.length ? <span className="text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1" style={{ background: 'var(--c-teal-bg)', color: 'var(--c-teal)', borderColor: 'var(--c-teal-bd)' }}><Users className="w-3 h-3" />{task.targetGroups.join(', ')}</span> : null}
                      {task.targetStudentIds?.length ? <span className="text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1" style={{ background: 'var(--c-mauve-bg)', color: 'var(--c-mauve)', borderColor: 'var(--c-mauve-bd)' }}><User className="w-3 h-3" />{task.targetStudentIds.length} طالب</span> : null}
                    </div>
                    <h4 className="font-bold text-app mb-1">{task.title}</h4>
                    <p className="text-sm text-sub leading-relaxed">{task.description}</p>
                    {task.url && <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-xs mt-2 inline-block transition-colors hover:opacity-80" style={{ color: 'var(--c-sky)' }}>{task.url}</a>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={() => openEdit(task)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => deleteTask(task.id)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showModal && <TaskModal day={selectedDay} task={editingTask} onClose={() => setShowModal(false)} onSave={(taskData) => { if (editingTask) updateTask(editingTask.id, taskData); else addTask(taskData); setShowModal(false); }} />}
      </AnimatePresence>

      <AnimatePresence>
        {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={(tasks) => { addTasks(tasks); setShowImport(false); }} />}
      </AnimatePresence>

      {/* Copy day modal */}
      <AnimatePresence>
        {showCopyDay && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowCopyDay(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="glass-card rounded-2xl p-6 w-full max-w-sm border pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-lg font-bold text-app mb-4">نسخ مهام اليوم {selectedDay}</h3>
                <p className="text-sm text-sub mb-4">سيتم نسخ {dayTasks.length} مهمة إلى اليوم المحدد (إضافة فوق المهام الموجودة).</p>
                <div className="mb-5">
                  <label className="text-xs text-dim mb-2 block font-medium">اليوم الهدف</label>
                  <select value={copyTargetDay} onChange={(e) => setCopyTargetDay(Number(e.target.value))} className="w-full rounded-2xl py-2.5 px-3 text-sm border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {Array.from({ length: totalDays }, (_, i) => i + 1).filter(d => d !== selectedDay).map(d => (
                      <option key={d} value={d}>يوم {d}{daysWithTasks.has(d) ? ' (به مهام)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopyDay} className="flex-1 rounded-2xl py-3 font-bold transition-colors" style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}>نسخ</button>
                  <button onClick={() => setShowCopyDay(false)} className="flex-1 rounded-2xl py-3 font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirm delete all day tasks */}
      <AnimatePresence>
        {confirmDeleteDay && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setConfirmDeleteDay(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="glass-card rounded-2xl p-6 w-full max-w-sm border pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-lg font-bold text-app mb-2">حذف مهام اليوم {selectedDay}</h3>
                <p className="text-sm text-sub mb-5">سيتم حذف {dayTasks.length} مهمة وسجلات إنجازها نهائياً. هل أنت متأكد؟</p>
                <div className="flex gap-2">
                  <button onClick={() => { deleteDayTasks(selectedDay); setConfirmDeleteDay(false); }} className="flex-1 rounded-2xl py-3 font-bold transition-colors" style={{ background: 'var(--c-rose)', color: 'var(--bg-base)' }}>نعم، احذف</button>
                  <button onClick={() => setConfirmDeleteDay(false)} className="flex-1 rounded-2xl py-3 font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// === Import Modal ===
function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (tasks: Omit<Task, 'id'>[]) => void }) {
  const [parsedTasks, setParsedTasks] = useState<ImportedTask[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    const result = await parseTasksFromExcel(file);
    setParsedTasks(result.tasks);
    setErrors(result.errors);
    setSkipped(result.skipped);
    setLoading(false);
  };

  const handleConfirm = () => {
    if (!parsedTasks || parsedTasks.length === 0) return;
    onImport(parsedTasks.map(t => ({
      day: t.day,
      type: t.type,
      title: t.title,
      description: t.description,
      url: t.url,
      requiresSubmission: t.requiresSubmission,
      submissionType: t.submissionType,
    })));
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border max-h-[90vh] overflow-y-auto pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-app flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--accent)' }} /> استيراد المهام من Excel</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
          </div>

          {/* Template download */}
          <div className="rounded-2xl p-4 border mb-4 flex items-center justify-between" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
            <div>
              <div className="text-sm font-medium text-app">قالب الاستيراد</div>
              <div className="text-xs text-dim mt-0.5">حمّل القالب الجاهز، املأه، ثم ارفعه هنا</div>
            </div>
            <button onClick={downloadTaskTemplate} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all border" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
              <FileDown className="w-4 h-4" /> تحميل القالب
            </button>
          </div>

          {/* File upload */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={loading} className="w-full border-2 border-dashed rounded-2xl py-10 flex flex-col items-center gap-3 transition-all" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            {loading ? (
              <><div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /><span className="text-sm">جاري القراءة...</span></>
            ) : (
              <><Upload className="w-8 h-8" /><span className="text-sm font-medium">{fileName || 'اضغط لاختيار ملف Excel أو CSV'}</span></>
            )}
          </button>

          {/* Expected columns info */}
          <div className="mt-3 rounded-xl p-3 border text-xs text-dim leading-relaxed" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
            <span className="font-medium text-sub">الأعمدة المتوقعة:</span> اليوم، النوع (فيديو/حفظ/قراءة/pdf/رابط/صوتي/اختبار)، العنوان، الوصف، الرابط، التسليم (صوتي/نص/رابط أو فارغ)
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-4 rounded-2xl p-3 border" style={{ background: 'var(--c-amber-bg)', borderColor: 'var(--c-amber-bd)' }}>
              <div className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: 'var(--c-amber)' }}><AlertTriangle className="w-4 h-4" /> تنبيهات ({errors.length})</div>
              <ul className="text-xs space-y-1 max-h-32 overflow-y-auto" style={{ color: 'var(--c-amber)' }}>
                {errors.slice(0, 20).map((e, i) => <li key={i}>• {e}</li>)}
                {errors.length > 20 && <li>... و {errors.length - 20} تنبيه آخر</li>}
              </ul>
            </div>
          )}

          {/* Preview */}
          {parsedTasks && parsedTasks.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--st-done)' }} />
                <span className="text-sm font-medium text-app">تم قراءة {parsedTasks.length} مهمة{skipped > 0 ? ` (${skipped} صف تم تخطيه)` : ''}</span>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead><tr style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><th className="p-2 text-right font-medium">اليوم</th><th className="p-2 text-right font-medium">النوع</th><th className="p-2 text-right font-medium">العنوان</th><th className="p-2 text-center font-medium">تسليم</th></tr></thead>
                    <tbody>
                      {parsedTasks.slice(0, 50).map((t, i) => {
                        const meta = TASK_TYPE_META[t.type];
                        return (
                          <tr key={i} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                            <td className="p-2 text-dim tabular-nums">{t.day}</td>
                            <td className="p-2"><span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: `var(${meta.colorVar}-bg)`, color: `var(${meta.colorVar})` }}>{meta.icon} {meta.label}</span></td>
                            <td className="p-2 text-app">{t.title.substring(0, 35)}</td>
                            <td className="p-2 text-center text-dim">{t.requiresSubmission ? (t.submissionType === 'audio' ? 'صوتي' : t.submissionType === 'text' ? 'نص' : 'رابط') : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {parsedTasks.length > 50 && <div className="p-2 text-center text-xs text-dim">... و {parsedTasks.length - 50} مهمة أخرى</div>}
              </div>
            </div>
          )}

          {/* Actions */}
          {parsedTasks && parsedTasks.length > 0 && (
            <div className="flex items-center gap-2 mt-5">
              <button onClick={handleConfirm} className="flex-1 flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-all duration-300" style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' }}>
                <Download className="w-5 h-5" /> استيراد {parsedTasks.length} مهمة
              </button>
              <button onClick={() => { setParsedTasks(null); setErrors([]); setSkipped(0); setFileName(''); }} className="rounded-2xl px-5 py-3.5 text-sm font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إعادة</button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

interface TaskModalProps { day: number; task: Task | null; onClose: () => void; onSave: (task: Omit<Task, 'id'>) => void; }

function TaskModal({ day, task, onClose, onSave }: TaskModalProps) {
  const { data, addStudentList, deleteStudentList } = useStore();
  const [newListName, setNewListName] = useState('');
  const [type, setType] = useState<TaskType>(task?.type ?? 'video');
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [url, setUrl] = useState(task?.url ?? '');
  const [requiresSubmission, setRequiresSubmission] = useState(task?.requiresSubmission ?? false);
  const [submissionType, setSubmissionType] = useState(task?.submissionType ?? 'text');

  const existingGroups = useMemo(
    () => Array.from(new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]).filter(Boolean))).sort(),
    [data.students],
  );

  const initScope = (): 'all' | 'groups' | 'students' => {
    if (task?.targetStudentIds?.length) return 'students';
    if (task?.targetGroups?.length) return 'groups';
    return 'all';
  };
  const [scope, setScope] = useState<'all' | 'groups' | 'students'>(initScope);
  const [selectedGroups, setSelectedGroups] = useState<string[]>(task?.targetGroups ?? []);
  const [selectedStudents, setSelectedStudents] = useState<string[]>(task?.targetStudentIds ?? []);

  const toggleGroup = (g: string) =>
    setSelectedGroups((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  const toggleStudent = (id: string) =>
    setSelectedStudents((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetGroups = scope === 'groups' && selectedGroups.length > 0 ? selectedGroups : undefined;
    const targetStudentIds = scope === 'students' && selectedStudents.length > 0 ? selectedStudents : undefined;
    onSave({ day, type, title, description, url: url || undefined, requiresSubmission, submissionType: requiresSubmission ? submissionType : undefined, targetGroups, targetStudentIds });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="glass-card rounded-2xl p-6 w-full max-w-lg border max-h-[90vh] overflow-y-auto pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-app">{task ? 'تعديل مهمة' : 'إضافة مهمة جديدة'} — اليوم {day}</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">نوع المهمة</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(TASK_TYPE_META) as TaskType[]).map((t) => {
                  const meta = TASK_TYPE_META[t];
                  const cv = meta.colorVar;
                  const isActive = type === t;
                  return (
                    <button key={t} type="button" onClick={() => setType(t)} className="flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs transition-all duration-300" style={isActive ? { background: `var(${cv}-bg)`, color: `var(${cv})`, borderColor: `var(${cv}-bd)` } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
                      <span className="text-lg">{meta.icon}</span>{meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div><label className="text-xs text-dim mb-2 block font-medium">عنوان المهمة</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-2xl py-2.5 px-3.5 text-app text-sm focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} placeholder="مثال: محاضرة أصول الفقه..." /></div>
            <div><label className="text-xs text-dim mb-2 block font-medium">الوصف</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} className="w-full rounded-2xl py-2.5 px-3.5 text-app text-sm focus-accent resize-none leading-relaxed border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} placeholder="وصف المهمة..." /></div>
            <div><label className="text-xs text-dim mb-2 block font-medium">الرابط (اختياري)</label><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-2xl py-2.5 px-3.5 text-app text-sm focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} placeholder="https://..." /></div>
            <div className="flex items-center gap-3 p-3.5 rounded-2xl border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}><input type="checkbox" id="requiresSubmission" checked={requiresSubmission} onChange={(e) => setRequiresSubmission(e.target.checked)} className="w-5 h-5 rounded" style={{ accentColor: 'var(--accent)' }} /><label htmlFor="requiresSubmission" className="text-sm text-app cursor-pointer">يتطلب تسليم واجب من الطالب</label></div>
            {requiresSubmission && (
              <div><label className="text-xs text-dim mb-2 block font-medium">نوع التسليم</label><div className="grid grid-cols-3 gap-2">
                {[{ value: 'audio', label: 'رفع صوتي' }, { value: 'text', label: 'نص' }, { value: 'link', label: 'رابط' }].map((st) => (
                  <button key={st.value} type="button" onClick={() => setSubmissionType(st.value as 'audio' | 'text' | 'link')} className="py-2 rounded-2xl border text-sm transition-all duration-300" style={submissionType === st.value ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>{st.label}</button>
                ))}
              </div></div>
            )}

            {/* ── Task Targeting ── */}
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">نطاق المهمة — من يرى هذه المهمة؟</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { v: 'all' as const, label: '🌐 جميع الطلاب' },
                  { v: 'groups' as const, label: '👥 مجموعات' },
                  { v: 'students' as const, label: '👤 طلاب محددون' },
                ]).map(({ v, label }) => (
                  <button key={v} type="button" onClick={() => setScope(v)} className="py-2 rounded-2xl border text-xs font-medium transition-all duration-300" style={scope === v ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>{label}</button>
                ))}
              </div>

              {scope === 'groups' && (
                <div className="rounded-2xl border p-3" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                  {existingGroups.length === 0 ? (
                    <p className="text-xs text-dim text-center py-2">لا توجد مجموعات — أضف طلاباً أولاً</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {existingGroups.map((g) => (
                        <button key={g} type="button" onClick={() => toggleGroup(g)} className="px-3 py-1.5 rounded-xl border text-sm transition-all" style={selectedGroups.includes(g) ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' } : { background: 'var(--bg-base)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                          {selectedGroups.includes(g) ? '✓ ' : ''}{g}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedGroups.length === 0 && existingGroups.length > 0 && <p className="text-[11px] text-dim mt-2">اختر مجموعة واحدة على الأقل</p>}
                </div>
              )}

              {scope === 'students' && (
                <div className="space-y-2">
                  {/* Saved lists */}
                  {(data.studentLists ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] text-dim flex items-center gap-1 ml-1"><BookOpen className="w-3 h-3" /> قوائم محفوظة:</span>
                      {(data.studentLists ?? []).map((list) => (
                        <div key={list.id} className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setSelectedStudents(list.studentIds)}
                            className="text-[11px] px-2.5 py-1 rounded-lg border transition-all"
                            style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}
                          >
                            {list.name} ({list.studentIds.length})
                          </button>
                          <button type="button" onClick={() => deleteStudentList(list.id)} className="w-5 h-5 rounded flex items-center justify-center" style={{ color: 'var(--c-rose)' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Student list */}
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
                    {data.students.length === 0 ? (
                      <p className="text-xs text-dim text-center p-4">لا يوجد طلاب بعد</p>
                    ) : (
                      <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: 'var(--border-soft)' }}>
                        {data.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((s) => (
                          <button key={s.id} type="button" onClick={() => toggleStudent(s.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors" style={selectedStudents.includes(s.id) ? { background: 'var(--accent-soft)' } : { background: 'transparent' }}>
                            <div className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 text-xs font-bold" style={selectedStudents.includes(s.id) ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--bg-base)' } : { borderColor: 'var(--border)', color: 'transparent' }}>✓</div>
                            <span className="text-sm text-app flex-1 text-right">{s.name}</span>
                            <span className="text-[11px] text-dim">{(s.groups?.length ? s.groups : [s.group]).join(', ')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedStudents.length > 0 && <div className="px-4 py-2 text-[11px] font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>✓ {selectedStudents.length} طالب محدد</div>}
                  </div>

                  {/* Save as named list */}
                  {selectedStudents.length > 0 && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="اسم القائمة…"
                        className="flex-1 px-3 py-1.5 rounded-xl text-xs border bg-transparent text-app outline-none"
                        style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newListName.trim()) {
                            addStudentList({ name: newListName.trim(), studentIds: selectedStudents });
                            setNewListName('');
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}
                      >
                        <Save className="w-3 h-3" /> حفظ كقائمة
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} type="submit" className="w-full font-bold py-3.5 rounded-2xl transition-all duration-300" style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' }}>{task ? 'حفظ التعديلات' : 'إضافة المهمة'}</motion.button>
          </form>
        </div>
      </motion.div>
    </>
  );
}
