import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import { OrganType } from '../../types/index.ts';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

export const HospitalReadinessView: React.FC = () => {
  const { hospitals, toggleHospitalReadiness } = useApp();

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[#243B55] dark:text-white">
              Hospital Capability & Surgical Readiness
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] text-[#243B55] border border-[#EFE7DE] dark:bg-[#203247] dark:text-white">
              OR & ICU Operations
            </span>
          </div>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Real-time facility readiness, dedicated surgical teams, and ICU bed availability verification.
          </p>
        </div>
      </div>

      {/* Hospital Cards Grid */}
      <div className="space-y-4">
        {hospitals.map(hospital => (
          <div
            key={hospital.id}
            className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFE7DE] dark:border-[#203247]">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[#E98F83]" />
                  <h3 className="text-base font-bold text-[#243B55] dark:text-white">
                    {hospital.name}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FAF6F0] dark:bg-[#1E2E40] text-[#E98F83] dark:text-[#FF8A8A]">
                    {hospital.tier.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-[#788394] dark:text-[#94A3B8]">
                  {hospital.city}, {hospital.state} · Facility ID: {hospital.id}
                </span>
              </div>
            </div>

            {/* Organ Capabilities Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {hospital.capabilities.map(cap => (
                <div
                  key={cap.organType}
                  className={`p-3.5 rounded-xl border transition-all ${
                    cap.isReady
                      ? 'bg-[#FDFBF7] dark:bg-[#111A26] border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-slate-50 dark:bg-[#0E1520] border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <OrganTag organType={cap.organType} size="sm" />
                    <button
                      onClick={() => toggleHospitalReadiness(hospital.id, cap.organType)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                        cap.isReady
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-rose-100 hover:text-rose-800'
                          : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 hover:bg-emerald-100 hover:text-emerald-800'
                      }`}
                      title="Click to toggle facility readiness status"
                    >
                      {cap.isReady ? 'ACTIVE & READY' : 'ON HOLD / DIVERT'}
                    </button>
                  </div>

                  <div className="text-[11px] text-[#546070] dark:text-[#94A3B8] space-y-1">
                    <div>
                      <span className="text-[#788394]">Surgical Team: </span>
                      <span className="font-semibold text-[#243B55] dark:text-white truncate block">
                        {cap.activeSurgicalTeam}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>ICU Bed Availability:</span>
                      <span className={`font-semibold ${cap.icuBedAvailable ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {cap.icuBedAvailable ? 'Reserved' : 'Full / Diverted'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#A0AEC0] pt-1">
                      Verified: {new Date(cap.lastVerifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
