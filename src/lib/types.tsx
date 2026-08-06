import { Video, FileText, BookOpen, AlignLeft, Link2, Headphones, ListChecks, UserCheck, Clock, Shield, UserX } from 'lucide-react';

export type Role = 'admin' | 'supervisor' | 'student';

export type TaskType =
  | 'video'
  | 'pdf'
  | 'memorization'
  | 'text'
  | 'link'
  | 'audio'
  | 'quiz';

export interface User {
  id: string;
  name: string;
  role: Role;
  username: string;
  password: string;
  plainPassword?: string;
  studentId?: string;
  active: boolean;
}

export interface Task {
  id: string;
  day: number;
  type: TaskType;
  title: string;
  description: string;
  url?: string;
  requiresSubmission: boolean;
  submissionType?: 'audio' | 'text' | 'link';
  targetGroups?: string[];
  targetStudentIds?: string[];
}

export type TaskStatus = 'pending' | 'completed' | 'late';

export interface TaskProgress {
  taskId: string;
  studentId: string;
  status: TaskStatus;
  completedAt?: string;
  isBackdated?: boolean;
  submissionNote?: string;
  submissionLink?: string;
  audioDataUrl?: string;
  supervisorRating?: number;
  supervisorNote?: string;
  ratedAt?: string;
}

export interface Student {
  id: string;
  name: string;
  group: string;
  groups: string[];
  phone: string;
  telegramHandle?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface AttendanceRecord {
  studentId: string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  excuse?: string;      // سبب الغياب أو التأخر
  lateMinutes?: number; // مقدار التأخر بالدقائق
  sessionType?: string; // اسم الجلسة / اليوم
  markedAt: string;
  markedBy: string;
}

export interface AttendanceSession {
  id: string;
  name: string;        // مثال: "يوم المسابقة"
  dayOfWeek?: number;  // 0=الأحد … 6=السبت (اختياري للمرجع)
}

export interface StudentList {
  id: string;
  name: string;
  studentIds: string[];
}

export interface ProgramConfig {
  startDate: string;
  totalDays: number;
  programName: string;
  timezone?: string; // IANA timezone e.g. 'Asia/Riyadh'
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string;
  targetRole: 'all' | 'student' | 'supervisor';
  targetStudentIds?: string[];
  targetGroups?: string[];
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  targetRole: 'all' | 'student' | 'supervisor';
  targetGroups?: string[];
  time: string; // "HH:MM" 24h
  active: boolean;
  lastSentDate?: string; // "YYYY-MM-DD" — tracks last fire date
  createdAt: string;
  createdBy: string;
  autoType?: 'morning-reminder' | 'evening-incomplete'; // built-in auto behaviours
}

export type BannerIcon = 'trophy' | 'star' | 'award' | 'check' | 'sparkles';
export type BannerColor = 'amber' | 'teal' | 'clay' | 'rose' | 'mauve' | 'copper';

export interface AdminBanner {
  id: string;
  title: string;
  body?: string;
  icon: BannerIcon;
  color: BannerColor;
  targetRole: 'all' | 'student';
  targetStudentIds?: string[];
  targetGroups?: string[];
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AppData {
  users: User[];
  students: Student[];
  tasks: Task[];
  progress: TaskProgress[];
  config: ProgramConfig;
  notifications: AppNotification[];
  attendance: AttendanceRecord[];
  studentLists: StudentList[];
  scheduledNotifications?: ScheduledNotification[];
  banners?: AdminBanner[];
  groupList?: string[];           // master list of groups (independent of students)
  attendanceSessions?: AttendanceSession[]; // جلسات الحضور القابلة للتخصيص
  attendanceOrder?: string[];     // ترتيب الطلاب المحفوظ لسجل الحضور
  restDays?: number[];            // أرقام الأيام المعيّنة كأيام استدراك وراحة
}

export const TASK_TYPE_META: Record<
  TaskType,
  { label: string; icon: React.ReactNode; colorVar: string }
> = {
  video:       { label: 'فيديو',    icon: <Video      className="w-4 h-4" />, colorVar: '--c-terra'    },
  pdf:         { label: 'ملف PDF',  icon: <FileText   className="w-4 h-4" />, colorVar: '--c-amber'    },
  memorization:{ label: 'حفظ',      icon: <BookOpen   className="w-4 h-4" />, colorVar: '--c-mauve'    },
  text:        { label: 'قراءة',    icon: <AlignLeft  className="w-4 h-4" />, colorVar: '--c-olive'    },
  link:        { label: 'رابط',     icon: <Link2      className="w-4 h-4" />, colorVar: '--c-clay'     },
  audio:       { label: 'صوتي',     icon: <Headphones className="w-4 h-4" />, colorVar: '--c-copper'   },
  quiz:        { label: 'اختبار',   icon: <ListChecks className="w-4 h-4" />, colorVar: '--c-rosewood' },
};

export const ATTENDANCE_META: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  present: { label: 'حاضر',  color: 'var(--st-done)',     bg: 'var(--st-done-bg)',   icon: <UserCheck className="w-3.5 h-3.5" /> },
  late:    { label: 'متأخر', color: 'var(--c-amber)',     bg: 'var(--c-amber-bg)',   icon: <Clock     className="w-3.5 h-3.5" /> },
  excused: { label: 'معذور', color: 'var(--c-sky)',       bg: 'var(--c-sky-bg)',     icon: <Shield    className="w-3.5 h-3.5" /> },
  absent:  { label: 'غائب',  color: 'var(--st-late)',     bg: 'var(--st-late-bg)',   icon: <UserX     className="w-3.5 h-3.5" /> },
};
