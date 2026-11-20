import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { RecoveryRecord } from '../../types/index.ts';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  Activity,
  Pill,
  Calendar,
  AlertCircle,
  Stethoscope,
  Clock,
  Save,
} from 'lucide-react';

export const RecoveryTrackerView: React.FC = () => {
  const { recoveryRecords, currentUserRole, updateRecoveryRecord } = useApp();

  const [selectedRecordId, setSelectedRecordId] = useState<string>(() => recoveryRecords[0]?.id || 'REC-POST-01');
  const activeRecord = recoveryRecords.find(r => r.id === selectedRecordId) || recoveryRecords[0];

  const [showEditor, setShowEditor] = useState(false);
  const [graftStatus, setGraftStatus] = useState<RecoveryRecord['graftStatus']>(
    activeRecord?.graftStatus || 'OPTIMAL'
  );
  const [adherence, setAdherence] = useState<string>(
    String(activeRecord?.medicationAdherencePercent ?? 98)
  );
  const [nextDate, setNextDate] = useState<string>(activeRecord?.nextScheduledDate || '2026-12-01');
  const [notes, setNotes] = useState<string>(activeRecord?.clinicianNotes || '');

  const canEdit =
    currentUserRole === 'medical' || currentUserRole === 'coordinator' || currentUserRole === 'admin';

  if (!activeRecord) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
        No post-transplant recovery records available.
      </div>
    );
  }

  const handleOpenEditor = () => {
    setGraftStatus(activeRecord.graftStatus);
    setAdherence(String(activeRecord.medicationAdherencePercent));
    setNextDate(activeRecord.nextScheduledDate);
    setNotes(activeRecord.clinicianNotes);
    setShowEditor(prev => !prev);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateRecoveryRecord(activeRecord.id, {
      graftStatus,
      medicationAdherencePercent: Math.min(100, Math.max(0, parseInt(adherence, 10) || 95)),
      nextScheduledDate: nextDate,
      clinicianNotes: notes,
    });
    setShowEditor(false);
  };

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

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-[#788394] dark:text-[#94A3B8]">Recipient Record:</label>
          <select
            value={activeRecord.id}
            onChange={e => setSelectedRecordId(e.target.value)}
            className="text-xs font-semibold bg-[#FAF6F0] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#203247] rounded-xl px-3 py-1.5 text-[#243B55] dark:text-white outline-none"
          >
            {recoveryRecords.map(r => (
              <option key={r.id} value={r.id}>
                {r.recipientCode} ({r.organType.toUpperCase()} - Day {r.postOpDays})
              </option>
            ))}
          </select>

          {canEdit && (
            <button
              onClick={handleOpenEditor}
              className="px-3.5 py-1.5 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl cursor-pointer"
            >
              {showEditor ? 'Cancel Edit' : 'Update Follow-Up'}
            </button>
          )}
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

      {/* Clinician Edit Panel */}
      {showEditor && canEdit && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#E98F83]/40 space-y-4 text-xs"
        >
          <h3 className="font-bold text-[#243B55] dark:text-white">
            Update Follow-Up Milestone ({activeRecord.recipientCode})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Graft Status</label>
              <select
                value={graftStatus}
                onChange={e => setGraftStatus(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FAF6F0] dark:bg-[#0E1722]"
              >
                <option value="OPTIMAL">OPTIMAL</option>
                <option value="STABLE">STABLE</option>
                <option value="OBSERVATION_REQUIRED">OBSERVATION_REQUIRED</option>
                <option value="ACUTE_MONITORING">ACUTE_MONITORING</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Med Adherence (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={adherence}
                onChange={e => setAdherence(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FAF6F0] dark:bg-[#0E1722]"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={nextDate}
                onChange={e => setNextDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FAF6F0] dark:bg-[#0E1722]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Attending Clinician Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#FAF6F0] dark:bg-[#0E1722]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 font-bold bg-[#243B55] text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={13} />
              <span>Save Clinical Note</span>
            </button>
          </div>
        </form>
      )}

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

      {/* Lab Markers */}
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
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{lab.status}</span>
              </div>
              <div className="text-2xl font-black font-mono text-[#243B55] dark:text-white tabular-nums">
                {lab.value} <span className="text-xs font-normal text-[#788394]">{lab.unit}</span>
              </div>
              <div className="text-[10px] text-[#788394] dark:text-[#94A3B8]">
                Target: {lab.normalRange} {lab.unit}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-[#FAF6F0] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#203247] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E98F83] dark:text-[#FF8A8A]">
            <Stethoscope size={15} />
            <span>Attending Transplant Physician Notes:</span>
          </div>
          <p className="text-xs text-[#546070] dark:text-[#CBD5E1] leading-relaxed">
            &quot;{activeRecord.clinicianNotes}&quot;
          </p>
        </div>
      </div>
    </div>
  );
};
