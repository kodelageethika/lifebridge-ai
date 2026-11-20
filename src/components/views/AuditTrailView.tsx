import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { AuditEvent, VerificationResult } from '../../types/index.ts';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  Sliders,
  Download,
  CheckCircle2,
  Search,
} from 'lucide-react';

export const AuditTrailView: React.FC = () => {
  const {
    auditTrail,
    currentUserRole,
    tamperAuditEvent,
    restoreAuditTrail,
    verifyAuditOnServer,
    filterAuditEvents,
  } = useApp();

  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<AuditEvent[] | null>(null);

  const displayedEvents = filteredEvents ?? auditTrail;
  const isAdmin = currentUserRole === 'admin';

  const handleVerify = async () => {
    setIsVerifying(true);
    const result = await verifyAuditOnServer();
    if (result) {
      setVerificationResult(result);
    }
    setIsVerifying(false);
  };

  const handleApplyFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && !roleFilter) {
      setFilteredEvents(null);
      return;
    }
    const items = await filterAuditEvents({
      query: searchQuery.trim() || undefined,
      actorRole: roleFilter || undefined,
    });
    setFilteredEvents(items);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(displayedEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `lifebridge_audit_trail_anchor_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-[#243B55] dark:text-white">
              Cryptographic Audit Ledger
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] text-[#243B55] border border-[#EFE7DE] dark:bg-[#203247] dark:text-white">
              SHA-256 + Server HMAC
            </span>
          </div>
          <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
            Sequential hash chaining with server-only HMAC-SHA256 anchoring and instant broken-link localization.
          </p>
        </div>

        {/* Verification & Admin Tamper Demo Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => tamperAuditEvent(5)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Inject bit-flip into Block #5 on server to test tamper detection"
              >
                <Sliders size={14} />
                <span>Simulate Tamper on Block #5</span>
              </button>

              <button
                onClick={restoreAuditTrail}
                className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#1E2E40] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white rounded-xl hover:bg-[#FAF6F0] dark:hover:bg-[#25394E] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reset Chain</span>
              </button>
            </>
          )}

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="px-4 py-1.5 text-xs font-bold bg-[#E98F83] hover:bg-[#D97D71] text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <ShieldCheck size={14} />
            <span>{isVerifying ? 'Verifying on Server...' : 'Verify Audit Integrity'}</span>
          </button>

          <button
            onClick={handleExportJson}
            className="p-2 text-xs text-[#788394] dark:text-[#A0AEC0] hover:text-[#243B55] dark:hover:text-white bg-white dark:bg-[#1A2636] border border-[#EFE7DE] dark:border-[#273A52] rounded-xl transition-colors cursor-pointer"
            title="Export Signed Anchor JSON"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleApplyFilter}
        className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#152232] p-3.5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] text-xs"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-[#788394]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search event type, entity ID, or summary..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FAF6F0] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white outline-none"
          />
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] dark:bg-[#0E1722] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white outline-none"
        >
          <option value="">All Roles</option>
          <option value="coordinator">Coordinator</option>
          <option value="medical">Medical</option>
          <option value="hospital">Hospital</option>
          <option value="donor">Donor</option>
          <option value="admin">Admin</option>
        </select>

        <button
          type="submit"
          className="px-3.5 py-1.5 font-semibold bg-[#243B55] text-white rounded-xl cursor-pointer"
        >
          Filter
        </button>

        {filteredEvents !== null && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('');
              setFilteredEvents(null);
            }}
            className="px-3 py-1.5 text-[#788394] hover:text-[#243B55] cursor-pointer"
          >
            Clear
          </button>
        )}
      </form>

      {/* Verification Output Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-2xl border transition-all ${
            verificationResult.isValid
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.isValid ? (
              <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert size={22} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1">
              <h3 className="text-sm font-bold">
                {verificationResult.isValid
                  ? `Cryptographic Audit Trail Intact (${verificationResult.totalVerified} / ${verificationResult.totalVerified} Events Verified)`
                  : `INTEGRITY COMPROMISED: Tamper Detected at Event #${verificationResult.brokenIndex}!`}
              </h3>
              <p className="text-xs leading-relaxed">
                {verificationResult.isValid
                  ? 'All sequential SHA-256 hashes, previous hash predecessors, and server HMAC-SHA256 signatures verified cleanly.'
                  : verificationResult.failureReason}
              </p>
              {!verificationResult.isValid && verificationResult.expectedHash && (
                <div className="mt-2 text-[10px] font-mono bg-white/80 dark:bg-[#111A26] p-2.5 rounded-lg border border-rose-300 dark:border-rose-800 space-y-1">
                  <div>Expected Recomputed Hash: {verificationResult.expectedHash}</div>
                  <div>Stored (Modified) Hash:   {verificationResult.actualHash}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Stream */}
      <div className="bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#EFE7DE] dark:border-[#203247] flex items-center justify-between bg-[#FAF6F0] dark:bg-[#152232]">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#E98F83]" />
            <h3 className="text-sm font-bold text-[#243B55] dark:text-white">Immutable Ledger Blocks</h3>
          </div>
          <span className="text-xs text-[#788394] dark:text-[#94A3B8] font-mono">
            {displayedEvents.length} Blocks Sequenced
          </span>
        </div>

        <div className="divide-y divide-[#EFE7DE] dark:divide-[#203247]">
          {displayedEvents.map(ev => (
            <div
              key={ev.id}
              className={`p-4 transition-colors ${
                ev.isTampered
                  ? 'bg-rose-50/70 dark:bg-rose-950/30'
                  : 'hover:bg-[#FDFBF7] dark:hover:bg-[#1A2636]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      ev.isTampered
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#FAF6F0] dark:bg-[#1E2E40] text-[#E98F83] dark:text-[#FF8A8A]'
                    }`}
                  >
                    #{ev.sequenceNumber}
                  </span>
                  <span className="text-xs font-bold text-[#243B55] dark:text-white">{ev.eventType}</span>
                  <span className="text-[11px] text-[#788394] dark:text-[#94A3B8]">
                    ({ev.entityType}: {ev.entityId})
                  </span>
                </div>

                <div className="text-[11px] font-mono text-[#788394] dark:text-[#94A3B8]">
                  {ev.actorName} ({ev.actorRole}) · {new Date(ev.timestamp).toLocaleString()}
                </div>
              </div>

              <p
                className={`text-xs mb-2.5 font-medium ${
                  ev.isTampered ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-[#546070] dark:text-[#CBD5E1]'
                }`}
              >
                {ev.payloadSummary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-[#788394] dark:text-[#94A3B8] bg-[#FAF6F0] dark:bg-[#111A26] p-2 rounded-lg border border-[#EFE7DE] dark:border-[#203247]">
                <div className="truncate">
                  <span className="text-[#E98F83] dark:text-[#FF8A8A] font-semibold">Prev: </span>
                  {ev.previousHash}
                </div>
                <div className="truncate">
                  <span className="text-[#E98F83] dark:text-[#FF8A8A] font-semibold">Curr: </span>
                  {ev.currentHash}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
