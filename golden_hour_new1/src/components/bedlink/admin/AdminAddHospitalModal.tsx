import React, { useState } from 'react';
import { Building2, X } from 'lucide-react';
import { Hospital } from '../../../types/bedlink';
import { WESTERN_LINE_STATIONS } from '../../../data/stations';

interface AdminAddHospitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHospital: (hospital: Hospital) => void;
}

export const AdminAddHospitalModal: React.FC<AdminAddHospitalModalProps> = ({
  isOpen,
  onClose,
  onAddHospital,
}) => {
  const [newHospName, setNewHospName] = useState('');
  const [newHospZone, setNewHospZone] = useState('Bandra - Khar');
  const [newHospStation, setNewHospStation] = useState('Bandra Station');
  const [newHospAddress, setNewHospAddress] = useState('');
  const [newHospDistance, setNewHospDistance] = useState('1.5');
  const [newHospLat, setNewHospLat] = useState('19.0544');
  const [newHospLng, setNewHospLng] = useState('72.8402');
  const [newHospPhone, setNewHospPhone] = useState('+91 22 2600 0000');
  const [newHospIcu, setNewHospIcu] = useState(8);
  const [newHospTrauma, setNewHospTrauma] = useState(6);
  const [newHospIsGovt, setNewHospIsGovt] = useState(false);
  const [newHospAcceptsIns, setNewHospAcceptsIns] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospName.trim()) return;

    const matchedStation = WESTERN_LINE_STATIONS.find((s) => s.name === newHospStation);
    const slug = newHospName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);

    const newH: Hospital = {
      id: `hosp-${slug || 'custom'}-${Date.now()}`,
      name: newHospName.trim(),
      zone: newHospZone,
      nearestStationId: matchedStation ? matchedStation.id : 'bandra',
      stationVicinity: `Near ${newHospStation}`,
      address: newHospAddress.trim() || `${newHospStation} Corridor`,
      distanceKm: parseFloat(newHospDistance) || 1.5,
      lat: parseFloat(newHospLat) || 19.0544,
      lng: parseFloat(newHospLng) || 72.8402,
      phone: newHospPhone,
      isGovernment: newHospIsGovt,
      has24x7Emergency: true,
      beds: {
        icu: Number(newHospIcu) || 0,
        trauma: Number(newHospTrauma) || 0,
        vent: 4,
        oxygen: 14,
        burns: 2,
        general: 25,
      },
      bloodStock: { 'O+': 15, 'A+': 10, 'B+': 10, 'AB+': 4 },
      specialists: ['Dr. Emergency Medical Officer', 'Dr. On-Duty Surgeon'],
      cashlessPMJAY: newHospAcceptsIns,
      acceptsInsurance: newHospAcceptsIns,
      insuranceProviders: newHospAcceptsIns ? ['PM-JAY Ayushman', 'Star Health', 'HDFC ERGO'] : ['Cash Billing'],
      capacityPercent: 50,
      freshMinutesAgo: 1,
      imageUrl: '',
    };

    onAddHospital(newH);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="addHospTitle"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 id="addHospTitle" className="font-black text-slate-900 text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-600" />
            <span>Register Facility into SQLite DB</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer min-h-[36px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="modalHospName" className="font-bold text-slate-700 block mb-1">
              Hospital Name *
            </label>
            <input
              id="modalHospName"
              type="text"
              required
              placeholder="e.g. Nanavati Max Super Speciality Hospital"
              value={newHospName}
              onChange={(e) => setNewHospName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold min-h-[40px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="modalHospZone" className="font-bold text-slate-700 block mb-1">Zone</label>
              <select
                id="modalHospZone"
                value={newHospZone}
                onChange={(e) => setNewHospZone(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="South Mumbai">South Mumbai</option>
                <option value="Mumbai Central - Parel">Mumbai Central - Parel</option>
                <option value="Dadar - Mahim">Dadar - Mahim</option>
                <option value="Bandra - Khar">Bandra - Khar</option>
                <option value="Santacruz - Vile Parle">Santacruz - Vile Parle</option>
                <option value="Andheri - Jogeshwari">Andheri - Jogeshwari</option>
                <option value="Goregaon - Malad">Goregaon - Malad</option>
                <option value="Kandivali - Borivali - Dahisar">Kandivali - Borivali - Dahisar</option>
                <option value="Mira Road - Bhayandar">Mira Road - Bhayandar</option>
                <option value="Vasai - Nallasopara - Virar">Vasai - Nallasopara - Virar</option>
              </select>
            </div>
            <div>
              <label htmlFor="modalHospStation" className="font-bold text-slate-700 block mb-1">Nearest Station</label>
              <select
                id="modalHospStation"
                value={newHospStation}
                onChange={(e) => setNewHospStation(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 bg-white"
              >
                {WESTERN_LINE_STATIONS.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="modalHospAddress" className="font-bold text-slate-700 block mb-1">Full Street Address</label>
            <input
              id="modalHospAddress"
              type="text"
              placeholder="e.g. SV Road, Bandra West"
              value={newHospAddress}
              onChange={(e) => setNewHospAddress(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 min-h-[40px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="modalHospLat" className="font-bold text-slate-700 block mb-1">Latitude</label>
              <input
                id="modalHospLat"
                type="number"
                step="0.0001"
                value={newHospLat}
                onChange={(e) => setNewHospLat(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="modalHospLng" className="font-bold text-slate-700 block mb-1">Longitude</label>
              <input
                id="modalHospLng"
                type="number"
                step="0.0001"
                value={newHospLng}
                onChange={(e) => setNewHospLng(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modalHospPhone" className="font-bold text-slate-700 block mb-1">Emergency Desk Phone</label>
            <input
              id="modalHospPhone"
              type="text"
              value={newHospPhone}
              onChange={(e) => setNewHospPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 min-h-[40px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="modalHospIcu" className="font-bold text-slate-700 block mb-1">Initial ICU Beds</label>
              <input
                id="modalHospIcu"
                type="number"
                value={newHospIcu}
                onChange={(e) => setNewHospIcu(Number(e.target.value))}
                className="w-full p-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="modalHospTrauma" className="font-bold text-slate-700 block mb-1">Initial Trauma Bays</label>
              <input
                id="modalHospTrauma"
                type="number"
                value={newHospTrauma}
                onChange={(e) => setNewHospTrauma(Number(e.target.value))}
                className="w-full p-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 min-h-[36px]">
              <input
                type="checkbox"
                checked={newHospIsGovt}
                onChange={(e) => setNewHospIsGovt(e.target.checked)}
                className="rounded text-rose-600 w-4 h-4"
              />
              <span>Government / Municipal Hospital (BMC / State)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 min-h-[36px]">
              <input
                type="checkbox"
                checked={newHospAcceptsIns}
                onChange={(e) => setNewHospAcceptsIns(e.target.checked)}
                className="rounded text-rose-600 w-4 h-4"
              />
              <span>Cashless Insurance &amp; PM-JAY Empaneled</span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer min-h-[44px]"
            >
              Insert Hospital Row
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
