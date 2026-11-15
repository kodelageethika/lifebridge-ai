import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  Activity,
  Heart,
  Pill,
  Calendar,
  AlertCircle,
  TrendingUp,
  Stethoscope,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const RecoveryTrackerView: React.FC = () => {
  const { recoveryRecords } = useApp();

  const [selectedRecordId, setSelectedRecordId] = useState<string>(() => {
    return recoveryRecords[0]?.id || 'REC-POST-01';
  });

  const activeRecord = recoveryRecords.find(r => r.id === selectedRecordId) || recoveryRecords[0];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[#243B55] dark:text-white">
              Post-Transplant Recovery Tracker
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] text-[#243B55] border border-[#EFE7DE] dark:bg-[#203247] dark:text-white">
              Longitudinal Care
            </span>
          </div>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Longitudinal graft surveillance, biochemical biomarker tracking, and medication adherence monitoring.
          </p>
        </div>

        {/* Patient selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#788394] dark:text-[#94A3B8]">Recipient Record:</label>
          <select
            value={activeRecord.id}
            onChange={(e) => setSelectedRecordId(e.target.value)}
            className="text-xs font-semibold bg-[#FAF6F0] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#203247] rounded-xl px-3 py-1.5 text-[#243B55] dark:text-white outline-none"
          >
            {recoveryRecords.map(r => (
              <option key={r.id} value={r.id}>
                {r.recipientCode} ({r.organType.toUpperCase()} - Day {r.postOpDays})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advisory Banner */}
      <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-center gap-2.5 text-xs text-blue-900 dark:text-blue-200">
        <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
        <span>
          <span className="font-bold">Clinical Advisory Note: </span>
          Recovery analytics are decision-support insights for attending physicians. The system never generates independent clinical diagnoses or prescribes medications.
        </span>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#788394] dark:text-[#94A3B8]">Graft Function</span>
            <Activity size={15} className="text-[#E98F83]" />
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {activeRecord.graftStatus}
          </div>
          <span className="text-[10px] text-[#788394] dark:text-[#94A3B8]">Biochemical profile stable</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#788394] dark:text-[#94A3B8]">Post-Op Timeline</span>
            <Clock size={15} className="text-[#E98F83]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#243B55] dark:text-white tabular-nums">
            Day +{activeRecord.postOpDays}
          </div>
          <span className="text-[10px] text-[#788394] dark:text-[#94A3B8]">Since {activeRecord.transplantDate}</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#788394] dark:text-[#94A3B8]">Med Adherence</span>
            <Pill size={15} className="text-[#E98F83]" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            {activeRecord.medicationAdherencePercent}%
          </div>
          <span className="text-[10px] text-[#788394] dark:text-[#94A3B8]">Immunosuppressive protocol</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-4 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#788394] dark:text-[#94A3B8]">Next Evaluation</span>
            <Calendar size={15} className="text-[#E98F83]" />
          </div>
          <div className="text-lg font-bold text-[#243B55] dark:text-white">
            {activeRecord.nextScheduledDate}
          </div>
          <span className="text-[10px] text-[#788394] dark:text-[#94A3B8]">OPD Follow-up Slot</span>
        </div>
      </div>

      {/* Lab Markers Grid */}
      <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#243B55] dark:text-white flex items-center gap-2">
            <OrganTag organType={activeRecord.organType} size="sm" />
            <span>Organ-Specific Biomarker Panel</span>
          </h3>
          <span className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Last evaluated {activeRecord.lastFollowUpDate}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activeRecord.labs.map(lab => (
            <div
              key={lab.markerName}
              className="p-4 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FDFBF7] dark:bg-[#111A26] space-y-1.5"
            >
              <div className="flex justify-between text-xs text-[#788394] dark:text-[#94A3B8]">
                <span>{lab.markerName}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {lab.status}
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-[#243B55] dark:text-white tabular-nums">
                {lab.value}{' '}
                <span className="text-xs font-normal text-[#788394]">{lab.unit}</span>
              </div>
              <div className="text-[10px] text-[#788394] dark:text-[#94A3B8]">
                Target: {lab.normalRange} {lab.unit}
              </div>
            </div>
          ))}
        </div>

        {/* Attending Clinician Notes */}
        <div className="p-4 rounded-xl bg-[#FAF6F0] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#203247] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E98F83] dark:text-[#FF8A8A]">
            <Stethoscope size={15} />
            <span>Attending Transplant Physician Notes:</span>
          </div>
          <p className="text-xs text-[#546070] dark:text-[#CBD5E1] leading-relaxed">
            "{activeRecord.clinicianNotes}"
          </p>
        </div>
      </div>
    </div>
  );
};
