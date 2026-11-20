import React from 'react';
import { Sparkles, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

interface AiInsightPanelProps {
  title: string;
  subtitle?: string;
  buttonLabel: string;
  isLoading: boolean;
  error: string | null;
  advisoryBadge?: string;
  onGenerate: () => void;
  children?: React.ReactNode;
}

export const AiInsightPanel: React.FC<AiInsightPanelProps> = ({
  title,
  subtitle,
  buttonLabel,
  isLoading,
  error,
  advisoryBadge = 'Advisory Only · Human Review Required',
  onGenerate,
  children,
}) => {
  return (
    <div className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles size={15} className="text-[#E98F83]" />
            <h3 className="text-sm font-bold text-[#243B55] dark:text-white">{title}</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] border border-[#E98F83]/30 flex items-center gap-1">
              <ShieldCheck size={11} />
              <span>{advisoryBadge}</span>
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-[#788394] dark:text-[#94A3B8]">{subtitle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isLoading}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto ${
            isLoading
              ? 'bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#788394] cursor-wait'
              : 'bg-[#243B55] hover:bg-[#1B2D42] text-white cursor-pointer shadow-xs'
          }`}
        >
          <Sparkles size={13} className={isLoading ? 'animate-pulse text-[#E98F83]' : 'text-[#E98F83]'} />
          <span>{isLoading ? 'Generating via Gemini...' : buttonLabel}</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <div className="font-bold">AI Advisory Unavailable</div>
              <p className="text-[11px] mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-[#152232] border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100/50 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw size={11} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {children}
    </div>
  );
};
