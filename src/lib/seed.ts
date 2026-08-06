import type { AppData, User } from './types';

export function createEmptyData(): AppData {
  const today = new Date();
  const startDate = new Date(today);

  const users: User[] = [
    { id: 'admin-1', name: 'مدير البرنامج', role: 'admin', username: 'admin', password: 'admin123', active: true },
    { id: 'sup-1', name: 'المشرف العام', role: 'supervisor', username: 'supervisor', password: 'sup123', active: true },
  ];

  return {
    users,
    students: [],
    tasks: [],
    progress: [],
    notifications: [],
    attendance: [],
    studentLists: [],
    scheduledNotifications: [],
    banners: [],
    config: {
      startDate: startDate.toISOString(),
      totalDays: 30,
      programName: 'مسابقة مُصلِح',
    },
  };
}

export function generateUsername(name: string, existingUsernames: string[]): string {
  const base = name.trim();
  if (!base) return 'طالب';
  let username = base;
  let suffix = 2;
  while (existingUsernames.includes(username)) {
    username = `${base} ${suffix}`;
    suffix++;
  }
  return username;
}

const PW_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePassword(): string {
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
  }
  return `Q26${suffix}`;
}
