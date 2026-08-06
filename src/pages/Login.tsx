import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, ArrowLeft, Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTheme } from '../lib/useTheme';

export function Login() {
  const { login } = useStore();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user) {
        if (user.role === 'student') navigate('/student');
        else navigate('/dashboard');
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch {
      setError('تعذّر الاتصال بالخادم — حاول مجدداً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen ambient-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: 'var(--accent-soft)' }} />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full blur-3xl" style={{ background: 'var(--accent-soft)' }} />
      <button
        onClick={toggle}
        className="absolute top-5 left-5 w-10 h-10 rounded-xl flex items-center justify-center transition-colors z-20"
        style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            className="inline-block mb-5"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="مُصلِح"
              className="w-24 h-24 rounded-3xl object-cover"
              style={{ boxShadow: '0 0 48px -8px var(--accent-glow)' }}
            />
          </motion.div>
          <h1 className="text-3xl font-extrabold text-app tracking-tight">مُصلِح</h1>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-7 sm:p-8">
          <h2 className="text-lg font-bold text-app mb-1">تسجيل الدخول</h2>
          <p className="text-sm text-dim mb-6">أدخل بياناتك للوصول إلى لوحتك</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">اسم المستخدم</label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-dim" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-2xl py-3 pr-11 pl-4 text-app placeholder:text-dim focus-accent transition-all text-sm border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-dim mb-2 block font-medium">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-dim" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl py-3 pr-11 pl-11 text-app placeholder:text-dim focus-accent transition-all text-sm border"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim hover:text-sub transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-2xl px-4 py-3 text-sm border"
                style={{ background: 'var(--c-rose-bg)', borderColor: 'var(--c-rose-bd)', color: 'var(--c-rose)' }}
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.015 }}
              whileTap={{ scale: loading ? 1 : 0.985 }}
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg-base)',
                boxShadow: loading ? 'none' : '0 4px 16px -4px var(--accent-glow)',
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جارٍ التحقق...
                </>
              ) : (
                <>
                  دخول
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-xs text-dim mt-6">
          © {new Date().getFullYear()} مشروع مُصلِح - جميع الحقوق محفوظة
        </p>
      </motion.div>
    </div>
  );
}
