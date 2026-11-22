import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { OrganTag } from '../common/OrganTag.tsx';
import {
  CaseCoordinationRecord,
  CoordinationRecordStatus,
  Hospital,
  OrganOpportunity,
  OrganType,
} from '../../types/index.ts';
import {
  Building2,
  Plus,
  ClipboardList,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  X,
} from 'lucide-react';

const ALL_ORGANS: OrganType[] = ['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'];
const BLOOD_GROUPS: OrganOpportunity['bloodGroup'][] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export const HospitalReadinessView: React.FC = () => {
  const {
    hospitals,
    donors,
    recipients,
    medicalProfiles,
    organOpportunities,
    coordinationRecords,
    currentUserRole,
    toggleHospitalReadiness,
    registerHospital,
    postOrganOpportunity,
    updateCoordinationRecordStatus,
  } = useApp();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'readiness' | 'opportunities' | 'records' | 'participants'>('readiness');

  // Register Hospital Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [hospName, setHospName] = useState('');
  const [hospCity, setHospCity] = useState('');
  const [hospState, setHospState] = useState('');
  const [hospTier, setHospTier] = useState<Hospital['tier']>('TRANSPLANT_CENTER');
  const [hospLicense, setHospLicense] = useState('');
  const [hospEmail, setHospEmail] = useState('');
  const [hospOrgans, setHospOrgans] = useState<OrganType[]>(['kidney', 'liver']);
  const [registeringHospital, setRegisteringHospital] = useState(false);

  // Post Opportunity Modal
  const [showOppModal, setShowOppModal] = useState(false);
  const [oppHospitalId, setOppHospitalId] = useState('');
  const [oppOrgan, setOppOrgan] = useState<OrganType>('kidney');
  const [oppTitle, setOppTitle] = useState('');
  const [oppBloodGroup, setOppBloodGroup] = useState<OrganOpportunity['bloodGroup']>('O+');
  const [oppTissueHLA, setOppTissueHLA] = useState('A2, A24, B35, B44, DR4, DR11');
  const [oppWindowHours, setOppWindowHours] = useState('24');
  const [oppMinUrgency, setOppMinUrgency] = useState('60');
  const [oppRequirements, setOppRequirements] = useState('');
  const [postingOpp, setPostingOpp] = useState(false);

  // Review Coordination Record Modal
  const [reviewingRecord, setReviewingRecord] = useState<CaseCoordinationRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<
    Extract<CoordinationRecordStatus, 'UNDER_HOSPITAL_REVIEW' | 'APPROVED' | 'REJECTED'>
  >('UNDER_HOSPITAL_REVIEW');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [updatingRecord, setUpdatingRecord] = useState(false);

  const canToggleReadiness =
    currentUserRole === 'hospital' || currentUserRole === 'coordinator' || currentUserRole === 'admin';
  const canManageHospitalOps = canToggleReadiness;

  const myHospital = user?.hospitalId ? hospitals.find(h => h.id === user.hospitalId) : undefined;
  const isHospitalPendingOrRejected =
    currentUserRole === 'hospital' && myHospital && myHospital.registrationStatus !== 'APPROVED';
  const canExecuteApprovedHospitalActions =
    (currentUserRole === 'hospital' && myHospital?.registrationStatus === 'APPROVED') ||
    currentUserRole === 'coordinator' ||
    currentUserRole === 'admin';

  const approvedHospitals = hospitals.filter(h => h.registrationStatus === 'APPROVED');

  const handleRegisterHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospName.trim() || hospOrgans.length === 0) return;
    setRegisteringHospital(true);
    try {
      const created = await registerHospital({
        name: hospName.trim(),
        city: hospCity.trim(),
        state: hospState.trim(),
        tier: hospTier,
        licenseNumber: hospLicense.trim(),
        contactEmail: hospEmail.trim(),
        organsSupported: hospOrgans,
      });
      if (created) {
        setShowRegisterModal(false);
        setHospName('');
        setHospCity('');
        setHospState('');
        setHospLicense('');
        setHospEmail('');
      }
    } finally {
      setRegisteringHospital(false);
    }
  };

  const handlePostOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppTitle.trim() || !oppRequirements.trim()) return;
    setPostingOpp(true);
    try {
      const created = await postOrganOpportunity({
        hospitalId: currentUserRole === 'hospital' ? user?.hospitalId : oppHospitalId || approvedHospitals[0]?.id,
        organType: oppOrgan,
        title: oppTitle.trim(),
        bloodGroup: oppBloodGroup,
        tissueHLA: oppTissueHLA.trim(),
        preservationWindowHours: parseInt(oppWindowHours, 10) || 24,
        minUrgencyScore: oppMinUrgency ? parseInt(oppMinUrgency, 10) : undefined,
        clinicalRequirements: oppRequirements.trim(),
      });
      if (created) {
        setShowOppModal(false);
        setOppTitle('');
        setOppRequirements('');
      }
    } finally {
      setPostingOpp(false);
    }
  };

  const handleUpdateRecordStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRecord) return;
    setUpdatingRecord(true);
    try {
      const ok = await updateCoordinationRecordStatus(reviewingRecord.id, reviewAction, reviewRemarks.trim());
      if (ok) {
        setReviewingRecord(null);
        setReviewRemarks('');
      }
    } finally {
      setUpdatingRecord(false);
    }
  };

  const getRegBadge = (status: Hospital['registrationStatus']) => {
    if (status === 'APPROVED') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (status === 'PENDING_APPROVAL') {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  };

  const getRecordBadge = (status: CoordinationRecordStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'UNDER_HOSPITAL_REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300';
      case 'WITHDRAWN':
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-[#F8E8E3] text-[#E98F83] border-[#E98F83]/30';
    }
  };

  if (hospitals.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
        Hospital readiness data loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[#243B55] dark:text-white">
              Hospital Operations, Readiness & Coordination
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] text-[#243B55] border border-[#EFE7DE] dark:bg-[#203247] dark:text-white">
              OR & ICU Operations
            </span>
          </div>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Manage facility surgical readiness, post organ donation opportunities, and review incoming Case Coordination Records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageHospitalOps && (
            <>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white hover:border-[#E98F83] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Building2 size={13} className="text-[#E98F83]" />
                <span>Register New Hospital</span>
              </button>
              <button
                disabled={!canExecuteApprovedHospitalActions}
                onClick={() => {
                  setOppHospitalId(myHospital?.id || approvedHospitals[0]?.id || '');
                  setShowOppModal(true);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={13} />
                <span>Post Organ Opportunity</span>
              </button>
            </>
          )}

          {!canToggleReadiness && (
            <span className="text-[11px] text-[#788394] bg-[#F8F5EF] dark:bg-[#111A26] px-3 py-1.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52]">
              Read-only view (Hospital / Coordinator role required)
            </span>
          )}
        </div>
      </div>

      {/* Unapproved Hospital Warning Banner */}
      {isHospitalPendingOrRejected && myHospital && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-900 dark:text-amber-200">
              Facility "{myHospital.name}" Status: {myHospital.registrationStatus.replace(/_/g, ' ')}
            </div>
            <p className="text-amber-800 dark:text-amber-300 mt-0.5">
              Posting organ donation opportunities, inspecting registered participants, and updating Case Coordination Records are locked until a Platform Administrator approves your hospital registration.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs">
        {[
          { id: 'readiness', label: `Facility Readiness (${hospitals.length})`, icon: <Building2 size={14} /> },
          { id: 'opportunities', label: `Organ Opportunities (${organOpportunities.length})`, icon: <ClipboardList size={14} /> },
          { id: 'records', label: `Coordination Records (${coordinationRecords.length})`, icon: <FileText size={14} /> },
          { id: 'participants', label: `Registered Participants & PDFs (${medicalProfiles.length})`, icon: <Users size={14} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#243B55] text-white shadow-xs'
                : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: FACILITY READINESS */}
      {activeTab === 'readiness' && (
        <div className="space-y-4">
          {hospitals.map(hospital => (
            <div
              key={hospital.id}
              className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFE7DE] dark:border-[#203247]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 size={16} className="text-[#E98F83]" />
                    <h3 className="text-base font-bold text-[#243B55] dark:text-white">{hospital.name}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FAF6F0] dark:bg-[#1E2E40] text-[#E98F83] dark:text-[#FF8A8A]">
                      {hospital.tier.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRegBadge(
                        hospital.registrationStatus || 'APPROVED'
                      )}`}
                    >
                      {(hospital.registrationStatus || 'APPROVED').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-[#788394] dark:text-[#94A3B8]">
                    {hospital.city}, {hospital.state} · Facility ID: {hospital.id}
                    {hospital.licenseNumber ? ` · License: ${hospital.licenseNumber}` : ''}
                  </span>
                </div>
              </div>

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
                        disabled={!canToggleReadiness}
                        onClick={() => toggleHospitalReadiness(hospital.id, cap.organType)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                          canToggleReadiness ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                        } ${
                          cap.isReady
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-rose-100 hover:text-rose-800'
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 hover:bg-emerald-100 hover:text-emerald-800'
                        }`}
                        title={
                          canToggleReadiness
                            ? 'Click to toggle facility readiness status'
                            : 'Hospital / Coordinator authorization required'
                        }
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
                        Verified:{' '}
                        {new Date(cap.lastVerifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: ORGAN OPPORTUNITIES */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {organOpportunities.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
              No organ donation opportunities posted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {organOpportunities.map(opp => (
                <div
                  key={opp.id}
                  className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <OrganTag organType={opp.organType} size="sm" />
                      <span className="text-xs font-bold font-mono text-[#243B55] dark:text-white">{opp.id}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        opp.status === 'OPEN'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {opp.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-[#243B55] dark:text-white">{opp.title}</h3>
                    <p className="text-[11px] text-[#788394] mt-0.5">{opp.hospitalName}</p>
                  </div>

                  <p className="text-xs text-[#546070] dark:text-[#CBD5E1] leading-relaxed">
                    {opp.clinicalRequirements}
                  </p>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-[11px]">
                    <div>
                      <span className="text-[#788394] block">Blood Group</span>
                      <span className="font-bold text-[#243B55] dark:text-white">{opp.bloodGroup}</span>
                    </div>
                    <div>
                      <span className="text-[#788394] block">Preservation</span>
                      <span className="font-bold text-[#243B55] dark:text-white">{opp.preservationWindowHours}h</span>
                    </div>
                    <div>
                      <span className="text-[#788394] block">Min Urgency</span>
                      <span className="font-bold text-[#243B55] dark:text-white">{opp.minUrgencyScore ?? 'Any'}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#788394]">
                    <span className="font-semibold">Target HLA:</span> <span className="font-mono">{opp.tissueHLA}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INCOMING CASE COORDINATION RECORDS */}
      {activeTab === 'records' && (
        <div className="space-y-3">
          {coordinationRecords.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
              No Case Coordination Records have been submitted yet.
            </div>
          ) : (
            coordinationRecords.map(rec => {
              const isFinalOrWithdrawn =
                rec.status === 'WITHDRAWN' || rec.status === 'APPROVED' || rec.status === 'REJECTED';
              return (
                <div
                  key={rec.id}
                  className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <OrganTag organType={rec.organType} size="sm" />
                        <span className="text-xs font-bold font-mono text-[#243B55] dark:text-white">
                          {rec.recordNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRecordBadge(rec.status)}`}>
                          {rec.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[#E98F83]">
                          Match {rec.compatibilityScore}/100
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#243B55] dark:text-white">{rec.opportunityTitle}</h3>
                      <p className="text-xs text-[#788394]">
                        Applicant: <strong className="text-[#243B55] dark:text-white">{rec.applicantName}</strong> ({rec.applicantRole}
                        {rec.applicantCode ? ` · ${rec.applicantCode}` : ''}) · {rec.hospitalName}
                      </p>
                    </div>

                    {canExecuteApprovedHospitalActions && !isFinalOrWithdrawn && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setReviewingRecord(rec);
                            setReviewAction('UNDER_HOSPITAL_REVIEW');
                            setReviewRemarks('');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                        >
                          <Clock size={12} />
                          <span>Under Review</span>
                        </button>
                        <button
                          onClick={() => {
                            setReviewingRecord(rec);
                            setReviewAction('APPROVED');
                            setReviewRemarks('');
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 size={12} />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => {
                            setReviewingRecord(rec);
                            setReviewAction('REJECTED');
                            setReviewRemarks('');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle size={12} />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-xs space-y-1">
                    <div className="text-[#546070] dark:text-[#CBD5E1]">{rec.compatibilitySummary}</div>
                    <div className="text-[#788394]">
                      <strong className="text-[#243B55] dark:text-white">Applicant Notes:</strong> {rec.notes}
                    </div>
                    {rec.hospitalRemarks && (
                      <div className="text-[#788394]">
                        <strong className="text-[#243B55] dark:text-white">Hospital Remarks:</strong> {rec.hospitalRemarks}
                      </div>
                    )}
                    {rec.withdrawnReason && (
                      <div className="text-rose-600 dark:text-rose-400">
                        <strong>Withdrawal Reason:</strong> {rec.withdrawnReason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: REGISTERED PARTICIPANTS & PDF MEDICAL PROFILES */}
      {activeTab === 'participants' && (
        <div className="space-y-6">
          {isHospitalPendingOrRejected ? (
            <div className="p-6 bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs text-[#788394]">
              Participant records and extracted PDF medical profiles require Administrator approval for your facility.
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
                <h2 className="text-sm font-bold text-[#243B55] dark:text-white">
                  Uploaded Medical Profile PDFs ({medicalProfiles.length})
                </h2>
                {medicalProfiles.length === 0 ? (
                  <p className="text-xs text-[#788394]">
                    No donor or recipient PDF medical profiles have been uploaded yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {medicalProfiles.map(mp => (
                      <div
                        key={mp.id}
                        className="p-4 rounded-xl bg-[#F8F5EF] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#243B55] dark:text-white truncate">{mp.fileName}</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#F8E8E3] text-[#E98F83]">
                            {mp.ownerRole}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {mp.compatibility.bloodGroup && (
                            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] font-semibold">
                              Blood: {mp.compatibility.bloodGroup}
                            </span>
                          )}
                          {mp.compatibility.organType && (
                            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] font-semibold capitalize">
                              Organ: {mp.compatibility.organType}
                            </span>
                          )}
                          {mp.compatibility.tissueHLA && (
                            <span className="px-2 py-0.5 rounded bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] font-mono">
                              HLA: {mp.compatibility.tissueHLA}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#788394] line-clamp-3">{mp.extractedText}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
                  <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
                    Registered Donors ({donors.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {donors.map(d => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold font-mono text-[#243B55] dark:text-white">{d.anonymizedCode}</div>
                          <div className="text-[11px] text-[#788394]">
                            {d.bloodGroup} · Age {d.age} · {d.hospitalName}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            d.isWithdrawn
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {d.isWithdrawn ? 'WITHDRAWN' : 'ACTIVE'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
                  <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
                    Registered Recipients ({recipients.length})
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {recipients.map(r => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold font-mono text-[#243B55] dark:text-white">{r.anonymizedCode}</div>
                          <div className="text-[11px] text-[#788394]">
                            {r.organType.toUpperCase()} · {r.bloodGroup} · Urgency {r.urgencyScore}/100 · {r.hospitalName}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F8E8E3] text-[#E98F83]">
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL: REGISTER NEW HOSPITAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">Register Hospital Facility</h3>
              <button onClick={() => setShowRegisterModal(false)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRegisterHospital} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Hospital Name</label>
                <input
                  type="text"
                  required
                  value={hospName}
                  onChange={e => setHospName(e.target.value)}
                  placeholder="e.g. Rainbow Multi-Organ Center"
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={hospCity}
                    onChange={e => setHospCity(e.target.value)}
                    placeholder="Hyderabad"
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={hospState}
                    onChange={e => setHospState(e.target.value)}
                    placeholder="Telangana"
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Facility Tier</label>
                  <select
                    value={hospTier}
                    onChange={e => setHospTier(e.target.value as Hospital['tier'])}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    <option value="TRANSPLANT_CENTER">Transplant Center</option>
                    <option value="TIER_1_TRAUMA">Tier 1 Trauma</option>
                    <option value="REGIONAL_HOSPITAL">Regional Hospital</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Accreditation License</label>
                  <input
                    type="text"
                    required
                    value={hospLicense}
                    onChange={e => setHospLicense(e.target.value)}
                    placeholder="TS-THOTA-2026-102"
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={hospEmail}
                  onChange={e => setHospEmail(e.target.value)}
                  placeholder="transplant@hospital.org"
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Supported Organ Programs</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALL_ORGANS.map(org => {
                    const selected = hospOrgans.includes(org);
                    return (
                      <button
                        type="button"
                        key={org}
                        onClick={() =>
                          setHospOrgans(prev => (prev.includes(org) ? prev.filter(o => o !== org) : [...prev, org]))
                        }
                        className={`p-1.5 rounded-lg border capitalize cursor-pointer ${
                          selected
                            ? 'bg-[#F8E8E3] border-[#E98F83] text-[#E98F83] font-bold'
                            : 'bg-[#F8F5EF] dark:bg-[#0E1722] border-[#EFE7DE] dark:border-[#273A52] text-[#788394]'
                        }`}
                      >
                        {org}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="px-3 py-1.5 text-[#788394] cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registeringHospital}
                  className="px-4 py-2 bg-[#E98F83] text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {registeringHospital ? 'Submitting...' : 'Submit for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POST ORGAN OPPORTUNITY */}
      {showOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">Post Organ Donation Opportunity</h3>
              <button onClick={() => setShowOppModal(false)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePostOpportunity} className="space-y-3">
              {currentUserRole !== 'hospital' && (
                <div>
                  <label className="block font-semibold mb-1">Approved Hospital</label>
                  <select
                    value={oppHospitalId}
                    onChange={e => setOppHospitalId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    {approvedHospitals.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Opportunity Title</label>
                <input
                  type="text"
                  required
                  value={oppTitle}
                  onChange={e => setOppTitle(e.target.value)}
                  placeholder="e.g. O+ Living/Deceased Kidney Allocation Slot"
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Organ Type</label>
                  <select
                    value={oppOrgan}
                    onChange={e => setOppOrgan(e.target.value as OrganType)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] capitalize"
                  >
                    {ALL_ORGANS.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Target Blood Group</label>
                  <select
                    value={oppBloodGroup}
                    onChange={e => setOppBloodGroup(e.target.value as OrganOpportunity['bloodGroup'])}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  >
                    {BLOOD_GROUPS.map(bg => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Preservation Window (hrs)</label>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={oppWindowHours}
                    onChange={e => setOppWindowHours(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Min Urgency Score</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={oppMinUrgency}
                    onChange={e => setOppMinUrgency(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Target HLA Typing</label>
                <input
                  type="text"
                  required
                  value={oppTissueHLA}
                  onChange={e => setOppTissueHLA(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Clinical Requirements</label>
                <textarea
                  rows={3}
                  required
                  value={oppRequirements}
                  onChange={e => setOppRequirements(e.target.value)}
                  placeholder="Describe crossmatch, cold ischemia corridor, and clinical eligibility criteria..."
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowOppModal(false)} className="px-3 py-1.5 text-[#788394] cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingOpp}
                  className="px-4 py-2 bg-[#E98F83] text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {postingOpp ? 'Publishing...' : 'Publish Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE COORDINATION RECORD STATUS */}
      {reviewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#243B55] dark:text-white">
                Update Case Coordination Record ({reviewingRecord.recordNumber})
              </h3>
              <button onClick={() => setReviewingRecord(null)} className="p-1 text-[#788394] cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateRecordStatus} className="space-y-3">
              <div className="p-3 rounded-xl bg-[#F8F5EF] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52]">
                <div className="font-bold text-[#243B55] dark:text-white">{reviewingRecord.opportunityTitle}</div>
                <div className="text-[#788394] mt-0.5">
                  Applicant: {reviewingRecord.applicantName} · Score: {reviewingRecord.compatibilityScore}/100
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Decision Status</label>
                <select
                  value={reviewAction}
                  onChange={e =>
                    setReviewAction(
                      e.target.value as Extract<
                        CoordinationRecordStatus,
                        'UNDER_HOSPITAL_REVIEW' | 'APPROVED' | 'REJECTED'
                      >
                    )
                  }
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                >
                  <option value="UNDER_HOSPITAL_REVIEW">Mark Under Hospital Review</option>
                  <option value="APPROVED">Approve Case Coordination Record</option>
                  <option value="REJECTED">Reject Case Coordination Record</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Hospital Remarks (Optional)</label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={e => setReviewRemarks(e.target.value)}
                  placeholder="Enter clinical crossmatch verification note or decision rationale..."
                  className="w-full p-2.5 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReviewingRecord(null)} className="px-3 py-1.5 text-[#788394] cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRecord}
                  className="px-4 py-2 bg-[#243B55] text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {updatingRecord ? 'Saving...' : 'Confirm Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
