import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  Truck,
  Clock,
  MapPin,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Flame,
  Info
} from 'lucide-react';

export const LogisticsMonitoringView: React.FC = () => {
  const {
    logisticsCases,
    recordCustodyHandover,
    triggerEmergencyEscalation,
    setActiveView,
  } = useApp();

  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => {
    return logisticsCases[0]?.id || 'LOG-K704';
  });

  // Drawer for Level 2 / 3 Transport Details
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [newCustodian, setNewCustodian] = useState('');
  const [handoverTemp, setHandoverTemp] = useState('3.9');
  const [handoverNotes, setHandoverNotes] = useState('');

  const activeCase = logisticsCases.find(l => l.id === selectedCaseId) || logisticsCases[0];

  const handleHandoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustodian.trim()) return;
    recordCustodyHandover(
      activeCase.caseId,
      newCustodian,
      'Transfer to Hospital Surgical Suite',
      parseFloat(handoverTemp) || 4.0,
      handoverNotes || 'Handover verified and signed'
    );
    setShowHandoverModal(false);
    setNewCustodian('');
    setHandoverNotes('');
  };

  const timelineSteps = [
    { label: 'Retrieval completed', done: true },
    { label: 'Transport started', done: true },
    { label: activeCase.status === 'DELAYED' ? 'Delay detected' : 'On the way', done: true, isAlert: activeCase.status === 'DELAYED' },
    { label: 'Hospital received organ', done: activeCase.status === 'DELIVERED' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      
      {/* 1. CLEAN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B55] dark:text-white">
            Organ Tracking
          </h1>
          <p className="text-sm text-[#788394] dark:text-[#94A3B8] mt-1">
            Real-time preservation status and route progress monitoring.
          </p>
        </div>

        {/* Case selector buttons */}
        <div className="flex items-center gap-2">
          {logisticsCases.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCaseId(c.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                activeCase.id === c.id
                  ? 'bg-white dark:bg-[#1E2E40] border-[#E98F83] text-[#E98F83] shadow-xs font-bold'
                  : 'bg-white dark:bg-[#152232] border-[#EFE7DE] dark:border-[#273A52] text-[#788394] hover:text-[#243B55]'
              }`}
            >
              {c.organType.toUpperCase()} ({c.organId}) {c.status === 'DELAYED' && '⚠️'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. OVERVIEW CARD (Clean & Human-Centered) */}
      <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EFE7DE] dark:border-[#273A52]">
          <div className="flex items-center gap-3">
            <OrganTag organType={activeCase.organType} size="md" />
            <div>
              <span className="text-sm font-bold font-mono text-[#243B55] dark:text-white">
                {activeCase.organId} · Case {activeCase.caseId}
              </span>
              <span className="text-xs text-[#788394] block mt-0.5">
                Current Custodian: <span className="font-semibold text-[#243B55] dark:text-white">{activeCase.currentCustodian}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              activeCase.status === 'DELAYED'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {activeCase.status === 'DELAYED' ? 'Route Delay Detected' : 'In Transit'}
            </span>
          </div>
        </div>

        {/* Route Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] space-y-1">
            <span className="text-[#788394] block flex items-center gap-1">
              <MapPin size={13} className="text-[#E98F83]" />
              Origin Hospital
            </span>
            <span className="font-bold text-[#243B55] dark:text-white">{activeCase.originHospital}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] space-y-1">
            <span className="text-[#788394] block flex items-center gap-1">
              <MapPin size={13} className="text-[#A9BBA8]" />
              Destination Hospital
            </span>
            <span className="font-bold text-[#243B55] dark:text-white">{activeCase.destinationHospital}</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] space-y-1">
            <span className="text-[#788394] block flex items-center gap-1">
              <Clock size={13} className="text-[#E98F83]" />
              Estimated Arrival
            </span>
            <span className="font-bold font-mono text-[#243B55] dark:text-white text-sm">
              {new Date(activeCase.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({activeCase.distanceKm} km)
            </span>
          </div>
        </div>

        {/* 3. VISUAL PROGRESS TIMELINE */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#788394] dark:text-[#94A3B8] block">
            Progress Timeline
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {timelineSteps.map((step, idx) => (
              <div
                key={step.label}
                className={`p-3 rounded-2xl border text-center space-y-1 ${
                  step.isAlert
                    ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/60 dark:border-rose-800'
                    : step.done
                    ? 'bg-[#F8E8E3] border-[#E98F83] text-[#243B55] dark:bg-[#2C1C1A] dark:text-white'
                    : 'bg-[#F8F5EF] border-[#EFE7DE] text-[#788394] dark:bg-[#111A26] dark:border-[#273A52]'
                }`}
              >
                <div className="text-[10px] font-bold opacity-75">Step 0{idx + 1}</div>
                <div className="text-xs font-bold truncate">{step.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Preservation Timer (Clearly Illustrative) */}
        <div className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#243B55] dark:text-white block">
              Cold Ischemia Time Monitor (Illustrative Demo)
            </span>
            <p className="text-[11px] text-[#788394] mt-0.5 leading-relaxed">
              Clinical viability must be assessed by authorized clinicians. Timers do not decide viability.
            </p>
          </div>

          <div className="text-right sm:shrink-0">
            <span className="text-xl font-bold font-mono text-[#E98F83] tabular-nums">
              {activeCase.organType === 'heart' ? '03h 25m' : '23h 48m'}
            </span>
            <span className="text-[10px] text-[#788394] block">Preservation window</span>
          </div>
        </div>

        {/* Actions Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            onClick={() => triggerEmergencyEscalation(activeCase.id, 'Traffic delay detected on transit corridor')}
            className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
          >
            Simulate Delay Alert
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHandoverModal(true)}
              className="px-4 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#EFE7DE] rounded-xl transition-colors cursor-pointer"
            >
              Record Custody Handover
            </button>

            <button
              onClick={() => setShowDetailsDrawer(true)}
              className="px-4 py-2 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>View Transport Details</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* LEVEL 2 & 3: DETAIL DRAWER (Custody history, Temperature, Signatures) */}
      {showDetailsDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#152232] border-l border-[#EFE7DE] dark:border-[#273A52] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            
            <div className="p-5 border-b border-[#EFE7DE] dark:border-[#273A52] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E98F83]">
                  Level 2 & 3 Logistics History
                </span>
                <h3 className="text-lg font-bold text-[#243B55] dark:text-white">
                  Transport Telemetry: {activeCase.organId}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailsDrawer(false)}
                className="p-2 rounded-xl text-[#788394] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Custody Handovers Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                  Verifiable Chain of Custody
                </h4>

                <div className="space-y-3">
                  {activeCase.custodyHistory.map((custody) => (
                    <div
                      key={custody.id}
                      className="p-4 rounded-2xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-bold text-[#243B55] dark:text-white">
                        <span>{custody.stageName}</span>
                        <span className="font-mono text-[10px] text-[#788394]">
                          {new Date(custody.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[#788394]">
                        Custodian: <span className="font-semibold text-[#243B55] dark:text-white">{custody.custodianName}</span> ({custody.organization})
                      </div>
                      <div className="flex items-center gap-3 text-[11px] pt-1">
                        <span className="font-mono text-[#E98F83] font-bold">
                          {custody.tempCelsius}°C
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Condition: {custody.conditionAssessment}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#788394] italic pt-1">
                        "{custody.notes}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Log */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#243B55] dark:text-white">
                  Transport History
                </h4>

                <div className="space-y-2 text-xs">
                  {activeCase.logisticsEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-white dark:bg-[#152232] flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-semibold text-[#243B55] dark:text-white block">
                          {ev.message}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#788394] shrink-0">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#EFE7DE] dark:border-[#273A52] flex justify-end">
              <button
                onClick={() => setShowDetailsDrawer(false)}
                className="px-5 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white rounded-xl cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD CUSTODY HANDOVER MODAL */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">
              Record Custody Handover
            </h3>

            <form onSubmit={handleHandoverSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Receiving Custodian Name:
                </label>
                <input
                  type="text"
                  required
                  value={newCustodian}
                  onChange={(e) => setNewCustodian(e.target.value)}
                  placeholder="e.g. Sister Mercy / Lead Nurse OT 4"
                  className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Container Temperature (°C):
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={handoverTemp}
                  onChange={(e) => setHandoverTemp(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Notes / Observations:
                </label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Box seal intact, cold perfusion active..."
                  className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-3.5 py-1.5 text-xs text-[#788394] hover:text-[#243B55] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Sign & Save Handover
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
