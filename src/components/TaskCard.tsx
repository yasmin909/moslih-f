import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Clock,
  Upload,
  Mic,
  MicOff,
  Star,
  X,
  FileText,
  Link2,
  Edit3,
  AlertTriangle,
  Square,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Task, TaskProgress } from '../lib/types';
import { TASK_TYPE_META } from '../lib/types';
import { useStore } from '../lib/store';

interface TaskCardProps {
  task: Task;
  progress?: TaskProgress;
  studentId: string;
  showRating?: boolean;
}

export function TaskCard({ task, progress, studentId, showRating }: TaskCardProps) {
  const { completeTask, uncompleteTask } = useStore();
  const [showSubmission, setShowSubmission] = useState(false);
  const [note, setNote] = useState(progress?.submissionNote ?? '');
  const [link, setLink] = useState(progress?.submissionLink ?? '');
  const [audioName, setAudioName] = useState(progress?.audioDataUrl ? 'تسجيل صوتي' : '');
  const [audioData, setAudioData] = useState<string | undefined>(progress?.audioDataUrl);
  const [audioError, setAudioError] = useState('');
  const [confirmUncomplete, setConfirmUncomplete] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_REC_SECONDS = 300; // 5 minutes max

  // Sync submission fields when progress changes (e.g., after editing)
  useEffect(() => {
    setNote(progress?.submissionNote ?? '');
    setLink(progress?.submissionLink ?? '');
    setAudioData(progress?.audioDataUrl);
    setAudioName(progress?.audioDataUrl ? 'تسجيل صوتي' : '');
  }, [progress?.submissionNote, progress?.submissionLink, progress?.audioDataUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setAudioData(reader.result as string);
          setAudioName('تسجيل صوتي');
          setAudioError('');
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          if (t + 1 >= MAX_REC_SECONDS) {
            // Auto-stop at limit
            mediaRecorderRef.current?.stop();
            mediaRecorderRef.current = null;
            setRecording(false);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          }
          return t + 1;
        });
      }, 1000);
    } catch {
      setAudioError('تعذّر الوصول إلى الميكروفون');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const meta = TASK_TYPE_META[task.type];
  const isCompleted = progress?.status === 'completed';
  const accentColor = `var(${meta.colorVar})`;

  const handleComplete = () => {
    if (task.requiresSubmission && !progress?.status) {
      setShowSubmission(true);
      return;
    }
    completeTask(studentId, task.id);
  };

  const handleSubmit = () => {
    const submission: Partial<TaskProgress> = {};
    if (task.submissionType === 'text') submission.submissionNote = note;
    if (task.submissionType === 'link') submission.submissionLink = link;
    if (task.submissionType === 'audio') submission.audioDataUrl = audioData;
    completeTask(studentId, task.id, submission);
    setShowSubmission(false);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setAudioError('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.');
      return;
    }
    setAudioError('');
    const reader = new FileReader();
    reader.onload = () => {
      setAudioData(reader.result as string);
      setAudioName(file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`${isCompleted ? 'card-done' : 'glass-card'} rounded-2xl p-4 sm:p-5 transition-all duration-300 hover-lift`}
      >
        <div className="flex items-start gap-3.5">
          <button onClick={() => (isCompleted ? setConfirmUncomplete(true) : handleComplete())} className="mt-0.5 flex-shrink-0 transition-transform duration-300 hover:scale-110">
            {isCompleted ? (
              <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--c-teal)' }} />
            ) : (
              <Circle className="w-7 h-7 text-dim hover:opacity-70 transition-opacity" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] px-2.5 py-1 rounded-full border font-medium flex items-center gap-1" style={{ background: `var(${meta.colorVar}-bg)`, color: accentColor, borderColor: `var(${meta.colorVar}-bd)` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                {meta.label}
              </span>
              {isCompleted && progress?.completedAt && (
                <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--c-teal)' }}>
                  <CheckCircle2 className="w-3 h-3" />
                  {new Date(progress.completedAt).toLocaleDateString('ar-SA')}
                </span>
              )}
            </div>

            <h3 className={`font-bold mb-1.5 transition-colors duration-300 ${isCompleted ? 'text-dim line-through' : 'text-app'}`}>
              {task.title}
            </h3>
            <p className="text-sm text-sub mb-3 leading-relaxed">{task.description}</p>

            {/* When completed + URL: show link above submission */}
            {isCompleted && task.url && (
              <div className="mb-3">
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--bg-base)',
                    boxShadow: '0 2px 10px -3px var(--accent-glow)',
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  فتح المحتوى
                </a>
              </div>
            )}

            {isCompleted && task.requiresSubmission && (
              <div className="mt-2 space-y-2">
                {progress?.submissionNote && (
                  <div className="rounded-xl p-3 text-sm text-sub border leading-relaxed" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                    <span className="text-[11px] text-dim flex items-center gap-1 mb-1.5 font-medium">
                      <FileText className="w-3.5 h-3.5" /> ملاحظة الطالب
                    </span>
                    {progress.submissionNote}
                  </div>
                )}
                {progress?.submissionLink && (
                  <a href={progress.submissionLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-80" style={{ color: 'var(--c-sky)' }}>
                    <Link2 className="w-4 h-4" /> رابط الواجب
                  </a>
                )}
                {progress?.audioDataUrl && (
                  <div className="flex items-center gap-2 rounded-xl p-2.5 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                    <Mic className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-amber)' }} />
                    <audio controls src={progress.audioDataUrl} className="h-8 max-w-xs" />
                  </div>
                )}
                {/* Edit submission button */}
                <button onClick={() => setShowSubmission(true)} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-xl border transition-all" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
                  <Edit3 className="w-3 h-3" /> تعديل التسليم
                </button>
              </div>
            )}

            {showRating && progress?.supervisorRating && (
              <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 border" style={{ background: 'var(--c-amber-bg)', borderColor: 'var(--c-amber-bd)' }}>
                <span className="text-[11px] text-dim font-medium">تقييم المشرف:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => {
                    const rating = progress.supervisorRating ?? 0;
                    return <Star key={s} className="w-3.5 h-3.5" style={s <= rating ? { color: 'var(--c-amber)', fill: 'var(--c-amber)' } : { color: 'var(--border)' }} />;
                  })}
                </div>
                {progress.supervisorNote && <span className="text-[11px] text-sub mr-2">— {progress.supervisorNote}</span>}
              </div>
            )}

            {/* When not completed: URL + complete button on same row */}
            {!isCompleted && (
              <div className="flex items-center gap-3 flex-wrap mt-2">
                {task.url && (
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--bg-base)',
                      boxShadow: '0 2px 10px -3px var(--accent-glow)',
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    فتح المحتوى
                  </a>
                )}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleComplete}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 border"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {task.requiresSubmission ? 'تسليم الواجب' : 'تم الإنجاز'}
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Confirm uncomplete dialog */}
      <AnimatePresence>
        {confirmUncomplete && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setConfirmUncomplete(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="glass-card rounded-2xl p-6 w-full max-w-sm border pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--c-amber-bg)' }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />
                  </div>
                  <h3 className="text-base font-bold text-app">إلغاء الإنجاز؟</h3>
                </div>
                <p className="text-sm text-sub mb-5">هل تريد إلغاء إنجاز هذه المهمة وحذف تسليمك؟</p>
                <div className="flex gap-2">
                  <button onClick={() => { uncompleteTask(studentId, task.id); setConfirmUncomplete(false); }} className="flex-1 rounded-2xl py-2.5 text-sm font-bold transition-colors" style={{ background: 'var(--c-rose)', color: 'var(--bg-base)' }}>نعم، إلغاء</button>
                  <button onClick={() => setConfirmUncomplete(false)} className="flex-1 rounded-2xl py-2.5 text-sm font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>تراجع</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Submission / Edit submission modal */}
      <AnimatePresence>
        {showSubmission && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowSubmission(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="glass-card rounded-2xl p-6 w-full max-w-lg border pointer-events-auto" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-app">{isCompleted ? 'تعديل التسليم' : 'تسليم الواجب'}</h3>
                  <button onClick={() => setShowSubmission(false)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="rounded-xl p-3 mb-4 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                  <p className="text-sm text-sub">{task.title}</p>
                </div>

                {task.submissionType === 'text' && (
                  <div>
                    <label className="text-xs text-dim mb-2 block font-medium">اكتب ملخصك أو فائدتك:</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="w-full rounded-2xl p-3.5 text-app text-sm focus-accent resize-none leading-relaxed border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} placeholder="اكتب هنا..." />
                  </div>
                )}

                {task.submissionType === 'link' && (
                  <div>
                    <label className="text-xs text-dim mb-2 block font-medium">رابط الواجب:</label>
                    <input type="url" value={link} onChange={(e) => setLink(e.target.value)} className="w-full rounded-2xl p-3.5 text-app text-sm focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} placeholder="https://..." />
                  </div>
                )}

                {task.submissionType === 'audio' && (
                  <div className="space-y-3">
                    <label className="text-xs text-dim block font-medium">التسجيل الصوتي للحفظ:</label>
                    {/* Voice recorder */}
                    <div className="flex items-center gap-3">
                      {recording ? (
                        <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)', borderColor: 'var(--c-rose-bd)' }}>
                          <Square className="w-4 h-4" /> إيقاف — {formatTime(recordingTime)}
                        </button>
                      ) : (
                        <button onClick={startRecording} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', borderColor: 'var(--c-amber-bd)' }}>
                          <Mic className="w-4 h-4" /> تسجيل مباشر
                        </button>
                      )}
                      <span className="text-xs text-dim">أو</span>
                      <input ref={fileRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                      <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border-soft)' }}>
                        <Upload className="w-4 h-4" /> رفع ملف
                      </button>
                    </div>
                    {audioName && <p className="text-xs text-dim flex items-center gap-1.5"><Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--st-done)' }} />{audioName}</p>}
                    {audioData && <audio controls src={audioData} className="w-full h-10" />}
                    {audioError && <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--c-rose)' }}><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{audioError}</p>}
                    <p className="text-[11px] text-dim">الحد الأقصى للتسجيل: 5 دقائق · الحد الأقصى للرفع: 10 ميجابايت</p>
                    {recording && recordingTime >= MAX_REC_SECONDS - 30 && (
                      <p className="text-[11px] font-medium flex items-center gap-1" style={{ color: 'var(--c-rose)' }}>
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        سيتوقف التسجيل تلقائياً خلال {MAX_REC_SECONDS - recordingTime} ثانية
                      </p>
                    )}
                  </div>
                )}

                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} onClick={handleSubmit} className="w-full mt-5 font-bold py-3.5 rounded-2xl transition-all duration-300" style={{ background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' }}>
                  {isCompleted ? 'حفظ التعديل' : 'تسليم وإكمال المهمة'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
