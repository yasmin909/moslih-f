import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Users, ChevronLeft, MessageCircle, Send, Calendar } from 'lucide-react';
import { useStore } from '../lib/store';
import { ProgressBar } from '../components/ProgressBar';
import { getWhatsAppLink } from '../lib/reportUtils';

export function StudentsList() {
  const { data, getStudentProgress, getAttendanceStats } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const groups = useMemo(
    () => [...new Set(data.students.flatMap((s) => s.groups?.length ? s.groups : [s.group]))].sort(),
    [data.students],
  );

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    data.students.forEach((s) => {
      (s.groups?.length ? s.groups : [s.group]).forEach((g) => {
        map.set(g, (map.get(g) ?? 0) + 1);
      });
    });
    return map;
  }, [data.students]);

  const todayStr = new Date().toISOString().split('T')[0];

  const students = useMemo(() => {
    return data.students
      .filter((s) => {
        if (groupFilter !== 'all') {
          const sg = s.groups?.length ? s.groups : [s.group];
          if (!sg.includes(groupFilter)) return false;
        }
        if (search && !s.name.includes(search)) return false;
        return true;
      })
      .map((s) => ({
        student: s,
        progress: getStudentProgress(s.id),
        attendance: getAttendanceStats(s.id),
        todayAttendance: (data.attendance ?? []).find((a) => a.studentId === s.id && a.date === todayStr),
      }));
  }, [data.students, data.progress, data.attendance, search, groupFilter]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-app tracking-tight">قائمة الطلاب</h2>
        <p className="text-sm text-dim mt-1">{data.students.length} طالب في {groups.length} مجموعة</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم..." className="w-full rounded-2xl py-2.5 pr-10 pl-3 text-sm text-app placeholder:text-dim focus-accent border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setGroupFilter('all')} className="px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300" style={groupFilter === 'all' ? { background: 'var(--accent-soft)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-border)' } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>الكل ({data.students.length})</button>
          {groups.map((g) => (
            <button key={g} onClick={() => setGroupFilter(g)} className="px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300" style={groupFilter === g ? { background: 'var(--accent-soft)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-border)' } : { background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>{g} ({groupCounts.get(g) ?? 0})</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.map(({ student, progress, attendance, todayAttendance }, i) => {
          const attendedDays = attendance.present + attendance.late;
          const attendanceRate = attendance.total > 0 ? Math.round((attendedDays / attendance.total) * 100) : null;
          const attColor = attendanceRate === null ? '' : attendanceRate >= 80 ? 'var(--c-teal)' : attendanceRate >= 60 ? 'var(--c-amber)' : 'var(--c-rose)';
          const attBg = attendanceRate === null ? '' : attendanceRate >= 80 ? 'var(--c-teal-bg)' : attendanceRate >= 60 ? 'var(--c-amber-bg)' : 'var(--c-rose-bg)';

          return (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/students/${student.id}`)}
              className="glass-card rounded-2xl p-4 sm:p-5 border cursor-pointer transition-all duration-300 hover-lift group"
              style={{ borderColor: 'var(--border-soft)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-soft)')}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg" style={{ background: 'var(--border)', color: 'var(--text-primary)' }}>{student.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-app truncate group-hover:text-accent transition-colors">{student.name}</h3>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>مجموعة {student.group}</span>
                    {attendanceRate !== null && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1" style={{ background: attBg, color: attColor }}>
                        <Calendar className="w-3 h-3" />{attendanceRate}% حضور
                      </span>
                    )}
                    {todayAttendance && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: todayAttendance.status === 'present' ? 'var(--c-teal-bg)' : todayAttendance.status === 'late' ? 'var(--c-amber-bg)' : 'var(--c-rose-bg)', color: todayAttendance.status === 'present' ? 'var(--c-teal)' : todayAttendance.status === 'late' ? 'var(--c-amber)' : 'var(--c-rose)' }}>
                        {todayAttendance.status === 'present' ? 'حضر اليوم' : todayAttendance.status === 'late' ? 'متأخر' : todayAttendance.status === 'excused' ? 'معذور' : 'غائب'}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-dim group-hover:text-accent transition-colors flex-shrink-0" />
              </div>

              <div className="space-y-2.5 mb-3">
                <div className="flex items-center justify-between text-[11px]"><span className="text-dim">إنجاز اليوم</span><span className="text-sub tabular-nums">{progress.todayCompleted}/{progress.todayTotal}</span></div>
                <ProgressBar percentage={progress.todayPercentage} height={5} />
                <div className="flex items-center justify-between text-[11px]"><span className="text-dim">الإنجاز الكلي</span><span className="text-sub tabular-nums">{progress.percentage}%</span></div>
                <ProgressBar percentage={progress.percentage} height={5} />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                {student.phone ? (
                  <a
                    href={getWhatsAppLink(student.phone)}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors"
                    style={{ background: 'var(--c-emerald-bg)', color: 'var(--c-emerald)' }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> واتساب
                  </a>
                ) : (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium opacity-30 cursor-not-allowed select-none"
                    style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)' }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> واتساب
                  </div>
                )}
                {student.telegramHandle ? (
                  <a
                    href={`https://t.me/${student.telegramHandle.replace('@', '')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors"
                    style={{ background: 'var(--c-sky-bg)', color: 'var(--c-sky)' }}
                  >
                    <Send className="w-3.5 h-3.5" /> تيليجرام
                  </a>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium opacity-30 cursor-not-allowed select-none" style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)' }}>
                    <Send className="w-3.5 h-3.5" /> لا يوجد تيليجرام
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {students.length === 0 && (
          <div className="col-span-full text-center py-16 text-dim">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا يوجد طلاب مطابقون</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
