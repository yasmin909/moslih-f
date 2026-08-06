import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AdminBanner,
  AppData,
  AppNotification,
  AttendanceRecord,
  AttendanceStatus,
  ProgramConfig,
  Student,
  StudentList,
  Task,
  TaskProgress,
  User,
} from './types';
import { createEmptyData, generateUsername, generatePassword } from './seed';

const AUTH_KEY = 'mislah-auth-user-v3';
const NOTIF_READ_KEY = 'mislah-notif-read-v1';
const VAPID_PUBLIC_KEY = 'BN-5N9A7PfflEkScAkvWLIBbRUiWlSYLXL4A7uppx3b5nsXisH6mlLFgB6XktbIQlagwYna055fPSzmtXd6LFi8';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(API_BASE + '/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'API error');
  }
  return res.json() as Promise<T>;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return buffer;
}

interface StoreContextValue {
  data: AppData;
  currentUser: User | null;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;

  addTask: (task: Omit<Task, 'id'>) => void;
  addTasks: (tasks: Omit<Task, 'id'>[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  deleteDayTasks: (day: number) => void;

  addStudent: (student: Omit<Student, 'id'> & { username?: string; password?: string }) => void;
  addStudents: (students: Omit<Student, 'id'>[]) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;

  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;

  completeTask: (studentId: string, taskId: string, submission?: Partial<TaskProgress>) => void;
  uncompleteTask: (studentId: string, taskId: string) => void;
  rateSubmission: (studentId: string, taskId: string, rating: number, note: string) => void;
  clearStudentProgress: (studentId: string) => void;

  updateConfig: (config: Partial<ProgramConfig>) => void;
  getCurrentDay: () => number;
  getStudentProgress: (studentId: string) => {
    completed: number;
    total: number;
    percentage: number;
    todayCompleted: number;
    todayTotal: number;
    todayPercentage: number;
  };
  getTasksForStudent: (studentId: string) => Task[];
  addStudentToGroup: (studentId: string, group: string) => void;
  removeStudentFromGroup: (studentId: string, group: string) => void;
  getTaskProgress: (studentId: string, taskId: string) => TaskProgress | undefined;

  getTodayAttendance: (studentId: string) => AttendanceRecord | undefined;
  getAttendanceForDay: (date: string) => AttendanceRecord[];
  getAttendanceStats: (studentId: string) => { present: number; late: number; absent: number; excused: number; total: number };

  addStudentList: (list: Omit<StudentList, 'id'>) => void;
  updateStudentList: (id: string, updates: Partial<StudentList>) => void;
  deleteStudentList: (id: string) => void;

  resetData: () => void;
  importData: (data: AppData) => void;
  clearAllProgress: () => void;

  sendNotification: (title: string, body: string, targetRole: AppNotification['targetRole'], targetStudentIds?: string[], targetGroups?: string[]) => Promise<{ sent: number }>;
  deleteNotification: (id: string) => void;
  getUnreadCount: () => number;
  markNotificationsRead: () => void;
  requestPushPermission: () => Promise<boolean>;
  requestPushUnsubscription: () => Promise<boolean>;
  updateScheduledNotifications: (schedules: import('./types').ScheduledNotification[]) => void;

  addBanner: (banner: Omit<AdminBanner, 'id' | 'createdAt' | 'createdBy'>) => void;
  updateBanner: (id: string, updates: Partial<AdminBanner>) => void;
  deleteBanner: (id: string) => void;

  addGroup: (name: string) => void;
  deleteGroup: (name: string) => void;
  renameGroup: (oldName: string, newName: string) => void;

  markAttendance: (studentId: string, date: string, status: import('./types').AttendanceStatus, extra?: { lateMinutes?: number; excuse?: string; sessionType?: string }) => void;
  updateAttendanceField: (studentId: string, date: string, updates: Partial<Pick<import('./types').AttendanceRecord, 'lateMinutes' | 'excuse' | 'note' | 'sessionType'>>) => void;
  bulkMarkAttendance: (studentIds: string[], date: string, status: import('./types').AttendanceStatus, sessionType?: string) => void;
  addAttendanceSession: (session: Omit<import('./types').AttendanceSession, 'id'>) => void;
  updateAttendanceSession: (id: string, updates: Partial<import('./types').AttendanceSession>) => void;
  deleteAttendanceSession: (id: string) => void;
  setAttendanceOrder: (order: string[]) => void;
  toggleRestDay: (day: number) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Normalise fields that may be missing in older records */
function normaliseData(d: AppData): void {
  d.users = (d.users ?? []).map((u) => ({ ...u, active: u.active ?? true }));
  if (!d.notifications)          d.notifications = [];
  if (!d.attendance)             d.attendance = [];
  if (!d.studentLists)           d.studentLists = [];
  if (!d.groupList) {
    d.groupList = Array.from(new Set(
      d.students.flatMap((s) => s.groups?.length ? s.groups : s.group ? [s.group] : [])
    )).sort();
  }
  if (!d.attendanceSessions) d.attendanceSessions = [];
  if (!d.attendanceOrder)    d.attendanceOrder = [];
  if (!d.restDays)           d.restDays = [];
  if (!d.scheduledNotifications) d.scheduledNotifications = [];
  if (!d.banners)                d.banners = [];
  d.students = (d.students ?? []).map((s) => ({
    ...s,
    groups: (s.groups && s.groups.length > 0) ? s.groups : [s.group].filter(Boolean),
  }));
}

/** Plays a gentle two-tone bell chime using Web Audio API */
function playMislahChime(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as Record<string, typeof AudioContext>)['webkitAudioContext'];
    if (!AC) return;
    const ctx = new AC();
    ([[ 880, 0, 0.28 ], [ 1320, 0.16, 0.38 ]] as [number, number, number][]).forEach(([freq, delay, dur]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* unsupported */ }
}

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_READ_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createEmptyData());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const initialised = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<AppData>(data);
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => {
    (async () => {
      try {
        // Check if an active session exists on the server
        const sessionUser = await apiFetch<Omit<User, 'password'>>('/auth/me').catch(() => null);
        if (!sessionUser) {
          // No session — just show login, don't load any data yet
          return;
        }
        // Valid session — fetch data (server filters by role)
        const serverData = await apiFetch<AppData>('/data');
        normaliseData(serverData);
        setData(serverData);
        setCurrentUser({ ...sessionUser, password: '' } as User);
      } catch {
        // Server unreachable — stay on login screen
      } finally {
        initialised.current = true;
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  // Listen for push messages from the service worker → play sound
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'MISLAH_PLAY_SOUND') playMislahChime();
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // ── Polling: pull fresh data every 30 s while logged in ───────────────────
  // Also fires browser Notification for new items the current user hasn't seen,
  // as a fallback when SW push delivery fails.
  const shownNotifIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const poll = async () => {
      const user = currentUserRef.current;
      if (!user) return;
      try {
        const fresh = await apiFetch<AppData>('/data');
        normaliseData(fresh);

        // Find notifications addressed to this user that we haven't shown yet
        const readIds = getReadIds();
        const newForMe = (fresh.notifications ?? []).filter((n) => {
          if (readIds.has(n.id) || shownNotifIds.current.has(n.id)) return false;
          if (n.targetRole !== 'all' && n.targetRole !== user.role) return false;
          if (n.targetStudentIds?.length && !n.targetStudentIds.includes(user.studentId ?? '')) return false;
          return true;
        });

        // Show a browser Notification for each new one (fallback for SW push)
        if (newForMe.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
          newForMe.forEach((n) => {
            shownNotifIds.current.add(n.id);
            try {
              new Notification(n.title, {
                body: n.body,
                icon: '/favicon.svg',
                badge: '/favicon.svg',
                dir: 'rtl',
                lang: 'ar',
                tag: `mislah-notif-${n.id}`,
              });
              playMislahChime();
            } catch { /* ignore */ }
          });
        }

        // Merge server data into local state:
        // - tasks, students, studentLists, config, notifications: always take from server (admin may have changed them)
        // - progress: keep local (student's own changes; server returns only their own anyway, but local may be ahead of sync)
        setData((prev) => ({
          ...prev,
          tasks:                  fresh.tasks                  ?? prev.tasks,
          students:               fresh.students               ?? prev.students,
          studentLists:           fresh.studentLists           ?? prev.studentLists,
          config:                 fresh.config                 ?? prev.config,
          notifications:          fresh.notifications          ?? prev.notifications,
          scheduledNotifications: fresh.scheduledNotifications ?? prev.scheduledNotifications,
          attendance:             fresh.attendance             ?? prev.attendance,
          banners:                fresh.banners                ?? prev.banners,
          restDays:               fresh.restDays               ?? prev.restDays,
          groupList:              fresh.groupList              ?? prev.groupList,
        }));
      } catch { /* ignore — server unreachable */ }
    };

    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!initialised.current) return;
    // Safety: never sync when not logged in or when data looks like a blank slate
    // (guards against React Fast Refresh resetting state while preserving refs)
    if (!currentUserRef.current) return;
    if (!dataRef.current.users || dataRef.current.users.length === 0) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      apiFetch('/data', { method: 'PUT', body: JSON.stringify(dataRef.current) }).catch(() => undefined);
    }, 2000);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [data]);

  const login = async (username: string, password: string): Promise<User | null> => {
    try {
      const sessionUser = await apiFetch<Omit<User, 'password'>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      // Fetch data filtered for this user's role
      const serverData = await apiFetch<AppData>('/data');
      normaliseData(serverData);
      setData(serverData);
      const user = { ...sessionUser, password: '' } as User;
      setCurrentUser(user);
      localStorage.setItem(AUTH_KEY, JSON.stringify({ id: user.id }));
      return user;
    } catch {
      return null;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setData(createEmptyData());
    localStorage.removeItem(AUTH_KEY);
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
  };

  const addTask = (task: Omit<Task, 'id'>) =>
    setData((p) => ({ ...p, tasks: [...p.tasks, { ...task, id: genId('task') }] }));

  const addTasks = (tasks: Omit<Task, 'id'>[]) =>
    setData((p) => ({ ...p, tasks: [...p.tasks, ...tasks.map((t) => ({ ...t, id: genId('task') }))] }));

  const updateTask = (id: string, updates: Partial<Task>) =>
    setData((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) }));

  const deleteTask = (id: string) =>
    setData((p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.id !== id),
      progress: p.progress.filter((pr) => pr.taskId !== id),
    }));

  const deleteDayTasks = (day: number) => {
    const ids = new Set(dataRef.current.tasks.filter((t) => t.day === day).map((t) => t.id));
    setData((p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.day !== day),
      progress: p.progress.filter((pr) => !ids.has(pr.taskId)),
    }));
  };

  const addStudent = (student: Omit<Student, 'id'> & { username?: string; password?: string }) => {
    const id = genId('student');
    const newStudent: Student = {
      id, name: student.name, group: student.group,
      groups: (student.groups && student.groups.length > 0) ? student.groups : [student.group].filter(Boolean),
      phone: student.phone || '', telegramHandle: student.telegramHandle,
    };
    setData((prev) => {
      const existingUsernames = prev.users.map((u) => u.username);
      const studentCount = prev.users.filter((u) => u.role === 'student').length;
      const plainPw = student.password || generatePassword();
      const newUser: User = {
        id: genId('user'), name: student.name, role: 'student',
        username: student.username || generateUsername(student.name, existingUsernames),
        password: plainPw, plainPassword: plainPw,
        studentId: id, active: true,
      };
      return { ...prev, students: [...prev.students, newStudent], users: [...prev.users, newUser] };
    });
  };

  const addStudents = (students: Omit<Student, 'id'>[]) => {
    setData((prev) => {
      const existingUsernames = prev.users.map((u) => u.username);
      let studentCount = prev.users.filter((u) => u.role === 'student').length;
      const newStudents: Student[] = students.map((s) => ({
        ...s, id: genId('student'), phone: s.phone || '',
        groups: (s.groups && s.groups.length > 0) ? s.groups : [s.group].filter(Boolean),
      }));
      const newUsers: User[] = newStudents.map((s) => {
        studentCount++;
        const username = generateUsername(s.name, existingUsernames);
        existingUsernames.push(username);
        const plainPw = generatePassword();
        return {
          id: genId('user'), name: s.name, role: 'student' as const,
          username, password: plainPw, plainPassword: plainPw, studentId: s.id, active: true,
        };
      });
      return { ...prev, students: [...prev.students, ...newStudents], users: [...prev.users, ...newUsers] };
    });
  };

  const updateStudent = (id: string, updates: Partial<Student>) =>
    setData((p) => ({
      ...p,
      students: p.students.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      users: p.users.map((u) => (u.studentId === id && updates.name ? { ...u, name: updates.name } : u)),
    }));

  const deleteStudent = (id: string) =>
    setData((p) => ({
      ...p,
      students: p.students.filter((s) => s.id !== id),
      users: p.users.filter((u) => u.studentId !== id),
      progress: p.progress.filter((pr) => pr.studentId !== id),
      attendance: (p.attendance ?? []).filter((a) => a.studentId !== id),
    }));

  const addUser = (user: Omit<User, 'id'>) =>
    setData((prev) => {
      if (user.role === 'student') {
        const studentId = genId('student');
        return {
          ...prev,
          students: [...prev.students, { id: studentId, name: user.name, group: 'غير محدد', groups: ['غير محدد'], phone: '' }],
          users: [...prev.users, { ...user, id: genId('user'), studentId }],
        };
      }
      return { ...prev, users: [...prev.users, { ...user, id: genId('user') }] };
    });

  const updateUser = (id: string, updates: Partial<User>) => {
    setData((p) => ({ ...p, users: p.users.map((u) => (u.id === id ? { ...u, ...updates } : u)) }));
    if (currentUser?.id === id) setCurrentUser((p) => (p ? { ...p, ...updates } : p));
  };

  const deleteUser = (id: string) =>
    setData((prev) => {
      const user = prev.users.find((u) => u.id === id);
      return {
        ...prev,
        users: prev.users.filter((u) => u.id !== id),
        ...(user?.studentId
          ? {
              students: prev.students.filter((s) => s.id !== user.studentId),
              progress: prev.progress.filter((pr) => pr.studentId !== user.studentId),
              attendance: (prev.attendance ?? []).filter((a) => a.studentId !== user.studentId),
            }
          : {}),
      };
    });

  const completeTask = (studentId: string, taskId: string, submission?: Partial<TaskProgress>) => {
    const currentDay = getCurrentDay();
    const task = dataRef.current.tasks.find((t) => t.id === taskId);
    const isBackdated = task ? task.day < currentDay : false;
    setData((prev) => {
      const existing = prev.progress.find((p) => p.studentId === studentId && p.taskId === taskId);
      const entry: TaskProgress = {
        ...(existing ?? {}), taskId, studentId,
        status: 'completed', completedAt: new Date().toISOString(),
        isBackdated: isBackdated || undefined,
        ...submission,
      };
      return {
        ...prev,
        progress: existing
          ? prev.progress.map((p) => (p.studentId === studentId && p.taskId === taskId ? entry : p))
          : [...prev.progress, entry],
      };
    });
  };

  const uncompleteTask = (studentId: string, taskId: string) =>
    setData((p) => ({
      ...p,
      progress: p.progress.map((pr) =>
        pr.studentId === studentId && pr.taskId === taskId
          ? { ...pr, status: 'pending' as const, completedAt: undefined, isBackdated: undefined }
          : pr,
      ),
    }));

  const rateSubmission = (studentId: string, taskId: string, rating: number, note: string) =>
    setData((p) => ({
      ...p,
      progress: p.progress.map((pr) =>
        pr.studentId === studentId && pr.taskId === taskId
          ? { ...pr, supervisorRating: rating, supervisorNote: note, ratedAt: new Date().toISOString() }
          : pr,
      ),
    }));

  const clearStudentProgress = (studentId: string) =>
    setData((p) => ({ ...p, progress: p.progress.filter((pr) => pr.studentId !== studentId) }));

  const updateConfig = (config: Partial<ProgramConfig>) =>
    setData((p) => ({ ...p, config: { ...p.config, ...config } }));

  const getCurrentDay = (): number => {
    const diffDays = Math.floor((Date.now() - new Date(data.config.startDate).getTime()) / 86400000) + 1;
    return Math.max(1, Math.min(diffDays, data.config.totalDays));
  };

  const getTasksForStudent = (studentId: string): Task[] => {
    const student = data.students.find((s) => s.id === studentId);
    if (!student) return data.tasks;
    const studentGroups = new Set(
      student.groups?.length ? student.groups : [student.group].filter(Boolean),
    );
    return data.tasks.filter((task) => {
      const hasGroupTarget = task.targetGroups && task.targetGroups.length > 0;
      const hasStudentTarget = task.targetStudentIds && task.targetStudentIds.length > 0;
      if (!hasGroupTarget && !hasStudentTarget) return true;
      if (hasGroupTarget && task.targetGroups!.some((g) => studentGroups.has(g))) return true;
      if (hasStudentTarget && task.targetStudentIds!.includes(studentId)) return true;
      return false;
    });
  };

  const addStudentToGroup = (studentId: string, group: string) => {
    setData((p) => ({
      ...p,
      students: p.students.map((s) => {
        if (s.id !== studentId) return s;
        const existing = s.groups?.length ? s.groups : [s.group].filter(Boolean);
        if (existing.includes(group)) return s;
        return { ...s, groups: [...existing, group] };
      }),
    }));
  };

  const removeStudentFromGroup = (studentId: string, group: string) => {
    setData((p) => ({
      ...p,
      students: p.students.map((s) => {
        if (s.id !== studentId) return s;
        const existing = s.groups?.length ? s.groups : [s.group].filter(Boolean);
        const updated = existing.filter((g) => g !== group);
        return { ...s, groups: updated.length ? updated : existing, group: updated[0] ?? s.group };
      }),
    }));
  };

  const getStudentProgress = (studentId: string) => {
    const currentDay = getCurrentDay();
    const allTasks = getTasksForStudent(studentId);
    const sp = data.progress.filter((p) => p.studentId === studentId);
    const completed = sp.filter((p) => p.status === 'completed' && allTasks.some((t) => t.id === p.taskId)).length;
    const total = allTasks.length;
    const todayTasks = allTasks.filter((t) => t.day === currentDay);
    const todayCompleted = todayTasks.filter((t) =>
      sp.some((p) => p.taskId === t.id && p.status === 'completed'),
    ).length;
    return {
      completed, total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      todayCompleted, todayTotal: todayTasks.length,
      todayPercentage: todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0,
    };
  };

  const getTaskProgress = (studentId: string, taskId: string) =>
    data.progress.find((p) => p.studentId === studentId && p.taskId === taskId);

  const markAttendance = (studentId: string, date: string, status: AttendanceStatus, extra?: { lateMinutes?: number; excuse?: string; sessionType?: string }) => {
    const today = new Date().toISOString().split('T')[0];
    if (date > today) return;
    setData((p) => {
      const existing = (p.attendance ?? []).find((a) => a.studentId === studentId && a.date === date);
      const record: AttendanceRecord = {
        // Preserve existing extra fields, merge new ones
        lateMinutes: existing?.lateMinutes,
        excuse: existing?.excuse,
        sessionType: existing?.sessionType,
        ...extra,
        studentId, date, status,
        markedAt: new Date().toISOString(),
        markedBy: currentUserRef.current?.id ?? 'self',
      };
      // Clear lateMinutes when not late
      if (status !== 'late') record.lateMinutes = undefined;
      // Clear excuse when present
      if (status === 'present') record.excuse = undefined;
      return {
        ...p,
        attendance: existing
          ? (p.attendance ?? []).map((a) => (a.studentId === studentId && a.date === date ? record : a))
          : [...(p.attendance ?? []), record],
      };
    });
  };

  const updateAttendanceField = (studentId: string, date: string, updates: Partial<Pick<AttendanceRecord, 'lateMinutes' | 'excuse' | 'note' | 'sessionType'>>) => {
    setData((p) => ({
      ...p,
      attendance: (p.attendance ?? []).map((a) =>
        a.studentId === studentId && a.date === date
          ? { ...a, ...updates, markedAt: new Date().toISOString() }
          : a
      ),
    }));
  };

  const getTodayAttendance = (studentId: string): AttendanceRecord | undefined => {
    const today = new Date().toISOString().split('T')[0];
    return (data.attendance ?? []).find((a) => a.studentId === studentId && a.date === today);
  };

  const getAttendanceForDay = (date: string): AttendanceRecord[] =>
    (data.attendance ?? []).filter((a) => a.date === date);

  const getAttendanceStats = (studentId: string) => {
    const records = (data.attendance ?? []).filter((a) => a.studentId === studentId);
    return {
      present: records.filter((a) => a.status === 'present').length,
      late: records.filter((a) => a.status === 'late').length,
      absent: records.filter((a) => a.status === 'absent').length,
      excused: records.filter((a) => a.status === 'excused').length,
      total: records.length,
    };
  };

  const bulkMarkAttendance = (studentIds: string[], date: string, status: AttendanceStatus, sessionType?: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (date > today) return;
    setData((p) => {
      const existing = new Set(
        (p.attendance ?? []).filter((a) => a.date === date && studentIds.includes(a.studentId)).map((a) => a.studentId),
      );
      const updated = (p.attendance ?? []).map((a) =>
        a.date === date && studentIds.includes(a.studentId)
          ? { ...a, status, sessionType: sessionType ?? a.sessionType, markedAt: new Date().toISOString(), markedBy: currentUserRef.current?.id ?? 'admin' }
          : a,
      );
      const newRecords: AttendanceRecord[] = studentIds
        .filter((id) => !existing.has(id))
        .map((studentId) => ({
          studentId, date, status, sessionType,
          markedAt: new Date().toISOString(),
          markedBy: currentUserRef.current?.id ?? 'admin',
        }));
      return { ...p, attendance: [...updated, ...newRecords] };
    });
  };

  const addAttendanceSession = (session: Omit<import('./types').AttendanceSession, 'id'>) =>
    setData((p) => ({
      ...p,
      attendanceSessions: [...(p.attendanceSessions ?? []), { ...session, id: genId('sess') }],
    }));

  const updateAttendanceSession = (id: string, updates: Partial<import('./types').AttendanceSession>) =>
    setData((p) => ({
      ...p,
      attendanceSessions: (p.attendanceSessions ?? []).map((s) => s.id === id ? { ...s, ...updates } : s),
    }));

  const deleteAttendanceSession = (id: string) =>
    setData((p) => ({
      ...p,
      attendanceSessions: (p.attendanceSessions ?? []).filter((s) => s.id !== id),
    }));

  const setAttendanceOrder = (order: string[]) =>
    setData((p) => ({ ...p, attendanceOrder: order }));

  const toggleRestDay = (day: number) =>
    setData((p) => {
      const restDays = p.restDays ?? [];
      return { ...p, restDays: restDays.includes(day) ? restDays.filter((d) => d !== day) : [...restDays, day] };
    });

  const addStudentList = (list: Omit<StudentList, 'id'>) =>
    setData((p) => ({ ...p, studentLists: [...(p.studentLists ?? []), { ...list, id: genId('list') }] }));

  const updateStudentList = (id: string, updates: Partial<StudentList>) =>
    setData((p) => ({ ...p, studentLists: (p.studentLists ?? []).map((l) => (l.id === id ? { ...l, ...updates } : l)) }));

  const deleteStudentList = (id: string) =>
    setData((p) => ({ ...p, studentLists: (p.studentLists ?? []).filter((l) => l.id !== id) }));

  const resetData = () => setData(createEmptyData());
  const importData = (imported: AppData) => setData({
    ...imported,
    notifications: imported.notifications ?? [],
    attendance: imported.attendance ?? [],
    studentLists: imported.studentLists ?? [],
    banners: imported.banners ?? [],
  });
  const clearAllProgress = () => setData((p) => ({ ...p, progress: [] }));

  const sendNotification = async (
    title: string,
    body: string,
    targetRole: AppNotification['targetRole'],
    targetStudentIds?: string[],
    targetGroups?: string[],
  ): Promise<{ sent: number }> => {
    const notif: AppNotification = {
      id: genId('notif'),
      title,
      body,
      targetRole,
      targetStudentIds: targetStudentIds?.length ? targetStudentIds : undefined,
      targetGroups: targetGroups?.length ? targetGroups : undefined,
      createdAt: new Date().toISOString(),
      createdBy: currentUserRef.current?.name ?? 'المدير',
    };
    setData((p) => ({ ...p, notifications: [notif, ...(p.notifications ?? [])] }));

    try {
      const result = await apiFetch<{ sent?: number }>('/push/notify', {
        method: 'POST',
        body: JSON.stringify({ title, body, targetRole, targetStudentIds, targetGroups }),
      });
      return { sent: result.sent ?? 0 };
    } catch {
      return { sent: 0 };
    }
  };

  const deleteNotification = (id: string) =>
    setData((p) => ({ ...p, notifications: (p.notifications ?? []).filter((n) => n.id !== id) }));

  const updateScheduledNotifications = (schedules: import('./types').ScheduledNotification[]) =>
    setData((p) => ({ ...p, scheduledNotifications: schedules }));

  const addBanner = (banner: Omit<AdminBanner, 'id' | 'createdAt' | 'createdBy'>) =>
    setData((p) => ({
      ...p,
      banners: [...(p.banners ?? []), {
        ...banner,
        id: genId('banner'),
        createdAt: new Date().toISOString(),
        createdBy: currentUserRef.current?.name ?? 'المدير',
      }],
    }));

  const updateBanner = (id: string, updates: Partial<AdminBanner>) =>
    setData((p) => ({ ...p, banners: (p.banners ?? []).map((b) => (b.id === id ? { ...b, ...updates } : b)) }));

  const deleteBanner = (id: string) =>
    setData((p) => ({ ...p, banners: (p.banners ?? []).filter((b) => b.id !== id) }));

  const addGroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData((p) => {
      if ((p.groupList ?? []).includes(trimmed)) return p;
      return { ...p, groupList: [...(p.groupList ?? []), trimmed].sort() };
    });
  };

  const deleteGroup = (name: string) => {
    setData((p) => ({
      ...p,
      groupList: (p.groupList ?? []).filter((g) => g !== name),
      students: p.students.map((s) => {
        const filtered = (s.groups ?? [s.group]).filter((g) => g !== name);
        return { ...s, groups: filtered.length ? filtered : ['غير محدد'], group: filtered[0] ?? 'غير محدد' };
      }),
    }));
  };

  const renameGroup = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setData((p) => ({
      ...p,
      groupList: (p.groupList ?? []).map((g) => g === oldName ? trimmed : g).sort(),
      students: p.students.map((s) => ({
        ...s,
        groups: (s.groups ?? [s.group]).map((g) => g === oldName ? trimmed : g),
        group: s.group === oldName ? trimmed : s.group,
      })),
    }));
  };

  const getUnreadCount = (): number => {
    const readIds = getReadIds();
    const user = currentUserRef.current;
    if (!user) return 0;
    return (data.notifications ?? []).filter((n) => {
      if (readIds.has(n.id)) return false;
      if (n.targetRole !== 'all' && n.targetRole !== user.role) return false;
      if (n.targetStudentIds && n.targetStudentIds.length > 0) {
        return !!(user.studentId && n.targetStudentIds.includes(user.studentId));
      }
      return true;
    }).length;
  };

  const markNotificationsRead = () => {
    const user = currentUser;
    if (!user) return;
    const readIds = getReadIds();
    (data.notifications ?? []).forEach((n) => {
      if (n.targetRole !== 'all' && n.targetRole !== user.role) return;
      if (n.targetStudentIds && n.targetStudentIds.length > 0) {
        if (user.studentId && n.targetStudentIds.includes(user.studentId)) readIds.add(n.id);
        return;
      }
      readIds.add(n.id);
    });
    saveReadIds(readIds);
  };

  const requestPushPermission = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await apiFetch('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUserRef.current?.id ?? 'unknown',
          subscription: sub.toJSON(),
        }),
      });
      return true;
    } catch { return false; }
  };

  const requestPushUnsubscription = async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return true;
      await apiFetch('/push/unsubscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      return true;
    } catch { return false; }
  };

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: '#f4ede1',
          fontFamily: 'Tajawal, sans-serif', direction: 'rtl', gap: '1.5rem',
        }}
      >
        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes pulse-logo { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: 0.7; transform: scale(0.96) } }
        `}</style>
        {/* Logo mark */}
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="مُصلِح"
          style={{
            width: 88, height: 88, borderRadius: 24, objectFit: 'cover',
            animation: 'pulse-logo 1.8s ease-in-out infinite',
            boxShadow: '0 8px 32px -8px rgba(122,90,53,0.5)',
          }}
        />
        {/* Spinner + text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#7a5a35' }}>
          <span style={{
            width: 22, height: 22, border: '2.5px solid #d4c5ad',
            borderTopColor: '#7a5a35', borderRadius: '50%',
            display: 'inline-block', animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>جارٍ التحميل…</span>
        </div>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        data, currentUser, login, logout,
        addTask, addTasks, updateTask, deleteTask, deleteDayTasks,
        addStudent, addStudents, updateStudent, deleteStudent,
        addUser, updateUser, deleteUser,
        completeTask, uncompleteTask, rateSubmission, clearStudentProgress,
        updateConfig, getCurrentDay, getStudentProgress, getTasksForStudent,
        addStudentToGroup, removeStudentFromGroup, getTaskProgress,
        markAttendance, updateAttendanceField,
        bulkMarkAttendance,
        getTodayAttendance, getAttendanceForDay, getAttendanceStats,
        addAttendanceSession, updateAttendanceSession, deleteAttendanceSession,
        setAttendanceOrder, toggleRestDay,
        addStudentList, updateStudentList, deleteStudentList,
        resetData, importData, clearAllProgress,
        sendNotification, deleteNotification, getUnreadCount, markNotificationsRead,
        requestPushPermission, requestPushUnsubscription, updateScheduledNotifications,
        addBanner, updateBanner, deleteBanner,
        addGroup, deleteGroup, renameGroup,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
