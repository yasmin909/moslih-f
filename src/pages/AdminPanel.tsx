import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Users, UserCog, Shield, Layers, Database, Settings as SettingsIcon,
  Plus, Trash2, Edit3, X, Search, Save, CheckCircle2, AlertTriangle,
  Download, Upload, RotateCcw, UserPlus, Users2, Phone, KeyRound,
  Power, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ClipboardList, Calendar, Info,
  TrendingUp, BarChart3, Award, Flame, Zap, Inbox, Star, Activity,
  FileText, ArrowLeft, Building2, FileSpreadsheet, IdCard,
  Bell, Send, BellOff, Minus, Clock, ToggleLeft, ToggleRight,
  Trophy, Sparkles, MessageSquare, Tag, ArrowUpDown, FileDown, GripVertical,
} from 'lucide-react';
import type { AdminBanner, BannerColor, BannerIcon } from '../lib/types';
import * as XLSX from 'xlsx';
import { useStore } from '../lib/store';
import { generateUsername, generatePassword } from '../lib/seed';
import { OverviewTab } from '../components/OverviewTab';
import { exportCredentialsPDF, exportCustomReportPDF, type CredentialSlip } from '../lib/pdfExport';
import { exportAttendanceMatrixExcel } from '../lib/attendanceMatrixExcel';
import { exportAttendanceDayPDF } from '../lib/attendancePdf';
import type { User, Student, Role } from '../lib/types';
import { ATTENDANCE_META, type AttendanceStatus } from '../lib/types';

type Tab = 'overview' | 'students' | 'staff' | 'groups' | 'attendance' | 'notifications' | 'banners' | 'data';

export function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get('tab') as Tab | null;
    const valid: Tab[] = ['overview', 'students', 'staff', 'groups', 'attendance', 'notifications', 'data'];
    return (t && valid.includes(t)) ? t : 'overview';
  });

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: Activity },
    { id: 'students', label: 'إدارة الطلاب', icon: Users },
    { id: 'staff', label: 'إدارة المشرفين', icon: UserCog },
    { id: 'groups', label: 'المجموعات', icon: Layers },
    { id: 'attendance', label: 'الحضور', icon: Calendar },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'banners', label: 'البنرات', icon: MessageSquare },
    { id: 'data', label: 'إدارة البيانات', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-app tracking-tight">لوحة الإدارة الكاملة</h2>
          <p className="text-sm text-dim mt-1">صلاحيات كاملة لإدارة كل جوانب النظام</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium border transition-all duration-300 flex-shrink-0"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
        >
          <SettingsIcon className="w-4 h-4" />
          الإعدادات
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 border ${tab === t.id ? 'text-accent' : 'text-sub hover:text-app'}`}
            style={tab === t.id
              ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }
              : { background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'overview' && <OverviewTab />}
          {tab === 'students' && <StudentsTab />}
          {tab === 'staff' && <StaffTab />}
          {tab === 'groups' && <GroupsTab />}
          {tab === 'attendance' && <AttendanceTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'banners' && <BannersTab />}
          {tab === 'data' && <DataTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ============== Shared Modal ==============
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="glass-card rounded-3xl p-6 w-full max-w-lg pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-app">{title}</h3>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </>
  );
}

function inputCls() {
  return 'w-full rounded-2xl py-2.5 px-3.5 text-app text-sm focus-accent border';
}
function inputStyle() {
  return { background: 'var(--bg-input)', borderColor: 'var(--border)' };
}
function btnPrimary() {
  return 'flex items-center gap-2 font-bold px-5 py-2.5 rounded-2xl transition-all duration-300';
}
function btnPrimaryStyle() {
  return { background: 'var(--accent)', color: 'var(--bg-base)', boxShadow: '0 4px 16px -4px var(--accent-glow)' };
}

// ============== Students Tab ==============
function StudentsTab() {
  const { data, addStudent, addStudents, updateStudent, deleteStudent, clearStudentProgress } = useStore();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [showCreds, setShowCreds] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const groups = useMemo(() =>
    Array.from(new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]).filter(Boolean))).sort(),
    [data.students]);

  const filtered = useMemo(() => {
    return data.students
      .filter((s) => {
        const sg = s.groups?.length ? s.groups : [s.group];
        return (groupFilter === 'all' || sg.includes(groupFilter)) && (!search || s.name.includes(search));
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [data.students, search, groupFilter]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className={inputCls() + ' pr-10'} style={inputStyle()} />
        </div>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-2xl py-2.5 px-3 text-sm border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <option value="all">كل المجموعات</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={() => setShowCreds(true)} className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium border transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <IdCard className="w-4 h-4" /> قصاصات الدخول
        </button>
        <button onClick={() => setShowExcel(true)} className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium border transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <FileSpreadsheet className="w-4 h-4" /> استيراد Excel
        </button>
        <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium border transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
          <Users2 className="w-4 h-4" /> إضافة جماعية
        </button>
        <button onClick={() => setShowAdd(true)} className={btnPrimary() + ' text-sm'} style={btnPrimaryStyle()}>
          <UserPlus className="w-4 h-4" /> طالب جديد
        </button>
      </div>

      <p className="text-sm text-dim">{filtered.length} طالب</p>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const user = data.users.find((u) => u.studentId === s.id);
          return (
            <div key={s.id} className="glass-card rounded-2xl p-4 flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-app truncate">{s.name}</div>
                <div className="flex items-center gap-3 text-xs text-dim mt-0.5">
                  <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-soft)' }}>{(s.groups?.length ? s.groups : [s.group]).join(' · ')}</span>
                  {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                  <span>المستخدم: {user?.username || '—'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditing(s)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDelete(s.id)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="glass-card rounded-2xl p-10 text-center text-dim">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            لا يوجد طلاب. ابدأ بإضافة طالب جديد.
          </div>
        )}
      </div>

      {/* Add single */}
      <AnimatePresence>
        {showAdd && <AddStudentModal groups={groups} onClose={() => setShowAdd(false)} onSave={(s) => { addStudent(s); setShowAdd(false); }} />}
      </AnimatePresence>

      {/* Add bulk */}
      <AnimatePresence>
        {showBulk && <BulkAddModal groups={groups} onClose={() => setShowBulk(false)} onSave={(list) => { addStudents(list); setShowBulk(false); }} />}
      </AnimatePresence>

      {/* Excel import */}
      <AnimatePresence>
        {showExcel && <ExcelImportModal groups={groups} onClose={() => setShowExcel(false)} onSave={(list) => { addStudents(list); setShowExcel(false); }} />}
      </AnimatePresence>

      {/* Credentials export */}
      <AnimatePresence>
        {showCreds && <CredentialsModal onClose={() => setShowCreds(false)} />}
      </AnimatePresence>

      {/* Edit */}
      <AnimatePresence>
        {editing && <EditStudentModal student={editing} groups={groups} onClose={() => setEditing(null)} onSave={(updates) => { updateStudent(editing.id, updates); setEditing(null); }} />}
      </AnimatePresence>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDelete && (
          <Modal title="تأكيد الحذف" onClose={() => setConfirmDelete(null)}>
            <p className="text-sm text-sub mb-5">سيتم حذف الطالب وكل سجلات إنجازه نهائياً. هل أنت متأكد؟</p>
            <div className="flex gap-2">
              <button onClick={() => { deleteStudent(confirmDelete); setConfirmDelete(null); }} className="flex-1 rounded-2xl py-3 font-bold transition-colors" style={{ background: 'var(--c-rose)', color: 'var(--bg-base)' }}>
                نعم، احذف
              </button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-2xl py-3 font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                إلغاء
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddStudentModal({ groups, onClose, onSave }: { groups: string[]; onClose: () => void; onSave: (s: Omit<Student, 'id'> & { username?: string; password?: string }) => void }) {
  const { data } = useStore();
  const [name, setName] = useState('');
  const [group, setGroup] = useState(groups[0] || 'أ');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Generate once on mount — never changes while modal is open
  const [autoPassword] = useState(() => generatePassword());

  const existingUsernames = data.users.map((u) => u.username);
  const autoUsername = name.trim() ? generateUsername(name.trim(), existingUsernames) : '—';

  return (
    <Modal title="إضافة طالب جديد" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">الاسم الكامل *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} style={inputStyle()} placeholder="اسم الطالب" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">المجموعة *</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} className={inputCls()} style={inputStyle()} placeholder="أ" list="groups-list" />
            <datalist id="groups-list">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">رقم الجوال (اختياري)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls()} style={inputStyle()} placeholder="05xxxxxxxx" />
          </div>
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">معرف تيليجرام (اختياري)</label>
          <input value={telegram} onChange={(e) => setTelegram(e.target.value)} className={inputCls()} style={inputStyle()} placeholder="@username" />
        </div>
        {/* Auto-generated credentials preview */}
        <div className="rounded-2xl p-4 border" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>بيانات الدخول (تلقائية)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[11px] text-dim block">اسم المستخدم</span>
              <span className="font-bold text-app">{username || autoUsername}</span>
            </div>
            <div>
              <span className="text-[11px] text-dim block">كلمة المرور</span>
              <span className="font-bold text-app">{password || autoPassword}</span>
            </div>
          </div>
          <p className="text-[10px] text-dim mt-2">يمكن تعديلها يدوياً أدناه — تُترك فارغة للتلقائي</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">اسم مستخدم مخصص (اختياري)</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls()} style={inputStyle()} placeholder={autoUsername} />
          </div>
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">كلمة مرور مخصصة (اختياري)</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} style={inputStyle()} placeholder={autoPassword} />
          </div>
        </div>
        <button onClick={() => name.trim() && onSave({ name: name.trim(), group, groups: [group], phone, telegramHandle: telegram || undefined, username: username || undefined, password: password || autoPassword })} className={btnPrimary() + ' w-full justify-center'} style={btnPrimaryStyle()}>
          <Plus className="w-4 h-4" /> إضافة الطالب
        </button>
      </div>
    </Modal>
  );
}

function BulkAddModal({ groups, onClose, onSave }: { groups: string[]; onClose: () => void; onSave: (list: Omit<Student, 'id'>[]) => void }) {
  const { data } = useStore();
  const [text, setText] = useState('');
  const [group, setGroup] = useState(groups[0] || 'أ');

  const studentCount = data.users.filter((u) => u.role === 'student').length;

  const handleParse = () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const students = lines.map((line) => {
      const parts = line.split(/[,\t،]/).map((p) => p.trim());
      const g = parts[1] || group;
      return { name: parts[0], group: g, groups: [g], phone: parts[2] || '', telegramHandle: parts[3] || undefined };
    }).filter((s) => s.name);
    if (students.length) onSave(students);
  };

  return (
    <Modal title="إضافة جماعية للطلاب" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl p-3 border" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
          <p className="text-xs" style={{ color: 'var(--accent)' }}>
            سيتم توليد اسم المستخدم من الاسم وكلمة المرور تلقائياً (Q26XXX حيث XXX حروف وأرقام عشوائية)
          </p>
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">المجموعة الافتراضية</label>
          <input value={group} onChange={(e) => setGroup(e.target.value)} className={inputCls()} style={inputStyle()} list="groups-list2" />
          <datalist id="groups-list2">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">أسماء الطلاب (سطر لكل طالب)</label>
          <p className="text-[11px] text-dim mb-2">الصيغة: الاسم، المجموعة، الجوال، تلجرام (الكل اختياري عدا الاسم)</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={inputCls() + ' resize-none leading-relaxed'} style={inputStyle()} placeholder={'محمد أحمد، أ، 0501234567\nعبدالله سعد، أ\nسارة علي، ب، 0559876543, @sara'} />
        </div>
        <button onClick={handleParse} className={btnPrimary() + ' w-full justify-center'} style={btnPrimaryStyle()}>
          <Users2 className="w-4 h-4" /> إضافة الكل
        </button>
      </div>
    </Modal>
  );
}

function EditStudentModal({ student, groups, onClose, onSave }: { student: Student; groups: string[]; onClose: () => void; onSave: (u: Partial<Student>) => void }) {
  const { data, updateUser } = useStore();
  const [name, setName] = useState(student.name);
  const [studentGroups, setStudentGroups] = useState<string[]>(
    student.groups?.length ? student.groups : [student.group].filter(Boolean),
  );
  const [newGroup, setNewGroup] = useState('');
  const [phone, setPhone] = useState(student.phone);
  const user = data.users.find((u) => u.studentId === student.id);
  const [username, setUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);

  const addGroup = () => {
    const g = newGroup.trim();
    if (g && !studentGroups.includes(g)) setStudentGroups((prev) => [...prev, g]);
    setNewGroup('');
  };

  return (
    <Modal title="تعديل بيانات الطالب" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} style={inputStyle()} />
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">المجموعات</label>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
            {studentGroups.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                {g}
                {studentGroups.length > 1 && (
                  <button type="button" onClick={() => setStudentGroups((prev) => prev.filter((x) => x !== g))} className="hover:opacity-60 font-bold leading-none ml-1">×</button>
                )}
              </span>
            ))}
            {studentGroups.length === 0 && <span className="text-xs text-dim py-1">لا توجد مجموعات</span>}
          </div>
          <div className="flex gap-2">
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }} className={inputCls() + ' flex-1'} style={inputStyle()} placeholder="أضف مجموعة..." list="groups-list3" />
            <datalist id="groups-list3">{groups.filter((g) => !studentGroups.includes(g)).map((g) => <option key={g} value={g} />)}</datalist>
            <button type="button" onClick={addGroup} className="px-3 py-2 rounded-2xl text-sm font-bold flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>+</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">رقم الجوال</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls()} style={inputStyle()} />
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">اسم المستخدم</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls()} style={inputStyle()} />
        </div>
        {/* Password — show current plainPassword and allow change */}
        <div className="rounded-2xl p-3 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-sub flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> كلمة المرور</span>
            {!showPasswordField && (
              <button type="button" onClick={() => setShowPasswordField(true)} className="text-xs font-medium px-2.5 py-1 rounded-xl transition-colors" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', border: '1px solid var(--c-amber-bd)' }}>
                تغيير
              </button>
            )}
          </div>
          {showPasswordField ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls()}
                style={inputStyle()}
                placeholder={`الحالية: ${user?.plainPassword || '—'}`}
                autoFocus
              />
              <p className="text-[11px] text-dim">اتركها فارغة للإبقاء على كلمة المرور الحالية.</p>
            </div>
          ) : (
            <p className="text-sm font-mono font-bold text-app">{user?.plainPassword || '—'}</p>
          )}
        </div>
        <button
          onClick={() => {
            const primaryGroup = studentGroups[0] ?? student.group;
            onSave({ name, group: primaryGroup, groups: studentGroups.length ? studentGroups : [primaryGroup], phone });
            if (user) {
              const updates: Partial<User> = { username, name };
              if (newPassword.trim()) updates.password = newPassword.trim();
              updateUser(user.id, updates);
            }
          }}
          className={btnPrimary() + ' w-full justify-center'}
          style={btnPrimaryStyle()}
        >
          <Save className="w-4 h-4" /> حفظ التعديلات
        </button>
      </div>
    </Modal>
  );
}

// ============== Staff Tab ==============
function StaffTab() {
  const { data, addUser, updateUser, deleteUser } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const staff = data.users.filter((u) => u.role === 'admin' || u.role === 'supervisor');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-dim">{staff.length} عضو في فريق الإدارة</p>
        <button onClick={() => setShowAdd(true)} className={btnPrimary() + ' text-sm'} style={btnPrimaryStyle()}>
          <UserPlus className="w-4 h-4" /> إضافة مشرف / مدير
        </button>
      </div>

      <div className="space-y-2">
        {staff.map((u) => (
          <div key={u.id} className="glass-card rounded-2xl p-4 flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{
              background: u.role === 'admin' ? 'var(--c-rose-bg)' : 'var(--c-teal-bg)',
              color: u.role === 'admin' ? 'var(--c-rose)' : 'var(--c-teal)',
            }}>
              {u.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserCog className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-app truncate">{u.name}</div>
              <div className="flex items-center gap-3 text-xs text-dim mt-0.5">
                <span className="px-2 py-0.5 rounded-full" style={{ background: u.role === 'admin' ? 'var(--c-rose-bg)' : 'var(--c-teal-bg)', color: u.role === 'admin' ? 'var(--c-rose)' : 'var(--c-teal)' }}>
                  {u.role === 'admin' ? 'مدير' : 'مشرف'}
                </span>
                <span>المستخدم: {u.username}</span>
                {u.active === false && <span style={{ color: 'var(--c-rose)' }}>● معطّل</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => updateUser(u.id, { active: u.active === false ? true : false })}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'var(--bg-soft)', color: u.active === false ? 'var(--c-teal)' : 'var(--c-amber)' }}
                title={u.active === false ? 'تفعيل' : 'تعطيل'}
              >
                <Power className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(u)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => setConfirmDelete(u.id)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onSave={(u) => { addUser(u); setShowAdd(false); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {editing && <EditStaffModal user={editing} onClose={() => setEditing(null)} onSave={(updates) => { updateUser(editing.id, updates); setEditing(null); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {confirmDelete && (
          <Modal title="تأكيد الحذف" onClose={() => setConfirmDelete(null)}>
            <p className="text-sm text-sub mb-5">سيتم حذف هذا الحساب نهائياً. هل أنت متأكد؟</p>
            <div className="flex gap-2">
              <button onClick={() => { deleteUser(confirmDelete); setConfirmDelete(null); }} className="flex-1 rounded-2xl py-3 font-bold transition-colors" style={{ background: 'var(--c-rose)', color: 'var(--bg-base)' }}>نعم، احذف</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-2xl py-3 font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddStaffModal({ onClose, onSave }: { onClose: () => void; onSave: (u: Omit<User, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('supervisor');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Modal title="إضافة مشرف / مدير" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">الاسم *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} style={inputStyle()} />
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">الصلاحية</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setRole('supervisor')} className={`py-3 rounded-2xl border text-sm font-medium transition-all ${role === 'supervisor' ? '' : 'opacity-50'}`} style={role === 'supervisor' ? { background: 'var(--c-teal-bg)', color: 'var(--c-teal)', borderColor: 'var(--c-teal-bd)' } : { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <UserCog className="w-5 h-5 mx-auto mb-1" /> مشرف
            </button>
            <button onClick={() => setRole('admin')} className={`py-3 rounded-2xl border text-sm font-medium transition-all ${role === 'admin' ? '' : 'opacity-50'}`} style={role === 'admin' ? { background: 'var(--c-rose-bg)', color: 'var(--c-rose)', borderColor: 'var(--c-rose-bd)' } : { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <Shield className="w-5 h-5 mx-auto mb-1" /> مدير (صلاحيات كاملة)
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">اسم المستخدم *</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls()} style={inputStyle()} />
          </div>
          <div>
            <label className="text-xs text-dim mb-2 block font-medium">كلمة المرور *</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} style={inputStyle()} />
          </div>
        </div>
        <button onClick={() => name.trim() && username.trim() && password.trim() && onSave({ name: name.trim(), role, username: username.trim(), password: password.trim(), active: true })} className={btnPrimary() + ' w-full justify-center'} style={btnPrimaryStyle()}>
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>
    </Modal>
  );
}

function EditStaffModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (u: Partial<User>) => void }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);

  return (
    <Modal title="تعديل بيانات العضو" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">الاسم</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls()} style={inputStyle()} />
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">اسم المستخدم</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls()} style={inputStyle()} />
        </div>
        {/* Password reset — never show existing hash */}
        <div className="rounded-2xl p-3 border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-sub flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> كلمة المرور</span>
            {!showPasswordField && (
              <button type="button" onClick={() => setShowPasswordField(true)} className="text-xs font-medium px-2.5 py-1 rounded-xl transition-colors" style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', border: '1px solid var(--c-amber-bd)' }}>
                إعادة تعيين
              </button>
            )}
          </div>
          {showPasswordField ? (
            <div className="space-y-2">
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls()} style={inputStyle()} placeholder="كلمة المرور الجديدة..." autoFocus />
              <p className="text-[11px] text-dim">اتركها فارغة للإلغاء. ستُحفَظ مشفّرة تلقائياً.</p>
            </div>
          ) : (
            <p className="text-[11px] text-dim">●●●●●●●● (محفوظة بأمان — اضغط "إعادة تعيين" للتغيير)</p>
          )}
        </div>
        <button
          onClick={() => {
            const updates: Partial<User> = { name, username };
            if (newPassword.trim()) updates.password = newPassword.trim();
            onSave(updates);
          }}
          className={btnPrimary() + ' w-full justify-center'}
          style={btnPrimaryStyle()}
        >
          <Save className="w-4 h-4" /> حفظ
        </button>
      </div>
    </Modal>
  );
}

// ============== Excel Import Modal ==============
function ExcelImportModal({ groups, onClose, onSave }: { groups: string[]; onClose: () => void; onSave: (list: Omit<Student, 'id'>[]) => void }) {
  const { data } = useStore();
  const [parsedStudents, setParsedStudents] = useState<Omit<Student, 'id'>[] | null>(null);
  const [error, setError] = useState('');
  const [defaultGroup, setDefaultGroup] = useState(groups[0] || 'أ');
  const fileRef = useRef<HTMLInputElement>(null);

  const studentCount = data.users.filter((u) => u.role === 'student').length;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        // Find header row — look for columns containing "name"/"اسم", "group"/"مجموعة", "phone"/"جوال"
        const students: Omit<Student, 'id'>[] = [];
        let nameIdx = -1, groupIdx = -1, phoneIdx = -1, telegramIdx = -1;
        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          const row = rows[r] as unknown[];
          if (!row) continue;
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c] || '').toLowerCase().trim();
            if ((cell.includes('name') || cell.includes('اسم')) && nameIdx === -1) nameIdx = c;
            if ((cell.includes('group') || cell.includes('مجموع') || cell.includes('فريق')) && groupIdx === -1) groupIdx = c;
            if ((cell.includes('phone') || cell.includes('جوال') || cell.includes('رقم') || cell.includes('هاتف')) && phoneIdx === -1) phoneIdx = c;
            if ((cell.includes('telegram') || cell.includes('تيليجرام') || cell.includes('تلكرام')) && telegramIdx === -1) telegramIdx = c;
          }
          if (nameIdx !== -1) break;
        }
        // If no header found, assume first column is name
        if (nameIdx === -1) nameIdx = 0;
        // Parse data rows (skip header if found)
        const startRow = nameIdx !== -1 && rows[0] && String((rows[0] as unknown[])[nameIdx] || '').toLowerCase().includes('اسم') ? 1 : 0;
        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r] as unknown[];
          if (!row) continue;
          const name = String(row[nameIdx] || '').trim();
          if (!name) continue;
          const grp = groupIdx !== -1 && row[groupIdx] ? String(row[groupIdx]).trim() : defaultGroup;
          students.push({
            name,
            group: grp,
            groups: [grp],
            phone: phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]).trim() : '',
            telegramHandle: telegramIdx !== -1 && row[telegramIdx] ? String(row[telegramIdx]).trim() : undefined,
          });
        }
        if (students.length === 0) {
          setError('لم يتم العثور على بيانات صالحة في الملف. تأكد من وجود عمود "الاسم"');
          return;
        }
        setParsedStudents(students);
      } catch {
        setError('خطأ في قراءة الملف. تأكد من أنه ملف Excel صالح (xlsx, xls, csv)');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    if (parsedStudents && parsedStudents.length > 0) {
      onSave(parsedStudents);
    }
  };

  return (
    <Modal title="استيراد طلاب من Excel" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl p-3 border" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
          <p className="text-xs" style={{ color: 'var(--accent)' }}>
            يدعم ملفات Excel (xlsx, xls) و CSV. يجب أن يحتوي الملف على عمود "الاسم" على الأقل.
            الأعمدة الاختيارية: المجموعة، الجوال، تيليجرام.
          </p>
        </div>
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">المجموعة الافتراضية (للطلاب بدون مجموعة)</label>
          <input value={defaultGroup} onChange={(e) => setDefaultGroup(e.target.value)} className={inputCls()} style={inputStyle()} list="groups-excel" />
          <datalist id="groups-excel">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </div>
        {!parsedStudents ? (
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed rounded-2xl py-10 flex flex-col items-center gap-2.5 transition-all" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <FileSpreadsheet className="w-8 h-8" />
              <span className="text-sm font-medium">اضغط لاختيار ملف Excel</span>
              <span className="text-[11px] text-dim">xlsx, xls, csv</span>
            </button>
            {error && <div className="rounded-2xl px-4 py-3 text-sm border" style={{ background: 'var(--c-rose-bg)', borderColor: 'var(--c-rose-bd)', color: 'var(--c-rose)' }}>{error}</div>}
          </>
        ) : (
          <>
            <div className="rounded-2xl p-3 border" style={{ background: 'var(--c-teal-bg)', borderColor: 'var(--c-teal-bd)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--c-teal)' }}>
                ✓ تم قراءة {parsedStudents.length} طالب من الملف
              </p>
              <p className="text-[11px] text-dim mt-1">
                سيتم توليد اسم المستخدم وكلمة المرور تلقائياً لكل طالب (بصيغة Q26XXX)
              </p>
            </div>
            {/* Preview table */}
            <div className="max-h-60 overflow-y-auto rounded-2xl border" style={{ borderColor: 'var(--border-soft)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'var(--bg-soft)' }}>
                  <tr className="text-dim text-xs">
                    <th className="text-right p-2 font-medium">#</th>
                    <th className="text-right p-2 font-medium">الاسم</th>
                    <th className="text-center p-2 font-medium">المجموعة</th>
                    <th className="text-center p-2 font-medium">الجوال</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedStudents.map((s, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="p-2 text-dim tabular-nums">{i + 1}</td>
                      <td className="p-2 text-app font-medium">{s.name}</td>
                      <td className="p-2 text-center text-sub">{s.group}</td>
                      <td className="p-2 text-center text-dim">{s.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setParsedStudents(null)} className="flex-1 rounded-2xl py-3 font-medium transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                إعادة اختيار
              </button>
              <button onClick={handleConfirm} className={btnPrimary() + ' flex-1 justify-center'} style={btnPrimaryStyle()}>
                <CheckCircle2 className="w-4 h-4" /> تأكيد وإضافة {parsedStudents.length} طالب
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ============== Credentials Export Modal ==============
function CredentialsModal({ onClose }: { onClose: () => void }) {
  const { data } = useStore();
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const groups = useMemo(() =>
    Array.from(new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]).filter(Boolean))).sort(),
    [data.students]);

  const filteredStudents = useMemo(() => {
    return data.students
      .filter((s) => {
        const sg = s.groups?.length ? s.groups : [s.group];
        return groupFilter === 'all' || sg.includes(groupFilter);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [data.students, groupFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleExport = () => {
    const studentsToExport = filteredStudents.filter((s) => selectedIds.has(s.id));
    if (studentsToExport.length === 0) return;

    const slips: CredentialSlip[] = studentsToExport.map((s) => {
      const user = data.users.find((u) => u.studentId === s.id);
      return {
        name: s.name,
        group: s.group,
        username: user?.username || '—',
        password: user?.plainPassword || '—',
        phone: s.phone || '',
      };
    });

    exportCredentialsPDF(slips, data.config.programName);
  };

  const selectAll = selectedIds.size === filteredStudents.length && filteredStudents.length > 0;

  return (
    <Modal title="تصدير قصاصات الدخول" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl p-3 border" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
          <p className="text-xs" style={{ color: 'var(--accent)' }}>
            اختر الطلاب ثم اضغط "تصدير PDF" لإنشاء قصاصات احترافية جاهزة للطباعة والقص. كل قصاصة تحتوي على اسم الطالب، اسم المستخدم، وكلمة المرور.
          </p>
        </div>
        <div className="rounded-2xl p-3 border flex items-start gap-2" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
          <p className="text-xs" style={{ color: 'var(--accent)' }}>
            كلمات المرور محفوظة وتظهر دائماً. لتغيير كلمة مرور طالب استخدم "تعديل بيانات الطالب".
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setSelectedIds(new Set()); }} className="rounded-2xl py-2 px-3 text-sm border cursor-pointer" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">كل المجموعات</option>
            {groups.map((g) => <option key={g} value={g}>مجموعة {g}</option>)}
          </select>
          <button onClick={toggleAll} className="text-sm font-medium px-3 py-2 rounded-2xl transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
            {selectAll ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
          </button>
          <span className="text-sm text-dim">{selectedIds.size} محدد</span>
        </div>

        <div className="max-h-60 overflow-y-auto rounded-2xl border" style={{ borderColor: 'var(--border-soft)' }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: 'var(--bg-soft)' }}>
              <tr className="text-dim text-xs">
                <th className="p-2 w-8"></th>
                <th className="text-right p-2 font-medium">الاسم</th>
                <th className="text-center p-2 font-medium">المجموعة</th>
                <th className="text-right p-2 font-medium">المستخدم</th>
                <th className="text-right p-2 font-medium">كلمة المرور</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const user = data.users.find((u) => u.studentId === s.id);
                const selected = selectedIds.has(s.id);
                return (
                  <tr key={s.id} onClick={() => toggleSelect(s.id)} className="border-t cursor-pointer transition-colors" style={{ borderColor: 'var(--border-soft)', background: selected ? 'var(--accent-soft)' : 'transparent' }}>
                    <td className="p-2 text-center">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: selected ? 'var(--accent)' : 'var(--bg-input)', border: '1px solid var(--border)' }}>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--bg-base)' }} />}
                      </div>
                    </td>
                    <td className="p-2 text-app font-medium">{s.name}</td>
                    <td className="p-2 text-center text-sub">{s.group}</td>
                    <td className="p-2 text-sub font-mono text-xs">{user?.username || '—'}</td>
                    <td className="p-2 font-mono text-xs">
                      {user?.plainPassword
                        ? <span className="text-sub">{user.plainPassword}</span>
                        : <span className="text-dim">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStudents.length === 0 && <div className="p-6 text-center text-dim text-sm">لا يوجد طلاب</div>}
        </div>

        <button onClick={handleExport} disabled={selectedIds.size === 0} className={btnPrimary() + ' w-full justify-center'} style={selectedIds.size === 0 ? { ...btnPrimaryStyle(), opacity: 0.5, cursor: 'not-allowed' } : btnPrimaryStyle()}>
          <Download className="w-4 h-4" /> تصدير {selectedIds.size} قصاصة PDF
        </button>
      </div>
    </Modal>
  );
}

// ============== Groups Tab ==============
function GroupsTab() {
  const { data, addGroup, deleteGroup, renameGroup } = useStore();
  const [renaming, setRenaming] = useState<{ oldName: string; newName: string } | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Master list from groupList + any groups still on students not in list
  const groups = useMemo(() => {
    const masterList = data.groupList ?? [];
    const fromStudents = Array.from(new Set(
      data.students.flatMap((s) => s.groups?.length ? s.groups : s.group ? [s.group] : [])
    ));
    const all = Array.from(new Set([...masterList, ...fromStudents])).sort();
    const countMap = new Map<string, number>();
    data.students.forEach((s) => {
      const sGroups = s.groups?.length ? s.groups : [s.group].filter(Boolean);
      sGroups.forEach((g) => countMap.set(g, (countMap.get(g) || 0) + 1));
    });
    return all.map((name) => ({ name, count: countMap.get(name) ?? 0 }));
  }, [data.students, data.groupList]);

  const handleAdd = () => {
    if (!newGroupName.trim()) return;
    addGroup(newGroupName.trim());
    setNewGroupName('');
  };

  return (
    <div className="space-y-5">
      {/* Add group */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-xs font-bold text-sub mb-3">إضافة مجموعة جديدة</p>
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className={inputCls() + ' flex-1'}
            style={inputStyle()}
            placeholder="اسم المجموعة..."
          />
          <button
            onClick={handleAdd}
            disabled={!newGroupName.trim()}
            className={btnPrimary() + ' px-4'}
            style={newGroupName.trim() ? btnPrimaryStyle() : { ...btnPrimaryStyle(), opacity: 0.4, cursor: 'not-allowed' }}
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>
      </div>

      {/* Groups grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map(({ name, count }) => (
          <div key={name} className="glass-card rounded-2xl p-5 group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setRenaming({ oldName: name, newName: name })} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(name)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="text-lg font-bold text-app">{name}</div>
            <div className="text-sm text-dim">{count > 0 ? `${count} طالب` : 'لا يوجد طلاب'}</div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="glass-card rounded-2xl p-10 text-center text-dim col-span-full">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
            لا توجد مجموعات. أضف مجموعة من الحقل أعلاه.
          </div>
        )}
      </div>

      {/* Rename modal */}
      <AnimatePresence>
        {renaming && (
          <Modal title="إعادة تسمية المجموعة" onClose={() => setRenaming(null)}>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-dim mb-2 block font-medium">الاسم الجديد</label>
                <input value={renaming.newName} onChange={(e) => setRenaming({ ...renaming, newName: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { renameGroup(renaming.oldName, renaming.newName); setRenaming(null); } }} className={inputCls()} style={inputStyle()} autoFocus />
              </div>
              <button onClick={() => { renameGroup(renaming.oldName, renaming.newName); setRenaming(null); }} className={btnPrimary() + ' w-full justify-center'} style={btnPrimaryStyle()}>
                <Save className="w-4 h-4" /> حفظ
              </button>
            </div>
          </Modal>
        )}

        {/* Delete confirm modal */}
        {confirmDelete && (
          <Modal title="حذف المجموعة" onClose={() => setConfirmDelete(null)}>
            <div className="space-y-4">
              <p className="text-sm text-sub">
                هل تريد حذف مجموعة <strong className="text-app">"{confirmDelete}"</strong>؟
                {groups.find((g) => g.name === confirmDelete)?.count
                  ? ` سيتم نقل الـ ${groups.find((g) => g.name === confirmDelete)?.count} طالب إلى "غير محدد".`
                  : ''}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { deleteGroup(confirmDelete); setConfirmDelete(null); }} className="flex-1 rounded-2xl py-2.5 text-sm font-bold transition-colors" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)', border: '1px solid var(--c-rose-bd)' }}>
                  <Trash2 className="w-4 h-4 inline ml-1" /> حذف
                </button>
                <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-2xl py-2.5 text-sm transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============== Danger Action (typed confirmation) ==============
function DangerAction({ color, icon, title, description, buttonLabel, onConfirm }: {
  color: 'amber' | 'rose';
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const cv = color === 'amber' ? 'var(--c-amber)' : 'var(--c-rose)';
  const bg = color === 'amber' ? 'var(--c-amber-bg)' : 'var(--c-rose-bg)';
  const bd = color === 'amber' ? 'var(--c-amber-bd)' : 'var(--c-rose-bd)';
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6" style={{ borderColor: bd }}>
      <div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-lg font-bold text-app">{title}</h3></div>
      <p className="text-sm text-sub mb-4 leading-relaxed">{description}</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium border transition-all" style={{ background: bg, color: cv, borderColor: bd }}>
          {buttonLabel}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: cv }}>اكتب <strong>حذف</strong> للتأكيد:</p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="حذف"
            className={inputCls()}
            style={inputStyle()}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              disabled={typed !== 'حذف'}
              onClick={() => { onConfirm(); setOpen(false); setTyped(''); }}
              className="rounded-2xl px-4 py-2 text-sm font-bold transition-all"
              style={{ background: cv, color: 'var(--bg-base)', opacity: typed !== 'حذف' ? 0.4 : 1 }}
            >
              تأكيد
            </button>
            <button onClick={() => { setOpen(false); setTyped(''); }} className="rounded-2xl px-4 py-2 text-sm transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Data Tab ==============
// ============== Banners Tab ==============
const BANNER_ICON_OPTIONS: { value: BannerIcon; label: string }[] = [
  { value: 'trophy',   label: '🏆 كأس' },
  { value: 'star',     label: '⭐ نجمة' },
  { value: 'award',    label: '🎖️ جائزة' },
  { value: 'check',    label: '✅ إنجاز' },
  { value: 'sparkles', label: '✨ تميّز' },
];

const BANNER_COLOR_OPTIONS: { value: BannerColor; label: string; css: string }[] = [
  { value: 'amber',  label: 'ذهبي',   css: '--c-amber' },
  { value: 'teal',   label: 'بني دافئ', css: '--c-teal' },
  { value: 'clay',   label: 'طيني',   css: '--c-clay' },
  { value: 'rose',   label: 'وردي',   css: '--c-rose' },
  { value: 'mauve',  label: 'موف',    css: '--c-mauve' },
  { value: 'copper', label: 'نحاسي',  css: '--c-copper' },
];

function BannersTab() {
  const { data, currentUser, addBanner, updateBanner, deleteBanner } = useStore();
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [showForm, setShowForm] = useState(false);

  const empty: { title: string; body: string; icon: BannerIcon; color: BannerColor; targetRole: 'all' | 'student'; targetStudentIds: string[]; targetGroups: string[]; active: boolean } = { title: '', body: '', icon: 'trophy', color: 'amber', targetRole: 'all', targetStudentIds: [], targetGroups: [], active: true };
  const [form, setForm] = useState(empty);

  const banners = data.banners ?? [];
  const allGroups = Array.from(new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]).filter(Boolean))).sort();

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(b: AdminBanner) { setForm({ title: b.title, body: b.body ?? '', icon: b.icon, color: b.color, targetRole: b.targetRole, targetStudentIds: b.targetStudentIds ?? [], targetGroups: b.targetGroups ?? [], active: b.active }); setEditing(b); setShowForm(true); }

  function handleSave() {
    if (!form.title.trim()) return;
    const payload = { ...form, body: form.body.trim() || undefined, targetStudentIds: form.targetStudentIds.length ? form.targetStudentIds : undefined, targetGroups: form.targetGroups.length ? form.targetGroups : undefined };
    if (editing) updateBanner(editing.id, payload);
    else addBanner(payload);
    setShowForm(false);
  }

  const toggleGroup = (g: string) => setForm((p) => ({ ...p, targetGroups: p.targetGroups.includes(g) ? p.targetGroups.filter((x) => x !== g) : [...p.targetGroups, g] }));
  const toggleStudent = (id: string) => setForm((p) => ({ ...p, targetStudentIds: p.targetStudentIds.includes(id) ? p.targetStudentIds.filter((x) => x !== id) : [...p.targetStudentIds, id] }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-app">بنرات التحفيز</h3>
          <p className="text-sm text-dim mt-0.5">تظهر للطلاب في لوحة المهام — يمكن تخصيصها لأفراد أو مجموعات</p>
        </div>
        <button onClick={openAdd} className={btnPrimary()} style={btnPrimaryStyle()}>
          <Plus className="w-4 h-4" /> بنر جديد
        </button>
      </div>

      {banners.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center text-dim">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد بنرات بعد</p>
          <p className="text-xs mt-1">أضف بنراً لتحفيز الطلاب أو الإعلان عن حدث</p>
        </div>
      )}

      <div className="space-y-3">
        {banners.map((b) => {
          const colorVar = BANNER_COLOR_OPTIONS.find((c) => c.value === b.color)?.css ?? '--c-amber';
          return (
            <div key={b.id} className="glass-card rounded-2xl p-4 border flex items-start gap-4" style={{ borderRight: `4px solid var(${colorVar})`, borderColor: `var(${colorVar}-bd)`, borderRightColor: `var(${colorVar})` }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `var(${colorVar}-bg)` }}>
                {b.icon === 'trophy'   && <Trophy    className="w-5 h-5" style={{ color: `var(${colorVar})` }} />}
                {b.icon === 'star'     && <Star      className="w-5 h-5" style={{ color: `var(${colorVar})` }} />}
                {b.icon === 'award'    && <Award     className="w-5 h-5" style={{ color: `var(${colorVar})` }} />}
                {b.icon === 'check'    && <CheckCircle2 className="w-5 h-5" style={{ color: `var(${colorVar})` }} />}
                {b.icon === 'sparkles' && <Sparkles  className="w-5 h-5" style={{ color: `var(${colorVar})` }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="font-bold text-app text-sm">{b.title}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium" style={{ background: b.active ? `var(${colorVar}-bg)` : 'var(--bg-soft)', color: b.active ? `var(${colorVar})` : 'var(--text-muted)', borderColor: b.active ? `var(${colorVar}-bd)` : 'var(--border-soft)' }}>
                    {b.active ? 'نشط' : 'معطّل'}
                  </span>
                  {b.targetRole === 'student' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)', borderColor: 'var(--border-soft)' }}>
                      {b.targetStudentIds?.length ? `${b.targetStudentIds.length} طالب` : b.targetGroups?.length ? b.targetGroups.join('، ') : 'جميع الطلاب'}
                    </span>
                  )}
                </div>
                {b.body && <p className="text-xs text-dim mt-1 leading-relaxed">{b.body}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => updateBanner(b.id, { active: !b.active })} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: b.active ? `var(${colorVar})` : 'var(--text-muted)' }} title={b.active ? 'إيقاف' : 'تفعيل'}>
                  {b.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(b)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => deleteBanner(b.id)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--c-rose)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
          <Modal title={editing ? 'تعديل البنر' : 'بنر جديد'} onClose={() => setShowForm(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-sub mb-1">العنوان *</label>
                <input className={inputCls()} style={inputStyle()} placeholder="مثال: أحسنت! أتممت أسبوعك الأول" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={100} />
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">النص التفصيلي (اختياري)</label>
                <textarea className={`${inputCls()} resize-none`} style={inputStyle()} rows={3} placeholder="كلمة تشجيعية أو آية أو نص إضافي" value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} maxLength={300} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-sub mb-1.5">الأيقونة</label>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_ICON_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setForm((p) => ({ ...p, icon: opt.value }))} className="px-2.5 py-1.5 rounded-xl text-sm border transition-all" style={form.icon === opt.value ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' } : { background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-sub mb-1.5">اللون</label>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_COLOR_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setForm((p) => ({ ...p, color: opt.value }))} className="px-2.5 py-1.5 rounded-xl text-sm border transition-all" style={form.color === opt.value ? { background: `var(${opt.css}-bg)`, borderColor: `var(${opt.css}-bd)`, color: `var(${opt.css})`, fontWeight: 700 } : { background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1.5">الجمهور</label>
                <div className="flex gap-2">
                  {(['all', 'student'] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setForm((p) => ({ ...p, targetRole: r, targetStudentIds: [], targetGroups: [] }))} className="flex-1 py-2 rounded-xl text-sm border font-medium transition-all" style={form.targetRole === r ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' } : { background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
                      {r === 'all' ? 'الجميع' : 'طلاب محددون'}
                    </button>
                  ))}
                </div>
              </div>
              {form.targetRole === 'student' && allGroups.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-sub mb-1.5">تصفية بالمجموعة (اختياري)</label>
                  <div className="border rounded-xl p-2 max-h-28 overflow-y-auto space-y-1" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}>
                    {allGroups.map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.targetGroups.includes(g)} onChange={() => toggleGroup(g)} className="rounded" />
                        <span className="text-xs text-app">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {form.targetRole === 'student' && form.targetGroups.length === 0 && data.students.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-sub mb-1.5">أو اختر طلاباً بالاسم (اختياري)</label>
                  <div className="border rounded-xl p-2 max-h-36 overflow-y-auto space-y-1" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}>
                    {data.students.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.targetStudentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} className="rounded" />
                        <span className="text-xs text-app">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-app">نشط (يظهر للطلاب)</span>
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={!form.title.trim()} className={`${btnPrimary()} flex-1 justify-center disabled:opacity-50`} style={btnPrimaryStyle()}>
                  <Save className="w-4 h-4" /> {editing ? 'حفظ التعديل' : 'إضافة البنر'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-2xl text-sm font-medium border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>إلغاء</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function DataTab() {
  const { data, resetData, clearAllProgress, importData } = useStore();
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mislah-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string);
        if (imported.users && imported.students && imported.tasks && imported.config) {
          importData(imported);
          setImportMsg({ text: '✓ تم استيراد البيانات بنجاح', ok: true });
        } else {
          setImportMsg({ text: 'ملف غير صالح — تأكد من أنه نسخة احتياطية صحيحة من مُصلِح', ok: false });
        }
      } catch {
        setImportMsg({ text: 'خطأ في قراءة الملف — تأكد أنه ملف JSON صحيح', ok: false });
      }
      setTimeout(() => setImportMsg(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Export / Import */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h3 className="text-lg font-bold text-app">نسخ احتياطي واستعادة</h3>
        </div>
        <p className="text-sm text-sub mb-4 leading-relaxed">صدّر كل بيانات النظام (الطلاب، المهام، الإنجاز، الإعدادات) إلى ملف JSON، أو استورد من نسخة احتياطية سابقة.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium border transition-all" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <Download className="w-4 h-4" /> تصدير JSON
          </button>
          <label className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium border transition-all cursor-pointer" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <Upload className="w-4 h-4" /> استيراد JSON
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>
        </div>
        {importMsg && (
          <div className="mt-3 rounded-2xl px-4 py-3 text-sm border" style={importMsg.ok
            ? { background: 'var(--c-teal-bg)', borderColor: 'var(--c-teal-bd)', color: 'var(--c-teal)' }
            : { background: 'var(--c-rose-bg)', borderColor: 'var(--c-rose-bd)', color: 'var(--c-rose)' }}>
            {importMsg.text}
          </div>
        )}
      </div>

      {/* Clear progress */}
      <DangerAction
        color="amber"
        icon={<RotateCcw className="w-5 h-5" style={{ color: 'var(--c-amber)' }} />}
        title="مسح سجلات الإنجاز"
        description="مسح جميع سجلات إنجاز الطلاب مع الاحتفاظ بالطلاب والمهام. مفيد لبداية فترة جديدة."
        buttonLabel="مسح الإنجاز"
        onConfirm={() => clearAllProgress()}
      />

      {/* Full reset */}
      <DangerAction
        color="rose"
        icon={<Trash2 className="w-5 h-5" style={{ color: 'var(--c-rose)' }} />}
        title="إعادة تعيين النظام بالكامل"
        description="حذف كل شيء — الطلاب، المشرفين، المهام، الإنجاز، والإعدادات — والعودة للحالة الأولية. لا يمكن التراجع."
        buttonLabel="إعادة تعيين كل شيء"
        onConfirm={() => { resetData(); window.location.reload(); }}
      />
    </div>
  );
}

// ============== Attendance Tab ==============
// ─── Attendance Tab ──────────────────────────────────────────────────────────

function SessionManagerModal({ onClose }: { onClose: () => void }) {
  const { data, addAttendanceSession, updateAttendanceSession, deleteAttendanceSession } = useStore();
  const sessions = data.attendanceSessions ?? [];
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const handleAdd = () => {
    if (!newName.trim()) return;
    addAttendanceSession({ name: newName.trim() });
    setNewName('');
  };

  return (
    <Modal title="إدارة الجلسات" onClose={onClose}>
      <div className="space-y-4">
        {/* Add */}
        <div>
          <label className="text-xs text-dim mb-2 block font-medium">إضافة جلسة جديدة</label>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder='مثال: يوم المسابقة السبت' className={inputCls() + ' flex-1'} style={inputStyle()} autoFocus />
            <button onClick={handleAdd} disabled={!newName.trim()} className={btnPrimary() + ' px-4'} style={newName.trim() ? btnPrimaryStyle() : { ...btnPrimaryStyle(), opacity: 0.4 }}><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* List */}
        {sessions.length === 0 ? (
          <p className="text-sm text-dim text-center py-4">لا توجد جلسات بعد — أضف واحدة أعلاه</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                {editId === s.id ? (
                  <>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { updateAttendanceSession(s.id, { name: editName }); setEditId(null); } if (e.key === 'Escape') setEditId(null); }} className={inputCls() + ' flex-1 text-sm'} style={inputStyle()} autoFocus />
                    <button onClick={() => { updateAttendanceSession(s.id, { name: editName }); setEditId(null); }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)', color: 'white' }}><Save className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <Tag className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    <span className="flex-1 text-sm font-medium text-app">{s.name}</span>
                    {s.dayOfWeek !== undefined && <span className="text-xs text-dim">{DAYS_AR[s.dayOfWeek]}</span>}
                    <button onClick={() => { setEditId(s.id); setEditName(s.name); }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteAttendanceSession(s.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Sortable item for attendance reorder drag-and-drop ───────────────────────
function SortableStudentRow({ student, index }: { student: import('../lib/types').Student; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: student.id });
  const group = (student.groups ?? [student.group]).filter(Boolean).join('، ') || student.group || '—';
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : undefined,
        position: 'relative',
        background: 'var(--bg-soft)',
        borderColor: isDragging ? 'var(--accent)' : 'var(--border-soft)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 12,
      }}
    >
      <div {...attributes} {...listeners}
        style={{ color: 'var(--text-muted)', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', padding: '4px 2px' }}>
        <GripVertical className="w-4 h-4" />
      </div>
      <span className="w-6 text-center text-xs font-bold tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{index + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-app leading-snug">{student.name}</div>
        <div className="text-[11px] text-dim">{group}</div>
      </div>
    </div>
  );
}

function AttendanceStudentRow({
  student, record, sessionType, selectedDate, index, total, sessionSelected,
}: {
  student: import('../lib/types').Student;
  record: import('../lib/types').AttendanceRecord | undefined;
  sessionType: string;
  selectedDate: string;
  index: number;
  total: number;
  sessionSelected: boolean;
}) {
  const { markAttendance, updateAttendanceField } = useStore();
  const [lateInput, setLateInput]     = useState(record?.lateMinutes?.toString() ?? '');
  const [excuseInput, setExcuseInput] = useState(record?.excuse ?? '');

  // Sync when record changes externally
  const prevStatus = useRef(record?.status);
  useEffect(() => {
    if (prevStatus.current !== record?.status) {
      setLateInput(record?.lateMinutes?.toString() ?? '');
      setExcuseInput(record?.excuse ?? '');
      prevStatus.current = record?.status;
    }
  }, [record?.status, record?.lateMinutes, record?.excuse]);

  const handleMark = (status: AttendanceStatus) => {
    markAttendance(student.id, selectedDate, status, {
      sessionType: sessionType || undefined,
      lateMinutes: status === 'late' ? (parseInt(lateInput) || undefined) : undefined,
      excuse: (status === 'excused' || status === 'absent') ? (excuseInput || undefined) : undefined,
    });
  };

  const group = (student.groups ?? [student.group]).filter(Boolean).join('، ') || student.group || '—';
  const showLate   = record?.status === 'late';
  const showExcuse = record?.status === 'excused' || record?.status === 'absent';

  const STATUS_SHORT: Record<AttendanceStatus, string> = {
    present: 'حاضر', late: 'متأخر', excused: 'معذور', absent: 'غائب',
  };

  return (
    <div className="rounded-xl border transition-colors" style={{ background: 'var(--bg-soft)', borderColor: record ? ATTENDANCE_META[record.status].color + '33' : 'var(--border-soft)' }}>
      {/* Row 1: index + full name + status badge */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="w-6 text-center text-xs tabular-nums font-bold flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-app leading-snug">{student.name}</div>
          <div className="text-[11px] text-dim">{group}</div>
        </div>
        {record && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: ATTENDANCE_META[record.status].bg, color: ATTENDANCE_META[record.status].color }}>
            {STATUS_SHORT[record.status]}
          </span>
        )}
      </div>

      {/* Row 2: status buttons */}
      <div className="flex items-center gap-1 px-3 pb-2.5 pr-11">
        {!sessionSelected ? (
          <p className="text-[11px] text-dim italic py-1">اختر جلسة أولاً لتسجيل الحضور</p>
        ) : (['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((status) => {
          const meta   = ATTENDANCE_META[status];
          const active = record?.status === status;
          return (
            <button
              key={status}
              onClick={() => handleMark(status)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
              style={active
                ? { background: meta.bg, color: meta.color, borderColor: meta.color + '66' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'var(--border-soft)' }}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Inline: late minutes */}
      {showLate && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c-amber)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--c-amber)' }}>مقدار التأخر:</span>
          <input
            type="number"
            min="1"
            max="120"
            value={lateInput}
            onChange={(e) => setLateInput(e.target.value)}
            onBlur={() => {
              const mins = parseInt(lateInput);
              updateAttendanceField(student.id, selectedDate, { lateMinutes: mins > 0 ? mins : undefined });
            }}
            placeholder="دقائق"
            className="w-20 rounded-lg px-2.5 py-1 text-xs border outline-none"
            style={{ background: 'var(--c-amber-bg)', borderColor: 'var(--c-amber-bd)', color: 'var(--text-primary)' }}
          />
          <span className="text-xs text-dim">دقيقة</span>
        </div>
      )}

      {/* Inline: excuse */}
      {showExcuse && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c-rose)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--c-rose)' }}>السبب:</span>
          <input
            value={excuseInput}
            onChange={(e) => setExcuseInput(e.target.value)}
            onBlur={() => updateAttendanceField(student.id, selectedDate, { excuse: excuseInput.trim() || undefined })}
            placeholder="اكتب سبب الغياب أو التأخر..."
            className="flex-1 rounded-lg px-2.5 py-1 text-xs border outline-none"
            style={{ background: 'var(--c-rose-bg)', borderColor: 'var(--c-rose-bd)', color: 'var(--text-primary)' }}
          />
        </div>
      )}
    </div>
  );
}

function AttendanceTab() {
  const {
    data, currentUser,
    getAttendanceForDay, bulkMarkAttendance,
    setAttendanceOrder,
  } = useStore();

  const [selectedDate,   setSelectedDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [activeSession,  setActiveSession]   = useState('');
  const [search,         setSearch]          = useState('');
  const [statusFilter,   setStatusFilter]    = useState<AttendanceStatus | 'unmarked' | 'all'>('all');
  const [reorderMode,    setReorderMode]     = useState(false);
  const [localOrder,     setLocalOrder]      = useState<string[]>([]);
  const [showSessMgr,    setShowSessMgr]     = useState(false);
  const [exporting,      setExporting]       = useState(false);
  const [showExportModal,  setShowExportModal]  = useState(false);
  const [exportMode,       setExportMode]       = useState<'today' | 'all' | 'range'>('today');
  const [exportDateFrom,   setExportDateFrom]   = useState('');
  const [exportDateTo,     setExportDateTo]     = useState('');
  const [showImportModal,  setShowImportModal]  = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const orderedStudents = useMemo(() => {
    const order = data.attendanceOrder ?? [];
    if (!order.length) return [...data.students];
    const orderMap = new Map(order.map((id, i) => [id, i]));
    return [...data.students].sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
  }, [data.students, data.attendanceOrder]);

  useEffect(() => {
    if (reorderMode) setLocalOrder(orderedStudents.map((s) => s.id));
  }, [reorderMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayRecords = getAttendanceForDay(selectedDate);
  const recordMap  = useMemo(() => new Map(dayRecords.map((r) => [r.studentId, r])), [dayRecords]);

  const stats = useMemo(() => ({
    present:  dayRecords.filter((r) => r.status === 'present').length,
    late:     dayRecords.filter((r) => r.status === 'late').length,
    absent:   dayRecords.filter((r) => r.status === 'absent').length,
    excused:  dayRecords.filter((r) => r.status === 'excused').length,
    unmarked: data.students.length - dayRecords.length,
  }), [dayRecords, data.students.length]);

  const filteredStudents = useMemo(() => {
    if (reorderMode) return [];
    return orderedStudents.filter((s) => {
      if (search && !s.name.includes(search)) return false;
      if (statusFilter === 'all') return true;
      const rec = recordMap.get(s.id);
      if (statusFilter === 'unmarked') return !rec;
      return rec?.status === statusFilter;
    });
  }, [orderedStudents, search, statusFilter, recordMap, reorderMode]);

  const dayLabel = useMemo(() => {
    try {
      const d = new Date(selectedDate + 'T12:00:00');
      if (selectedDate === todayStr) return 'اليوم';
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      if (selectedDate === yesterday.toISOString().split('T')[0]) return 'أمس';
      return d.toLocaleDateString('ar-SA', { weekday: 'long' });
    } catch { return selectedDate; }
  }, [selectedDate, todayStr]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 120, tolerance: 8 } }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalOrder((items) => {
        const oldIdx = items.indexOf(active.id as string);
        const newIdx = items.indexOf(over.id as string);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  };

  const prevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };
  const nextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    if (next <= todayStr) setSelectedDate(next);
  };

  const openExcelModal = () => {
    setExportDateFrom(selectedDate);
    setExportDateTo(selectedDate);
    setExportMode('today');
    setShowExportModal(true);
  };

  const handleExcelExport = async (mode: 'today' | 'all' | 'range', from: string, to: string) => {
    setExporting(true);
    setShowExportModal(false);
    try {
      await exportAttendanceMatrixExcel(
        data,
        orderedStudents.map((s) => s.id),
        currentUser?.name ?? 'المدير',
        mode,
        from,
        to,
      );
    } finally { setExporting(false); }
  };

  const handlePdfExport = async () => {
    setExporting(true);
    try {
      await exportAttendanceDayPDF(
        data, selectedDate,
        activeSession || '—',
        orderedStudents.map((s) => s.id),
        currentUser?.name ?? 'المدير',
      );
    } finally { setExporting(false); }
  };

  const sessions = data.attendanceSessions ?? [];
  const reorderStudents = localOrder.map((id) => data.students.find((s) => s.id === id)).filter(Boolean) as import('../lib/types').Student[];

  return (
    <div className="space-y-4">
      {/* ─── Top bar ─── */}
      <div className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold text-app">سجل الحضور</h3>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1.5">
            <button onClick={prevDay} className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)' }}>
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="outline-none bg-transparent text-app text-sm w-[120px]"
              />
              <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{dayLabel}</span>
            </div>
            <button onClick={nextDay} disabled={selectedDate >= todayStr} className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: selectedDate >= todayStr ? 'var(--text-muted)' : 'var(--text-secondary)', opacity: selectedDate >= todayStr ? 0.4 : 1 }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Session selector + manage */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-xl border px-3 py-2" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)' }}>
              <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <select
                value={activeSession}
                onChange={(e) => setActiveSession(e.target.value)}
                className="text-sm bg-transparent outline-none text-app min-w-[120px]"
              >
                <option value="">— بدون جلسة —</option>
                {sessions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowSessMgr(true)} className="text-xs px-3 py-2 rounded-xl border transition-colors" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <SettingsIcon className="w-3.5 h-3.5 inline ml-1" />إدارة الجلسات
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {([['present', stats.present], ['late', stats.late], ['excused', stats.excused], ['absent', stats.absent]] as [AttendanceStatus, number][]).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter((f) => f === status ? 'all' : status)}
              className="text-center p-2.5 rounded-xl border transition-all"
              style={{
                background: ATTENDANCE_META[status].bg,
                borderColor: statusFilter === status ? ATTENDANCE_META[status].color : ATTENDANCE_META[status].bg,
                boxShadow: statusFilter === status ? `0 0 0 2px ${ATTENDANCE_META[status].color}33` : 'none',
              }}
            >
              <div className="text-lg font-bold tabular-nums" style={{ color: ATTENDANCE_META[status].color }}>{count}</div>
              <div className="text-[10px]" style={{ color: ATTENDANCE_META[status].color }}>{ATTENDANCE_META[status].label}</div>
            </button>
          ))}
          <button
            onClick={() => setStatusFilter((f) => f === 'unmarked' ? 'all' : 'unmarked')}
            className="text-center p-2.5 rounded-xl border transition-all"
            style={{
              background: 'var(--bg-soft)',
              borderColor: statusFilter === 'unmarked' ? 'var(--text-muted)' : 'var(--border-soft)',
            }}
          >
            <div className="text-lg font-bold tabular-nums text-dim">{stats.unmarked}</div>
            <div className="text-[10px] text-dim flex items-center justify-center gap-0.5"><Minus className="w-3 h-3" />لم يسجل</div>
          </button>
        </div>

        {/* Session required banner */}
        {!activeSession && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 text-sm font-medium"
            style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)', border: '1px solid var(--c-amber-bd)' }}>
            <Tag className="w-4 h-4 flex-shrink-0" />
            اختر جلسة من القائمة أعلاه لتتمكن من تسجيل الحضور
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button
            disabled={!activeSession}
            onClick={() => bulkMarkAttendance(data.students.map((s) => s.id), selectedDate, 'present', activeSession || undefined)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all"
            style={activeSession
              ? { background: 'var(--st-done-bg)', color: 'var(--st-done)', borderColor: 'var(--st-done-bg)' }
              : { background: 'var(--bg-soft)', color: 'var(--text-muted)', borderColor: 'var(--border-soft)', opacity: 0.5, cursor: 'not-allowed' }}
          >
            <CheckCircle2 className="w-4 h-4" /> الكل حضور
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className={inputCls() + ' pr-9 text-sm'} style={inputStyle()} />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl py-2 px-3 text-sm border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="all">كل الحالات</option>
            <option value="present">حاضر</option>
            <option value="late">متأخر</option>
            <option value="excused">معذور</option>
            <option value="absent">غائب</option>
            <option value="unmarked">لم يُسجَّل</option>
          </select>

          {/* Reorder toggle */}
          <button
            onClick={() => setReorderMode((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-all"
            style={reorderMode
              ? { background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }
              : { background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
          >
            <ArrowUpDown className="w-3.5 h-3.5" /> ترتيب الطلاب
          </button>

          {/* Import / Export buttons */}
          <button onClick={() => setShowImportModal(true)} title="استيراد حضور من Excel" className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--c-amber)' }}>
            <Upload className="w-4 h-4" />
          </button>
          <button onClick={openExcelModal} disabled={exporting} title="تصدير Excel" className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--c-teal)' }}>
            <FileSpreadsheet className="w-4 h-4" />
          </button>
          <button onClick={handlePdfExport} disabled={exporting} title="تصدير PDF" className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--c-rose)' }}>
            <FileDown className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Reorder mode — drag & drop ─── */}
        {reorderMode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                <GripVertical className="w-4 h-4" />
                اسحب للترتيب — اضغط حفظ عند الانتهاء
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setAttendanceOrder(localOrder); setReorderMode(false); }} className={btnPrimary() + ' text-sm py-1.5'} style={btnPrimaryStyle()}>
                  <Save className="w-3.5 h-3.5" /> حفظ الترتيب
                </button>
                <button onClick={() => setReorderMode(false)} className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {reorderStudents.map((s, i) => (
                    <SortableStudentRow key={s.id} student={s} index={i} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* ─── Normal student list ─── */}
        {!reorderMode && (
          <>
            {data.students.length === 0 ? (
              <p className="text-sm text-dim text-center py-8">لا يوجد طلاب بعد</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-dim text-center py-8">لا توجد نتائج</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-xs text-dim">{filteredStudents.length} طالب</span>
                  {activeSession && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Tag className="w-3 h-3 inline ml-1" />{activeSession}</span>}
                </div>
                {filteredStudents.map((student, i) => (
                  <AttendanceStudentRow
                    key={student.id}
                    student={student}
                    record={recordMap.get(student.id)}
                    sessionType={activeSession}
                    selectedDate={selectedDate}
                    index={i}
                    total={filteredStudents.length}
                    sessionSelected={!!activeSession}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Session manager modal */}
      <AnimatePresence>
        {showSessMgr && <SessionManagerModal onClose={() => setShowSessMgr(false)} />}
      </AnimatePresence>

      {/* Attendance import modal */}
      <AnimatePresence>
        {showImportModal && (
          <AttendanceImportModal
            onClose={() => setShowImportModal(false)}
            selectedDate={selectedDate}
            activeSession={activeSession}
            orderedStudents={orderedStudents}
          />
        )}
      </AnimatePresence>

      {/* Excel export modal */}
      <AnimatePresence>
        {showExportModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowExportModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-md rounded-2xl shadow-2xl pointer-events-auto p-6 space-y-5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--c-teal)' }} />
                    <h3 className="text-base font-bold text-app">تصدير سجل الحضور — Excel</h3>
                  </div>
                  <button onClick={() => setShowExportModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mode selection */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-dim mb-1">اختر نطاق التصدير</p>
                  {([
                    ['today', 'اليوم الحالي فقط',       selectedDate],
                    ['all',   'كامل السجل المُدخَل',     ''],
                    ['range', 'نطاق تواريخ مخصص',        ''],
                  ] as [typeof exportMode, string, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setExportMode(mode)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-right transition-all"
                      style={exportMode === mode
                        ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }
                        : { background: 'var(--bg-soft)',    borderColor: 'var(--border)',   color: 'var(--text-secondary)' }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{ borderColor: exportMode === mode ? 'var(--accent)' : 'var(--border)' }}
                      >
                        {exportMode === mode && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
                      </span>
                      <span className="flex-1">{label}</span>
                      {mode === 'today' && <span className="text-xs opacity-60">{selectedDate}</span>}
                    </button>
                  ))}
                </div>

                {/* Custom date range pickers */}
                {exportMode === 'range' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border p-4 space-y-3"
                    style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-dim">من تاريخ</label>
                        <input
                          type="date"
                          value={exportDateFrom}
                          max={exportDateTo || todayStr}
                          onChange={(e) => setExportDateFrom(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </div>
                      <span className="text-dim mt-5">←</span>
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-dim">إلى تاريخ</label>
                        <input
                          type="date"
                          value={exportDateTo}
                          min={exportDateFrom}
                          max={todayStr}
                          onChange={(e) => setExportDateTo(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Info note */}
                <p className="text-xs text-dim rounded-lg px-3 py-2" style={{ background: 'var(--bg-soft)' }}>
                  الملف سيحتوي على: <strong>غلاف</strong> + <strong>جدول شبكي</strong> (طلاب × أيام بألوان الحالة) + <strong>تفصيل الاستثناءات</strong>
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleExcelExport(exportMode, exportDateFrom, exportDateTo)}
                    disabled={exporting || (exportMode === 'range' && (!exportDateFrom || !exportDateTo))}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: 'var(--c-teal)', color: 'white' }}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {exporting ? 'جاري التصدير…' : 'تصدير Excel'}
                  </button>
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2.5 rounded-xl text-sm border transition-all"
                    style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============== Attendance Import Modal ==============
const STATUS_IMPORT_MAP: Record<string, AttendanceStatus> = {
  'م': 'present', 'حاضر': 'present', 'present': 'present', 'حضر': 'present',
  'غ': 'absent',  'غائب': 'absent',  'absent': 'absent',
  'ب': 'excused', 'معذور': 'excused', 'excused': 'excused', 'عذر': 'excused',
  'ت': 'late',    'متأخر': 'late',   'late': 'late',
};

// Non-session summary columns to skip
const SKIP_HEADERS = ['إجمالي الحضور', 'إجمالي الغياب', 'غياب مبرر', 'إجمالي التأخير', 'نسبة الحضور', 'ملاحظات'];

type ImportRow = {
  session: string;
  date: string;
  name: string;
  status: AttendanceStatus | null;
  matched: boolean;
};

// Parse DD/MM/YYYY → YYYY-MM-DD (Arabic date convention)
function parseDateDDMM(raw: string, fallback: string): string {
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Excel serial number
  const n = Number(raw);
  if (!isNaN(n) && n > 40000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  // DD/MM/YYYY
  const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // YYYY/MM/DD
  const m2 = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`;
  return fallback;
}

function AttendanceImportModal({
  onClose, selectedDate, orderedStudents,
}: {
  onClose: () => void;
  selectedDate: string;
  orderedStudents: import('../lib/types').Student[];
}) {
  const { data, markAttendance } = useStore();
  const sessions = data.attendanceSessions ?? [];
  const fileRef  = useRef<HTMLInputElement>(null);
  const [rows,     setRows]     = useState<ImportRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [imported, setImported] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  // ── template: matrix format matching the export ───────────────────
  const downloadTemplate = () => {
    const sessionList = sessions.length > 0
      ? sessions.map((s) => s.name)
      : ['يوم المسابقة', 'يوم الناشئة'];

    // Build header rows
    const titleRow  = ['سجل الحضور — قالب للاستيراد', ...Array(sessionList.length + 1).fill('')];
    const emptyRow  = Array(sessionList.length + 2).fill('');
    const headerRow = ['الرقم', 'اسم الطالب', ...sessionList];
    const dayRow    = ['', '', ...sessionList.map(() => '')];
    const dateRow   = ['', '', ...sessionList.map(() => selectedDate)];

    const aoa: unknown[][] = [titleRow, emptyRow, headerRow, dayRow, dateRow];
    orderedStudents.forEach((s, i) => {
      aoa.push([i + 1, s.name, ...sessionList.map(() => '')]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 32 }, ...sessionList.map(() => ({ wch: 14 }))];

    // Merge title row
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: sessionList.length + 1 } }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
    XLSX.writeFile(wb, `قالب-حضور-شبكة.xlsx`);
  };

  // ── parse the matrix file (same format as export) ─────────────────
  const handleFile = (file: File) => {
    setLoading(true);
    setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb      = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        const ws      = wb.Sheets[wb.SheetNames[0]];
        const raw     = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
        const nameMap = new Map(orderedStudents.map((s) => [s.name.trim(), s]));

        // Locate the header row: contains "اسم الطالب" in col 1
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(raw.length, 6); r++) {
          if (String(raw[r]?.[1] ?? '').includes('اسم الطالب') || String(raw[r]?.[1] ?? '').includes('الاسم')) {
            headerRowIdx = r;
            break;
          }
        }
        if (headerRowIdx < 0) throw new Error('لم يُعثَر على عمود "اسم الطالب"');

        const headerRow = raw[headerRowIdx] as string[];
        // Date row is typically 2 rows after header row
        const dateRowIdx = headerRowIdx + 2;
        const dateRow    = raw[dateRowIdx] as string[];
        const dataStart  = headerRowIdx + 3; // students start after title/header/dayname/date rows

        // Build column map: col index → { session, date }
        const cols: { col: number; session: string; date: string }[] = [];
        for (let c = 2; c < headerRow.length; c++) {
          const hdr = String(headerRow[c] ?? '').trim();
          if (!hdr) continue;
          if (SKIP_HEADERS.some((s) => hdr.startsWith(s))) continue;
          const rawDate = String(dateRow?.[c] ?? '').trim();
          cols.push({ col: c, session: hdr, date: parseDateDDMM(rawDate, selectedDate) });
        }

        const allRows: ImportRow[] = [];
        for (let r = dataStart; r < raw.length; r++) {
          const row  = raw[r] as unknown[];
          const name = String(row[1] ?? '').trim();
          if (!name) continue;
          const matched = nameMap.has(name);
          for (const { col, session, date } of cols) {
            const rawSt = String(row[col] ?? '').trim();
            if (!rawSt) continue; // empty = not recorded
            const status = STATUS_IMPORT_MAP[rawSt] ?? STATUS_IMPORT_MAP[rawSt.toLowerCase()] ?? null;
            allRows.push({ session, date, name, status, matched });
          }
        }

        setRows(allRows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
        alert(`تعذّر قراءة الملف: ${msg}`);
      } finally { setLoading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── confirm ───────────────────────────────────────────────────────
  const handleConfirm = () => {
    const nameMap = new Map(orderedStudents.map((s) => [s.name.trim(), s]));
    let count = 0;
    for (const row of rows) {
      if (!row.matched || !row.status) continue;
      const student = nameMap.get(row.name.trim());
      if (!student) continue;
      markAttendance(student.id, row.date, row.status, { sessionType: row.session || undefined });
      count++;
    }
    setDoneCount(count);
    setImported(true);
    setTimeout(onClose, 1500);
  };

  // ── derived ───────────────────────────────────────────────────────
  const sessionNames   = [...new Set(rows.map((r) => r.session))];
  const totalMatched   = rows.filter((r) => r.matched && r.status).length;
  const totalUnmatched = rows.filter((r) => !r.matched).length;
  const totalNoStatus  = rows.filter((r) => r.matched && !r.status).length;

  return (
    <Modal title="استيراد الحضور — شبكة جلسات" onClose={onClose}>
      <div className="space-y-4">
        {imported ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--c-teal)' }} />
            <p className="font-bold text-app text-lg">تم الاستيراد بنجاح</p>
            <p className="text-sm text-dim mt-1">{doneCount} سجل في {sessionNames.length} جلسة</p>
          </div>
        ) : (
          <>
            {/* Format explanation */}
            <div className="rounded-xl p-3 border text-xs leading-relaxed space-y-1"
              style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
              <p className="font-semibold text-app">📊 التنسيق المدعوم</p>
              <p>الملف يجب أن يكون <strong>شبكة</strong> مثل ملف تصدير الحضور:</p>
              <p>الصف الأول: عناوين — الصف الثاني: أسماء الأيام — الصف الثالث: التواريخ</p>
              <p>كل <strong>عمود</strong> = جلسة · كل <strong>صف</strong> = طالب</p>
              <p className="mt-1"><strong>قيم الحالة:</strong> م · غ · ب · ت (أو حاضر / غائب / معذور / متأخر)</p>
            </div>

            {/* Template download */}
            <div className="flex items-center justify-between p-3 rounded-xl border"
              style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
              <div>
                <div className="text-sm font-medium text-app">تحميل قالب فارغ</div>
                <div className="text-xs text-dim mt-0.5">
                  {sessions.length > 0
                    ? `${sessions.length} جلسة: ${sessions.map((s) => s.name).join('، ')}`
                    : 'جلستان افتراضيتان — عدّل أسماء الأعمدة حسب الحاجة'}
                </div>
              </div>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }}>
                <Download className="w-3.5 h-3.5" /> القالب
              </button>
            </div>

            {/* Upload */}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={loading}
              className="w-full border-2 border-dashed rounded-2xl py-6 flex flex-col items-center gap-2 transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              {loading
                ? <><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    <span className="text-sm">جاري قراءة الملف…</span></>
                : <><FileSpreadsheet className="w-6 h-6" />
                    <span className="text-sm font-medium">اضغط لاختيار ملف Excel</span>
                    <span className="text-xs text-dim">يمكن استيراد ملف التصدير مباشرةً بعد تعبئته</span></>
              }
            </button>

            {/* Preview */}
            {rows.length > 0 && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2 py-1 rounded-lg font-semibold"
                    style={{ background: 'var(--st-done-bg)', color: 'var(--st-done)' }}>
                    ✓ {totalMatched} سجل
                  </span>
                  <span className="px-2 py-1 rounded-lg"
                    style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>
                    {sessionNames.length} جلسة
                  </span>
                  {totalUnmatched > 0 && (
                    <span className="px-2 py-1 rounded-lg"
                      style={{ background: 'var(--c-rose-bg)', color: 'var(--c-rose)' }}>
                      ✗ {totalUnmatched} غير مطابق
                    </span>
                  )}
                  {totalNoStatus > 0 && (
                    <span className="px-2 py-1 rounded-lg"
                      style={{ background: 'var(--c-amber-bg)', color: 'var(--c-amber)' }}>
                      ⚠ {totalNoStatus} بدون حالة
                    </span>
                  )}
                </div>

                {/* Per-session collapsible */}
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {sessionNames.map((sName) => {
                    const sRows    = rows.filter((r) => r.session === sName);
                    const sMatched = sRows.filter((r) => r.matched && r.status).length;
                    const sDates   = [...new Set(sRows.map((r) => r.date))];
                    return (
                      <details key={sName} className="rounded-xl border overflow-hidden"
                        style={{ borderColor: 'var(--border-soft)' }}>
                        <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
                          style={{ background: 'var(--bg-soft)' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                            <span className="text-sm font-medium text-app truncate">{sName}</span>
                            <span className="text-xs text-dim flex-shrink-0">{sDates.join(' · ')}</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mr-2"
                            style={{ background: 'var(--st-done-bg)', color: 'var(--st-done)' }}>
                            {sMatched}/{sRows.length}
                          </span>
                        </summary>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                              <th className="p-2 text-right font-medium">الاسم</th>
                              <th className="p-2 text-center font-medium">التاريخ</th>
                              <th className="p-2 text-center font-medium">الحالة</th>
                              <th className="p-2 text-center font-medium">✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sRows.map((r, i) => (
                              <tr key={i} className="border-t"
                                style={{ borderColor: 'var(--border-soft)', opacity: r.matched ? 1 : 0.4 }}>
                                <td className="p-2 text-app">{r.name}</td>
                                <td className="p-2 text-center text-dim tabular-nums">{r.date}</td>
                                <td className="p-2 text-center">
                                  {r.status
                                    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                        style={{ background: ATTENDANCE_META[r.status].bg, color: ATTENDANCE_META[r.status].color }}>
                                        {ATTENDANCE_META[r.status].label}
                                      </span>
                                    : <span className="text-dim">—</span>
                                  }
                                </td>
                                <td className="p-2 text-center">
                                  {r.matched
                                    ? <span style={{ color: 'var(--c-teal)' }}>✓</span>
                                    : <span style={{ color: 'var(--c-rose)' }} title="الاسم غير موجود في قائمة الطلاب">✗</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    );
                  })}
                </div>

                {/* Confirm */}
                <div className="flex gap-2">
                  <button onClick={handleConfirm} disabled={totalMatched === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: 'white' }}>
                    <CheckCircle2 className="w-4 h-4" />
                    تطبيق {totalMatched} سجل
                  </button>
                  <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm border"
                    style={{ background: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ============== Notifications Tab ==============
function NotificationsTab() {
  const { data, sendNotification, deleteNotification, updateScheduledNotifications } = useStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<'all' | 'student' | 'supervisor'>('all');
  const [targetMode, setTargetMode] = useState<'role' | 'group' | 'specific'>('role');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Scheduled notifications state
  const [showSchedForm, setShowSchedForm] = useState(false);
  const [schedTitle, setSchedTitle] = useState('');
  const [schedBody, setSchedBody] = useState('');
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedTarget, setSchedTarget] = useState<'all' | 'student' | 'supervisor'>('student');
  const [schedGroups, setSchedGroups] = useState<string[]>([]);
  const [expandedAutoId, setExpandedAutoId] = useState<string | null>(null);

  const notifications = data.notifications ?? [];
  const scheduledNotifications = data.scheduledNotifications ?? [];
  const allGroups = [...new Set(data.students.flatMap((s) =>
    s.groups && s.groups.length ? s.groups : [s.group],
  ))].filter(Boolean).sort() as string[];

  const toggleStudentId = (id: string) =>
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const toggleGroup = (g: string) =>
    setSelectedGroups((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);

  const [sentCount, setSentCount] = useState<number | null>(null);

  const handleSend = async () => {
    if (!title.trim()) return;
    setSending(true);
    setSentCount(null);
    try {
      const specificIds = targetMode === 'specific' && selectedStudentIds.length > 0 ? selectedStudentIds : undefined;
      const groups = targetMode === 'group' && selectedGroups.length > 0 ? selectedGroups : undefined;
      const role = targetMode === 'specific' ? 'student' : targetMode === 'group' ? 'student' : targetRole;
      const result = await sendNotification(title.trim(), body.trim(), role, specificIds, groups);
      setTitle(''); setBody(''); setSelectedStudentIds([]); setSelectedGroups([]);
      setSentCount(result.sent);
      setSent(true); setTimeout(() => { setSent(false); setSentCount(null); }, 5000);
    } finally { setSending(false); }
  };

  // Scheduled notification helpers
  const genSchedId = () => `sched-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  const handleAddSchedule = () => {
    if (!schedTitle.trim() || !schedTime) return;
    const newSched: import('../lib/types').ScheduledNotification = {
      id: genSchedId(),
      title: schedTitle.trim(),
      body: schedBody.trim(),
      targetRole: schedTarget,
      targetGroups: schedGroups.length ? schedGroups : undefined,
      time: schedTime,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: data.users.find((u) => u.role === 'admin')?.name ?? 'المدير',
    };
    updateScheduledNotifications([newSched, ...scheduledNotifications]);
    setSchedTitle(''); setSchedBody(''); setSchedTime('08:00'); setSchedGroups([]);
    setShowSchedForm(false);
  };

  const handleToggleAutoType = (autoType: 'morning-reminder' | 'evening-incomplete', defaultTime: string, defaultTitle: string, defaultBody: string) => {
    const existing = scheduledNotifications.find((s) => s.autoType === autoType);
    if (existing) {
      updateScheduledNotifications(scheduledNotifications.map((s) => s.id === existing.id ? { ...s, active: !s.active } : s));
    } else {
      const newSched: import('../lib/types').ScheduledNotification = {
        id: genSchedId(), title: defaultTitle, body: defaultBody,
        targetRole: 'student', time: defaultTime, active: true,
        autoType, createdAt: new Date().toISOString(),
        createdBy: data.users.find((u) => u.role === 'admin')?.name ?? 'المدير',
      };
      updateScheduledNotifications([...scheduledNotifications, newSched]);
    }
  };

  const handleUpdateSchedTime = (id: string, newTime: string) =>
    updateScheduledNotifications(scheduledNotifications.map((s) => s.id === id ? { ...s, time: newTime } : s));

  const handleToggleSched = (id: string) =>
    updateScheduledNotifications(scheduledNotifications.map((s) => s.id === id ? { ...s, active: !s.active } : s));

  const handleDeleteSched = (id: string) =>
    updateScheduledNotifications(scheduledNotifications.filter((s) => s.id !== id));

  const handleUpdateSchedField = (id: string, updates: Partial<import('../lib/types').ScheduledNotification>) =>
    updateScheduledNotifications(scheduledNotifications.map((s) => s.id === id ? { ...s, ...updates } : s));

  const morningSchedule = scheduledNotifications.find((s) => s.autoType === 'morning-reminder');
  const eveningSchedule = scheduledNotifications.find((s) => s.autoType === 'evening-incomplete');
  const manualSchedules = scheduledNotifications.filter((s) => !s.autoType);

  const targetLabels: Record<string, string> = {
    all: 'الجميع',
    student: 'الطلاب فقط',
    supervisor: 'المشرفون فقط',
  };

  const getNotifTarget = (n: { targetRole: string; targetStudentIds?: string[]; targetGroups?: string[] }) => {
    if (n.targetStudentIds?.length) {
      const names = n.targetStudentIds
        .slice(0, 2)
        .map((id) => data.students.find((s) => s.id === id)?.name ?? id)
        .join('، ');
      return n.targetStudentIds.length > 2 ? `${names} +${n.targetStudentIds.length - 2}` : names;
    }
    if (n.targetGroups?.length) {
      return `م: ${n.targetGroups.slice(0, 2).join('، ')}${n.targetGroups.length > 2 ? ` +${n.targetGroups.length - 2}` : ''}`;
    }
    return targetLabels[n.targetRole] ?? n.targetRole;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Compose */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h3 className="text-lg font-bold text-app">إرسال إشعار جديد</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">عنوان الإشعار *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تذكير بمهام اليوم"
              className="w-full px-4 py-2.5 rounded-xl text-sm border bg-transparent text-app outline-none transition-colors"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}
              maxLength={80}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">نص الإشعار</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="تفاصيل الإشعار (اختياري)"
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl text-sm border bg-transparent text-app outline-none transition-colors resize-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}
              maxLength={300}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sub mb-1.5">نوع الاستهداف</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['role', 'group', 'specific'] as const).map((m) => (
                <button key={m} onClick={() => setTargetMode(m)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border transition-all"
                  style={targetMode === m
                    ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }
                    : { background: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
                >
                  {m === 'role' ? 'حسب الدور' : m === 'group' ? 'حسب المجموعة' : 'طلاب محددون'}
                </button>
              ))}
            </div>

            {targetMode === 'role' && (
              <div className="flex gap-2 flex-wrap">
                {(['all', 'student', 'supervisor'] as const).map((r) => (
                  <button key={r} onClick={() => setTargetRole(r)}
                    className="px-4 py-2 rounded-xl text-sm font-medium border transition-all"
                    style={targetRole === r
                      ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }
                      : { background: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
                  >
                    {targetLabels[r]}
                  </button>
                ))}
              </div>
            )}

            {targetMode === 'group' && (
              <div className="border rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}>
                {allGroups.length === 0 && <p className="text-xs text-dim text-center py-2">لا توجد مجموعات مضافة</p>}
                {allGroups.map((g) => {
                  const checked = selectedGroups.includes(g);
                  const count = data.students.filter((s) => (s.groups ?? [s.group]).includes(g)).length;
                  return (
                    <label key={g} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-hover-soft transition-colors">
                      <input type="checkbox" checked={checked} onChange={() => toggleGroup(g)} className="rounded" />
                      <span className="text-sm text-app font-medium">{g}</span>
                      <span className="text-xs text-dim">{count} طالب</span>
                    </label>
                  );
                })}
              </div>
            )}

            {targetMode === 'specific' && (
              <div className="border rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}>
                {data.students.length === 0 && <p className="text-xs text-dim text-center py-2">لا يوجد طلاب</p>}
                {data.students.map((s) => {
                  const checked = selectedStudentIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-hover-soft transition-colors">
                      <input type="checkbox" checked={checked} onChange={() => toggleStudentId(s.id)} className="rounded" />
                      <span className="text-sm text-app">{s.name}</span>
                      <span className="text-xs text-dim">م{s.group}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !title.trim()
              || (targetMode === 'specific' && selectedStudentIds.length === 0)
              || (targetMode === 'group' && selectedGroups.length === 0)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
          >
            {sent ? (
              <><CheckCircle2 className="w-4 h-4" /> تم الإرسال!</>
            ) : sending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جارٍ الإرسال…</>
            ) : (
              <><Send className="w-4 h-4" /> إرسال الإشعار</>
            )}
          </button>
          {sent && sentCount !== null && (
            <p className="text-xs mt-2" style={{ color: sentCount > 0 ? 'var(--c-teal)' : 'var(--c-amber)' }}>
              {sentCount > 0
                ? `✓ وصل لـ ${sentCount} جهاز`
                : '⚠ لا يوجد أجهزة مشتركة بالإشعارات — تأكد من تفعيل الإشعارات في الإعدادات على كل جهاز'}
            </p>
          )}
        </div>
      </div>

      {/* Notifications history */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold text-app">سجل الإشعارات</h3>
          </div>
          <span className="text-xs text-dim">{notifications.length} إشعار</span>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <BellOff className="w-8 h-8" style={{ color: 'var(--border)' }} />
            <p className="text-sm text-dim">لم يُرسل أي إشعار بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-soft)' }}>
                  <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-app">{n.title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      {getNotifTarget(n)}
                    </span>
                  </div>
                  {n.body && <p className="text-xs text-sub mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-dim mt-1">
                    {new Date(n.createdAt).toLocaleString('ar-SA')} · {n.createdBy}
                  </p>
                </div>
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ color: 'var(--c-rose)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scheduled Notifications ── */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h3 className="text-lg font-bold text-app">الإشعارات المجدولة</h3>
          </div>
          <button
            onClick={() => setShowSchedForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          >
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>

        {/* Built-in auto notifications */}
        <p className="text-[11px] font-bold text-sub uppercase tracking-widest mb-3">تلقائية</p>
        <div className="space-y-2 mb-5">
          {/* Morning reminder */}
          {(() => {
            const active = morningSchedule?.active ?? false;
            const expanded = expandedAutoId === 'morning-reminder' && !!morningSchedule;
            return (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                <div className="flex items-center gap-3 p-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: active ? 'var(--c-teal-bg)' : 'var(--bg-card)' }}>
                    <Bell className="w-4 h-4" style={{ color: active ? 'var(--c-teal)' : 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app">{morningSchedule?.title ?? 'تذكير صباحي'}</p>
                    <p className="text-xs text-dim">يُرسَل تلقائياً كل يوم في الوقت المحدد</p>
                  </div>
                  {morningSchedule && (
                    <>
                      <input
                        type="time"
                        value={morningSchedule.time}
                        onChange={(e) => handleUpdateSchedField(morningSchedule.id, { time: e.target.value })}
                        className="text-xs border rounded-lg px-2 py-1 text-app"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', width: 90 }}
                      />
                      <button
                        onClick={() => setExpandedAutoId(expanded ? null : 'morning-reminder')}
                        className="p-1 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: expanded ? 'var(--accent)' : 'var(--text-secondary)' }}
                        title="تعديل"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleToggleAutoType('morning-reminder', '08:00', 'تذكير بمهام اليوم', 'لا تنسَ إنجاز مهام اليوم في برنامج مصلح')}
                    className="flex-shrink-0"
                  >
                    {active ? <ToggleRight className="w-7 h-7" style={{ color: 'var(--c-teal)' }} /> : <ToggleLeft className="w-7 h-7 text-dim" />}
                  </button>
                </div>
                {expanded && morningSchedule && (
                  <div className="px-3 pb-3 pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
                    <div>
                      <label className="block text-xs font-medium text-sub mb-1">عنوان الإشعار</label>
                      <input
                        value={morningSchedule.title}
                        onChange={(e) => handleUpdateSchedField(morningSchedule.id, { title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg text-sm border text-app outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-sub mb-1">نص الإشعار</label>
                      <textarea
                        value={morningSchedule.body}
                        onChange={(e) => handleUpdateSchedField(morningSchedule.id, { body: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg text-sm border text-app outline-none resize-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                        rows={2} maxLength={300}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-sub mb-1">الجمهور</label>
                        <select
                          value={morningSchedule.targetRole}
                          onChange={(e) => handleUpdateSchedField(morningSchedule.id, { targetRole: e.target.value as 'all' | 'student' | 'supervisor' })}
                          className="w-full px-3 py-1.5 rounded-lg text-sm border text-app outline-none"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                        >
                          <option value="all">الجميع</option>
                          <option value="student">الطلاب فقط</option>
                          <option value="supervisor">المشرفون فقط</option>
                        </select>
                      </div>
                      {allGroups.length > 0 && (
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-sub mb-1">تقييد بالمجموعة (اختياري)</label>
                          <div className="border rounded-lg p-1.5 max-h-20 overflow-y-auto space-y-1" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-card)' }}>
                            {allGroups.map((g) => (
                              <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox"
                                  checked={(morningSchedule.targetGroups ?? []).includes(g)}
                                  onChange={() => {
                                    const cur = morningSchedule.targetGroups ?? [];
                                    handleUpdateSchedField(morningSchedule.id, { targetGroups: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] });
                                  }}
                                  className="rounded" />
                                <span className="text-xs text-app">{g}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Evening incomplete */}
          {(() => {
            const active = eveningSchedule?.active ?? false;
            const expanded = expandedAutoId === 'evening-incomplete' && !!eveningSchedule;
            return (
              <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                <div className="flex items-center gap-3 p-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: active ? 'var(--c-amber-bg)' : 'var(--bg-card)' }}>
                    <BellOff className="w-4 h-4" style={{ color: active ? 'var(--c-amber)' : 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app">{eveningSchedule?.title ?? 'تنبيه مسائي للمتأخرين'}</p>
                    <p className="text-xs text-dim">يُرسَل للطلاب الذين لم يكملوا مهام اليوم</p>
                  </div>
                  {eveningSchedule && (
                    <>
                      <input
                        type="time"
                        value={eveningSchedule.time}
                        onChange={(e) => handleUpdateSchedField(eveningSchedule.id, { time: e.target.value })}
                        className="text-xs border rounded-lg px-2 py-1 text-app"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', width: 90 }}
                      />
                      <button
                        onClick={() => setExpandedAutoId(expanded ? null : 'evening-incomplete')}
                        className="p-1 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: expanded ? 'var(--accent)' : 'var(--text-secondary)' }}
                        title="تعديل"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleToggleAutoType('evening-incomplete', '20:00', 'لم تكمل مهام اليوم بعد', 'انتهز ما تبقى من اليوم وأكمل مهامك')}
                    className="flex-shrink-0"
                  >
                    {active ? <ToggleRight className="w-7 h-7" style={{ color: 'var(--c-amber)' }} /> : <ToggleLeft className="w-7 h-7 text-dim" />}
                  </button>
                </div>
                {expanded && eveningSchedule && (
                  <div className="px-3 pb-3 pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-soft)' }}>
                    <div>
                      <label className="block text-xs font-medium text-sub mb-1">عنوان الإشعار</label>
                      <input
                        value={eveningSchedule.title}
                        onChange={(e) => handleUpdateSchedField(eveningSchedule.id, { title: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg text-sm border text-app outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-sub mb-1">نص الإشعار</label>
                      <textarea
                        value={eveningSchedule.body}
                        onChange={(e) => handleUpdateSchedField(eveningSchedule.id, { body: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg text-sm border text-app outline-none resize-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                        rows={2} maxLength={300}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-sub mb-1">الجمهور</label>
                        <select
                          value={eveningSchedule.targetRole}
                          onChange={(e) => handleUpdateSchedField(eveningSchedule.id, { targetRole: e.target.value as 'all' | 'student' | 'supervisor' })}
                          className="w-full px-3 py-1.5 rounded-lg text-sm border text-app outline-none"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                        >
                          <option value="all">الجميع</option>
                          <option value="student">الطلاب فقط</option>
                          <option value="supervisor">المشرفون فقط</option>
                        </select>
                      </div>
                      {allGroups.length > 0 && (
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-sub mb-1">تقييد بالمجموعة (اختياري)</label>
                          <div className="border rounded-lg p-1.5 max-h-20 overflow-y-auto space-y-1" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-card)' }}>
                            {allGroups.map((g) => (
                              <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox"
                                  checked={(eveningSchedule.targetGroups ?? []).includes(g)}
                                  onChange={() => {
                                    const cur = eveningSchedule.targetGroups ?? [];
                                    handleUpdateSchedField(eveningSchedule.id, { targetGroups: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] });
                                  }}
                                  className="rounded" />
                                <span className="text-xs text-app">{g}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Manual schedules */}
        {manualSchedules.length > 0 && (
          <>
            <p className="text-[11px] font-bold text-sub uppercase tracking-widest mb-3">مخصصة</p>
            <div className="space-y-2 mb-4">
              {manualSchedules.map((sched) => (
                <div key={sched.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--bg-soft)', borderColor: 'var(--border-soft)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sched.active ? 'var(--accent-soft)' : 'var(--bg-card)' }}>
                    <Clock className="w-4 h-4" style={{ color: sched.active ? 'var(--accent)' : 'var(--text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app truncate">{sched.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-dim">{sched.time}</span>
                      {sched.targetGroups?.length
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>م: {sched.targetGroups.join('، ')}</span>
                        : <span className="text-[10px] text-dim">{sched.targetRole === 'all' ? 'الجميع' : sched.targetRole === 'student' ? 'الطلاب' : 'المشرفون'}</span>
                      }
                    </div>
                  </div>
                  <input
                    type="time"
                    value={sched.time}
                    onChange={(e) => handleUpdateSchedTime(sched.id, e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1 text-app"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', width: 90 }}
                  />
                  <button onClick={() => handleToggleSched(sched.id)} className="flex-shrink-0">
                    {sched.active
                      ? <ToggleRight className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                      : <ToggleLeft className="w-7 h-7 text-dim" />}
                  </button>
                  <button onClick={() => handleDeleteSched(sched.id)} className="flex-shrink-0" style={{ color: 'var(--c-rose)' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Add form */}
        {showSchedForm && (
          <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border-soft)' }}>
            <p className="text-sm font-bold text-app">إشعار مجدول جديد</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-sub mb-1">العنوان *</label>
                <input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="عنوان الإشعار"
                  className="w-full px-3 py-2 rounded-xl text-sm border bg-transparent text-app outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }} maxLength={80} />
              </div>
              <div>
                <label className="block text-xs font-medium text-sub mb-1">وقت الإرسال *</label>
                <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border text-app outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-sub mb-1">نص الإشعار</label>
              <textarea value={schedBody} onChange={(e) => setSchedBody(e.target.value)}
                placeholder="تفاصيل اختيارية" rows={2}
                className="w-full px-3 py-2 rounded-xl text-sm border bg-transparent text-app outline-none resize-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }} maxLength={300} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-sub mb-1">الجمهور</label>
                <select value={schedTarget} onChange={(e) => setSchedTarget(e.target.value as 'all' | 'student' | 'supervisor')}
                  className="w-full px-3 py-2 rounded-xl text-sm border text-app outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}>
                  <option value="all">الجميع</option>
                  <option value="student">الطلاب فقط</option>
                  <option value="supervisor">المشرفون فقط</option>
                </select>
              </div>
              {allGroups.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-sub mb-1">تقييد بالمجموعة (اختياري)</label>
                  <div className="border rounded-xl p-2 max-h-24 overflow-y-auto space-y-1" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-soft)' }}>
                    {allGroups.map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={schedGroups.includes(g)} onChange={() => setSchedGroups((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g])} className="rounded" />
                        <span className="text-xs text-app">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddSchedule}
                disabled={!schedTitle.trim() || !schedTime}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
              >
                <Plus className="w-4 h-4" /> إضافة الجدول
              </button>
              <button onClick={() => setShowSchedForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
