import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon, Save, Calendar, Info, Database, Users, UserCog,
  ClipboardList, CheckCircle2, Download, Upload, ShieldCheck, AlertTriangle,
  X, Loader2, Package, FileSpreadsheet, Bell, BellOff, BellRing,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { exportBackupExcel } from '../lib/backupExcel';

// ── Backup helpers ─────────────────────────────────────────────────────────────

interface MislahBackup {
  _mislah: {
    version: string;
    exportedAt: string;
    programName: string;
    exportedBy: string;
    counts: { students: number; tasks: number; progress: number; attendance: number };
  };
  [key: string]: unknown;
}

async function downloadBackupExcel(exportedBy: string, data: import('../lib/types').AppData): Promise<{ ok: true; counts: MislahBackup['_mislah']['counts'] } | { ok: false; error: string }> {
  try {
    exportBackupExcel(data, exportedBy);
    return {
      ok: true,
      counts: {
        students: data.students.length,
        tasks: data.tasks.length,
        progress: data.progress.length,
        attendance: (data.attendance ?? []).length,
      },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function uploadBackup(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as MislahBackup;
    if (!data._mislah || !data.users || !data.config) {
      return { ok: false, error: 'الملف غير صالح — يرجى اختيار ملف نسخة احتياطية صادر من مُصلِح' };
    }
    const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
    const res = await fetch(apiBase + '/api/restore', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: j.error ?? 'فشل الاستعادة' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'الملف تالف أو غير قابل للقراءة' };
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

function PushNotificationCard() {
  const { requestPushPermission, requestPushUnsubscription } = useStore();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      );
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const ok = await requestPushPermission();
    if (ok) { setSubscribed(true); setPermission('granted'); }
    else setPermission(Notification.permission as NotificationPermission);
    setLoading(false);
  };

  const handleDisable = async () => {
    setLoading(true);
    await requestPushUnsubscription();
    setSubscribed(false);
    setLoading(false);
  };

  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <BellRing className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h3 className="text-lg font-bold text-app">إشعارات مصلح</h3>
      </div>
      {!supported ? (
        <p className="text-sm text-dim">المتصفح لا يدعم الإشعارات</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: subscribed ? 'var(--c-teal-bg)' : 'var(--bg-card)' }}>
              {subscribed
                ? <Bell className="w-5 h-5" style={{ color: 'var(--c-teal)' }} />
                : <BellOff className="w-5 h-5 text-dim" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app">
                {permission === 'denied' ? 'الإشعارات محجوبة'
                  : subscribed ? 'الإشعارات مفعّلة' : 'الإشعارات معطّلة'}
              </p>
              <p className="text-xs text-dim mt-0.5">
                {permission === 'denied'
                  ? 'افتح إعدادات المتصفح وأذِن بالإشعارات يدوياً'
                  : subscribed
                  ? 'ستصلك إشعارات مصلح حتى لو لم يكن التطبيق مفتوحاً'
                  : 'فعّل لتصلك إشعارات مصلح على هذا الجهاز'}
              </p>
            </div>
            {permission !== 'denied' && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={subscribed ? handleDisable : handleEnable}
                disabled={loading}
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl flex-shrink-0 disabled:opacity-60"
                style={subscribed
                  ? { background: 'var(--bg-card)', color: 'var(--c-rose)', boxShadow: 'inset 0 0 0 1px var(--border-soft)' }
                  : { background: 'var(--accent)', color: 'var(--bg-base)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : subscribed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                {loading ? 'جارٍ…' : subscribed ? 'تعطيل' : 'تفعيل'}
              </motion.button>
            )}
          </div>
          <p className="text-[11px] text-dim px-1">
            تشمل: الإشعارات اليدوية من المدير، التذكيرات المجدولة، وتنبيهات المهام التلقائية.
          </p>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { data, updateConfig, currentUser } = useStore();
  const [programName, setProgramName] = useState(data.config.programName);
  const [startDate, setStartDate] = useState(data.config.startDate.split('T')[0]);
  const [totalDays, setTotalDays] = useState(data.config.totalDays);
  const [timezone, setTimezone] = useState(data.config.timezone ?? 'Asia/Damascus');
  const [saved, setSaved] = useState(false);

  // Backup states
  const [exportState, setExportState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [exportCounts, setExportCounts] = useState<MislahBackup['_mislah']['counts'] | null>(null);
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [importMsg, setImportMsg] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  const handleSave = () => {
    updateConfig({ programName, startDate: new Date(startDate).toISOString(), totalDays, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    setExportState('loading');
    const result = await downloadBackupExcel(currentUser?.name ?? data.users.find((u) => u.role === 'admin')?.name ?? 'مدير البرنامج', data);
    if (result.ok) {
      setExportCounts(result.counts);
      setExportState('done');
    } else {
      setExportState('error');
    }
    setTimeout(() => setExportState('idle'), 4000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowRestoreConfirm(true);
    e.target.value = '';
  };

  const handleRestoreConfirm = async () => {
    if (!pendingFile) return;
    setShowRestoreConfirm(false);
    setImportState('loading');
    setImportMsg('');
    const result = await uploadBackup(pendingFile);
    setPendingFile(null);
    if (result.ok) {
      setImportState('done');
      setImportMsg('تمت الاستعادة — ستُعاد تحميل الصفحة الآن');
      setTimeout(() => window.location.reload(), 1800);
    } else {
      setImportState('error');
      setImportMsg(result.error);
      setTimeout(() => setImportState('idle'), 5000);
    }
  };

  const attendanceDays = [...new Set((data.attendance ?? []).map((a) => a.date))].length;

  const infoItems = [
    { icon: Users, label: 'الطلاب', value: data.students.length },
    { icon: UserCog, label: 'المشرفون', value: data.users.filter((u) => u.role === 'supervisor').length },
    { icon: ClipboardList, label: 'المهام', value: data.tasks.length },
    { icon: Database, label: 'سجلات الإنجاز', value: data.progress.length },
    { icon: Calendar, label: 'أيام الحضور المسجّلة', value: attendanceDays },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-extrabold text-app tracking-tight">الإعدادات</h2>
        <p className="text-sm text-dim mt-1">إعدادات البرنامج العامة</p>
      </div>

      {/* Push notifications */}
      <PushNotificationCard />

      {/* Program settings */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <SettingsIcon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h3 className="text-lg font-bold text-app">إعدادات البرنامج</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">اسم البرنامج</label>
            <input type="text" value={programName} onChange={(e) => setProgramName(e.target.value)} className="w-full rounded-2xl py-3 px-3.5 text-app text-sm focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">تاريخ البداية</label>
              <div className="relative">
                <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-2xl py-3 pr-10 pl-3.5 text-app text-sm focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} />
              </div>
            </div>
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">عدد الأيام</label>
              <input type="number" value={totalDays} onChange={(e) => setTotalDays(Number(e.target.value))} min={1} max={90} className="w-full rounded-2xl py-3 px-3.5 text-app text-sm focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">المنطقة الزمنية — لضبط توقيت الإشعارات المجدولة</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-2xl py-3 px-3.5 text-app text-sm focus-accent border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}
            >
              <option value="Asia/Damascus">سوريا (UTC+2/+3)</option>
              <option value="Asia/Riyadh">السعودية / الكويت / قطر / البحرين (UTC+3)</option>
              <option value="Asia/Dubai">الإمارات / عُمان (UTC+4)</option>
              <option value="Asia/Baghdad">العراق (UTC+3)</option>
              <option value="Africa/Cairo">مصر (UTC+2/+3)</option>
              <option value="Asia/Beirut">لبنان / فلسطين (UTC+2/+3)</option>
              <option value="Asia/Amman">الأردن (UTC+2/+3)</option>
              <option value="Africa/Tunis">تونس (UTC+1)</option>
              <option value="Africa/Algiers">الجزائر (UTC+1)</option>
              <option value="Africa/Casablanca">المغرب (UTC+0/+1)</option>
              <option value="UTC">UTC (توقيت غرينيتش)</option>
            </select>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} className="flex items-center gap-2 font-bold px-6 py-3 rounded-2xl transition-all duration-300" style={saved ? { background: 'var(--c-teal-bg)', color: 'var(--c-teal)', boxShadow: 'inset 0 0 0 1px var(--c-teal-bd)' } : { background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' }}>
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}{saved ? 'تم الحفظ' : 'حفظ الإعدادات'}
          </motion.button>
        </div>
      </div>

      {/* Backup / Restore — admin only */}
      {isAdmin && (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #000) 100%)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">النسخ الاحتياطي والاستعادة</h3>
              <p className="text-[11px] text-white/70 mt-0.5">احفظ بيانات البرنامج كاملةً أو استعدها من ملف سابق</p>
            </div>
            <div className="mr-auto">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white/80" style={{ background: 'rgba(255,255,255,0.15)' }}>للمدير فقط</span>
            </div>
          </div>

          <div className="p-5 space-y-4" style={{ background: 'var(--bg-card)' }}>
            {/* Export Excel */}
            <div className="rounded-2xl p-4 border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-soft)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--c-teal-bg)' }}>
                  <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--c-teal)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-app text-sm">تصدير نسخة احتياطية — Excel</p>
                  <p className="text-xs text-dim mt-0.5">
                    ملف Excel بـ 10 شيتات: الغلاف · الطلاب · الكادر · المهام · سجلات الإنجاز · الحضور التفصيلي · ملخص الحضور · قوائم الطلاب · الإشعارات · الإعدادات
                  </p>
                  {exportState === 'done' && exportCounts && (
                    <div className="mt-2 text-[11px] rounded-xl px-3 py-2 border font-medium" style={{ background: 'var(--c-teal-bg)', borderColor: 'var(--c-teal-bd)', color: 'var(--c-teal)' }}>
                      ✓ {exportCounts.students} طالب · {exportCounts.tasks} مهمة · {exportCounts.progress} إنجاز · {exportCounts.attendance} سجل حضور
                    </div>
                  )}
                  {exportState === 'error' && (
                    <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--c-red)' }}>فشل التصدير — حاول مجدداً</p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
                  disabled={exportState === 'loading'}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl flex-shrink-0"
                  style={{ background: 'var(--c-teal-bg)', color: 'var(--c-teal)', boxShadow: 'inset 0 0 0 1px var(--c-teal-bd)', opacity: exportState === 'loading' ? 0.6 : 1 }}
                >
                  {exportState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : exportState === 'done' ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  {exportState === 'loading' ? 'جارٍ...' : exportState === 'done' ? 'تم' : 'تصدير'}
                </motion.button>
              </div>
            </div>

            {/* Import */}
            <div className="rounded-2xl p-4 border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-soft)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--c-amber-bg, #fef3c7)' }}>
                  <Upload className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-app text-sm">استعادة من نسخة احتياطية</p>
                  <p className="text-xs text-dim mt-0.5">سيُستبدل <strong className="text-app">كل البيانات الحالية</strong> بالبيانات الموجودة في الملف. تأكد من تصدير نسخة جديدة أولاً إذا أردت</p>
                  {importState === 'done' && (
                    <p className="mt-2 text-[11px] font-bold" style={{ color: 'var(--c-teal)' }}>✓ {importMsg}</p>
                  )}
                  {importState === 'error' && (
                    <p className="mt-2 text-[11px] font-medium" style={{ color: 'var(--c-red)' }}>{importMsg}</p>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importState === 'loading' || importState === 'done'}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl flex-shrink-0"
                  style={{ background: 'var(--c-amber-bg, #fef3c7)', color: 'var(--c-amber)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--c-amber) 30%, transparent)', opacity: (importState === 'loading' || importState === 'done') ? 0.6 : 1 }}
                >
                  {importState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importState === 'loading' ? 'جارٍ...' : 'استعادة'}
                </motion.button>
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 px-1">
              <Package className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-dim" />
              <p className="text-[11px] text-dim leading-relaxed">
                الملف يحتوي على جميع البيانات بما فيها كلمات المرور المشفّرة. احتفظ به في مكان آمن ولا تُرسله عبر قنوات غير موثوقة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* System info */}
      <div className="glass-card rounded-2xl p-5 sm:p-6" style={{ borderColor: 'var(--c-sky-bd)', background: 'var(--c-sky-bg)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5" style={{ color: 'var(--c-sky)' }} />
          <h3 className="text-lg font-bold text-app">معلومات النظام</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {infoItems.map((item) => (
            <div key={item.label} className="rounded-2xl p-3.5 border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
              <item.icon className="w-5 h-5 mx-auto mb-2 text-dim" />
              <div className="text-xl font-extrabold text-app tabular-nums">{item.value}</div>
              <div className="text-[11px] text-dim mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-dim flex items-center gap-1.5 mt-4">
          <Database className="w-3.5 h-3.5" /> البيانات محفوظة على السحابة — متزامنة على جميع الأجهزة
        </p>
      </div>

      {/* Restore Confirmation Dialog */}
      <AnimatePresence>
        {showRestoreConfirm && pendingFile && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-red-bg, #fee2e2)' }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: 'var(--c-red)' }} />
                </div>
                <button onClick={() => { setShowRestoreConfirm(false); setPendingFile(null); }} className="text-dim hover:text-app transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h4 className="text-base font-extrabold text-app mb-2">تأكيد الاستعادة</h4>
              <p className="text-sm text-dim mb-1">الملف المختار:</p>
              <p className="text-sm font-bold text-app mb-4 truncate px-3 py-2 rounded-xl border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-soft)' }}>
                {pendingFile.name}
              </p>
              <p className="text-sm text-dim mb-6">
                هذا الإجراء <strong className="text-app">سيحذف كل البيانات الحالية</strong> ويستبدلها بالبيانات الموجودة في الملف. لا يمكن التراجع عن هذه العملية.
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleRestoreConfirm}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: 'var(--c-red, #ef4444)' }}
                >
                  نعم، استعادة البيانات
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setShowRestoreConfirm(false); setPendingFile(null); }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--bg-base)', color: 'var(--text-app)', border: '1px solid var(--border)' }}
                >
                  إلغاء
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
