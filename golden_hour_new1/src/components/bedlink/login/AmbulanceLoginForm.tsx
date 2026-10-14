import React, { useState } from 'react';
import { Truck, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Translations } from '../../../i18n/translations';
import { api, AuthSession } from '../../../api/client';

interface AmbulanceLoginFormProps {
  onLoginSuccess: (sessionUser: AuthSession) => void;
  t: Translations;
}

export const AmbulanceLoginForm: React.FC<AmbulanceLoginFormProps> = ({ onLoginSuccess, t }) => {
  const [driverBadgeId, setDriverBadgeId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverPasscode, setDriverPasscode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!driverBadgeId.trim() || !vehicleNo.trim() || !driverPasscode.trim()) {
      setLoginError('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.login({
        role: 'ambulance',
        username: driverBadgeId.trim(),
        vehicleNo: vehicleNo.trim(),
        passcode: driverPasscode.trim(),
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setLoginError(err.message || 'Driver authentication failed. Please check badge ID and passcode.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-xl font-bold text-slate-900">{t.tabAmbulance}</h3>
        <p className="text-sm text-slate-500">
          Emergency response vehicle telemetry, navigation, and stage tracking.
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
          <label htmlFor="driverBadgeInput" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Driver Badge / Officer ID *
          </label>
          <input
            id="driverBadgeInput"
            type="text"
            required
            value={driverBadgeId}
            onChange={(e) => setDriverBadgeId(e.target.value)}
            placeholder="e.g. AMB-108-9192"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-semibold focus:ring-2 focus:ring-blue-500 bg-white min-h-[52px]"
          />
        </div>

        <div>
          <label htmlFor="vehicleNoInput" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Vehicle Registration Number *
          </label>
          <input
            id="vehicleNoInput"
            type="text"
            required
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            placeholder="e.g. MH-02-ER-9192"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-semibold focus:ring-2 focus:ring-blue-500 bg-white min-h-[52px]"
          />
        </div>

        <div>
          <label htmlFor="driverPasscodeInput" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Dispatch Passcode *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="driverPasscodeInput"
              type="password"
              required
              value={driverPasscode}
              onChange={(e) => setDriverPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-semibold focus:ring-2 focus:ring-blue-500 bg-white min-h-[52px]"
            />
          </div>
        </div>

        {import.meta.env.DEV && (
          <details className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900">
            <summary className="font-bold cursor-pointer">Dev demo driver credentials</summary>
            <div className="mt-2 space-y-1 text-[11px]">
              <div>Badge: <code>AMB-108-9192</code></div>
              <div>Vehicle: <code>MH-02-ER-9192</code></div>
              <div>Passcode: <code>9192</code></div>
              <button
                type="button"
                onClick={() => {
                  setDriverBadgeId('AMB-108-9192');
                  setVehicleNo('MH-02-ER-9192');
                  setDriverPasscode('9192');
                }}
                className="text-blue-700 font-bold underline mt-1 block cursor-pointer"
              >
                Auto-fill driver demo
              </button>
            </div>
          </details>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[52px]"
      >
        <Truck className="w-4 h-4" />
        <span>{isSubmitting ? 'Authenticating…' : 'Enter 108 Dispatch Console'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
};
