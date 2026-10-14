import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Translations } from '../../../i18n/translations';
import { api, AuthSession } from '../../../api/client';

interface AdminLoginFormProps {
  onLoginSuccess: (sessionUser: AuthSession) => void;
  t: Translations;
}

export const AdminLoginForm: React.FC<AdminLoginFormProps> = ({ onLoginSuccess, t }) => {
  const [adminOfficerId, setAdminOfficerId] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!adminOfficerId.trim() || !adminPasscode.trim()) {
      setLoginError('Officer ID and Master Passcode are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.login({
        role: 'admin',
        username: adminOfficerId.trim(),
        passcode: adminPasscode.trim(),
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setLoginError(err.message || 'Admin authentication failed. Invalid officer ID or passcode.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-xl font-bold text-slate-900">{t.tabAdmin}</h3>
        <p className="text-sm text-slate-500">
          Admissions registry, access audit logs, hospital database, and read-only SQL studio.
        </p>
      </div>

      {loginError && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-900">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{loginError}</span>
        </div>
      )}

      <div className="space-y-3.5">
        <div>
          <label htmlFor="adminOfficerInput" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Operations Officer ID *
          </label>
          <input
            id="adminOfficerInput"
            type="text"
            required
            value={adminOfficerId}
            onChange={(e) => setAdminOfficerId(e.target.value)}
            placeholder="e.g. ADM-OPS-01"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-semibold focus:ring-2 focus:ring-purple-500 bg-white min-h-[52px]"
          />
        </div>

        <div>
          <label htmlFor="adminPasscodeInput" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Master Passcode *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="adminPasscodeInput"
              type="password"
              required
              value={adminPasscode}
              onChange={(e) => setAdminPasscode(e.target.value)}
              placeholder="Enter admin passcode"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-semibold focus:ring-2 focus:ring-purple-500 bg-white min-h-[52px]"
            />
          </div>
        </div>

        {import.meta.env.DEV && (
          <details className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs text-purple-900">
            <summary className="font-bold cursor-pointer">Dev demo admin credentials</summary>
            <div className="mt-2 space-y-1 text-[11px]">
              <div>Officer ID: <code>ADM-OPS-01</code></div>
              <div>Passcode: <code>admin123</code></div>
              <button
                type="button"
                onClick={() => {
                  setAdminOfficerId('ADM-OPS-01');
                  setAdminPasscode('admin123');
                }}
                className="text-purple-700 font-bold underline mt-1 block cursor-pointer"
              >
                Auto-fill admin demo
              </button>
            </div>
          </details>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[52px]"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>{isSubmitting ? 'Verifying…' : 'Access Central Operations'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
};
