import React, { useState } from 'react';
import { Sparkles, X, Send, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useApp } from '../../context/AppContext.tsx';
import { apiRequest } from '../../services/api.ts';

interface AssistantReply {
  role: string;
  answer: string;
  keyTakeaways: string[];
  safetyReminder: string;
  model: string;
  generatedAt: string;
}

export const AiAssistantWidget: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { activeView } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<AssistantReply | null>(null);

  // Strict RBAC guard: never expose AI controls to unauthenticated visitors
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AssistantReply>('/api/v1/ai/general-assistant', {
        method: 'POST',
        body: {
          question: trimmed,
          contextView: activeView,
        },
      });
      setReply(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Gemini AI assistant.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open LifeBridge AI Guidance Assistant"
          className="px-4 py-2.5 rounded-2xl bg-[#243B55] hover:bg-[#1B2D42] text-white text-xs font-bold shadow-lg border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Sparkles size={15} className="text-[#E98F83]" />
          <span>AI Guidance</span>
        </button>
      ) : (
        <div className="w-80 sm:w-96 bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 bg-[#243B55] text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#E98F83]" />
              <div>
                <div className="text-xs font-bold leading-tight">LifeBridge AI Assistant</div>
                <div className="text-[10px] text-white/75 capitalize">
                  Role-scoped advisory ({user.role})
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Assistant"
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-80 overflow-y-auto text-xs">
            <div className="p-2.5 rounded-xl bg-[#F8F5EF] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52] text-[11px] text-[#788394] flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#A9BBA8] shrink-0" />
              <span>Advisory only. Zero autonomous allocations or clinical overrides.</span>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <span>{error}</span>
              </div>
            )}

            {reply && (
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-[#FDFBF7] dark:bg-[#111A26] border border-[#EFE7DE] dark:border-[#273A52]">
                <p className="text-xs text-[#243B55] dark:text-white leading-relaxed">{reply.answer}</p>
                {reply.keyTakeaways.length > 0 && (
                  <ul className="space-y-1 text-[11px] text-[#788394] dark:text-[#94A3B8] list-disc pl-4">
                    {reply.keyTakeaways.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className="pt-1.5 border-t border-[#EFE7DE] dark:border-[#273A52] text-[10px] text-[#788394] flex items-center justify-between gap-2">
                  <span>{reply.safetyReminder}</span>
                  <span className="font-mono shrink-0">{reply.model}</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-[#EFE7DE] dark:border-[#273A52] flex items-center gap-2 bg-[#FAF6F0]/60 dark:bg-[#111A26]"
          >
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={`Ask a ${user.role} workflow question...`}
              maxLength={900}
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-white dark:bg-[#152232] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
            />
            <button
              type="submit"
              disabled={isLoading || question.trim().length < 3}
              aria-label="Send question"
              className="p-2 rounded-xl bg-[#E98F83] hover:bg-[#D87B6F] disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
