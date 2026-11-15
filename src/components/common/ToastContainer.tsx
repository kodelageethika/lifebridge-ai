import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const icons = {
          success: CheckCircle2,
          warning: AlertTriangle,
          error: AlertCircle,
          info: Info,
        };

        const Icon = icons[toast.type];

        const colors = {
          success: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
          warning: 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100',
          error: 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100',
          info: 'bg-blue-50 dark:bg-blue-950/90 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100',
        };

        const iconColors = {
          success: 'text-emerald-600 dark:text-emerald-400',
          warning: 'text-amber-600 dark:text-amber-400',
          error: 'text-rose-600 dark:text-rose-400',
          info: 'text-blue-600 dark:text-blue-400',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-150 ${colors[toast.type]}`}
          >
            <Icon size={18} className={`shrink-0 mt-0.5 ${iconColors[toast.type]}`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold leading-tight truncate">{toast.title}</h4>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
