import React from 'react';
import { useApp } from '../../context/AppContext.tsx';
import {
  Heart,
  ShieldCheck,
  Activity,
  Droplet,
  Wind,
  Shield,
  Eye,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const HowItWorksView: React.FC = () => {
  const { setActiveView } = useApp();

  return (
    <div className="space-y-12 max-w-4xl mx-auto py-4">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
          Simple & Dignified
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#243B55] dark:text-white">
          How Organ Donation Works
        </h1>
        <p className="text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
          From registry to recovery, discover how intelligent coordination and human clinical oversight work together to save lives.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-[#152232] p-6 sm:p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center font-bold text-base shrink-0">
            01
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-[#243B55] dark:text-white">
              Voluntary Pledge & Consent
            </h3>
            <p className="text-xs sm:text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              An individual or family representative registers organ consent online. The user chooses exactly which organs they wish to donate. Consent is never permanent and can be revoked or updated at any time.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#152232] p-6 sm:p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center font-bold text-base shrink-0">
            02
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-[#243B55] dark:text-white">
              Data Verification & Medical Matching
            </h3>
            <p className="text-xs sm:text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              When an organ is retrieved, our system verifies data completeness. It ranks compatible recipients within the same organ type using open medical factors: blood group compatibility, clinical urgency, and waitlist duration.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#152232] p-6 sm:p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-xs flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center font-bold text-base shrink-0">
            03
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-[#243B55] dark:text-white">
              Authorized Surgical Review & Green Corridor Transit
            </h3>
            <p className="text-xs sm:text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              An attending transplant surgeon signs the allocation with their medical license. Police green corridors and continuous temperature sensors protect the organ during transit to the operating theatre.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center pt-4">
        <button
          onClick={() => setActiveView('landing')}
          className="px-6 py-3 text-xs font-semibold bg-[#E98F83] text-white rounded-xl hover:bg-[#D87B6F] transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <span>Return to Homepage</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export const OrganInfoView: React.FC = () => {
  const { setActiveView } = useApp();

  return (
    <div className="space-y-12 max-w-4xl mx-auto py-4">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
          Educational Guide
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#243B55] dark:text-white">
          Organs & Tissues You Can Donate
        </h1>
        <p className="text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
          Learn about the organs and tissues that can be donated through living and deceased donation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
          <div className="flex items-center gap-2 text-[#E98F83] font-bold text-base">
            <Activity size={20} />
            <span>Kidneys</span>
          </div>
          <p className="text-xs text-[#788394] leading-relaxed">
            The kidneys filter waste from the blood. Living donors can donate one kidney and live a completely normal life. A deceased donor can help two patients with kidney failure.
          </p>
          <span className="text-[11px] font-semibold text-[#A9BBA8] block">Donation Type: Living or Deceased</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
          <div className="flex items-center gap-2 text-[#E98F83] font-bold text-base">
            <Droplet size={20} />
            <span>Liver</span>
          </div>
          <p className="text-xs text-[#788394] leading-relaxed">
            The liver can regenerate tissue. In living donation, a portion of the liver is transplanted and both the donor's and recipient's liver grow back to full size within weeks.
          </p>
          <span className="text-[11px] font-semibold text-[#A9BBA8] block">Donation Type: Living or Deceased</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
          <div className="flex items-center gap-2 text-[#E98F83] font-bold text-base">
            <Heart size={20} />
            <span>Heart</span>
          </div>
          <p className="text-xs text-[#788394] leading-relaxed">
            Transplanted to candidates with end-stage heart disease. Due to a short cold preservation window (approx. 4–6 hours), transit coordination requires real-time monitoring.
          </p>
          <span className="text-[11px] font-semibold text-[#A9BBA8] block">Donation Type: Deceased Donor</span>
        </div>

        <div className="bg-white dark:bg-[#152232] p-6 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
          <div className="flex items-center gap-2 text-[#E98F83] font-bold text-base">
            <Wind size={20} />
            <span>Lungs</span>
          </div>
          <p className="text-xs text-[#788394] leading-relaxed">
            Lungs can be donated as a single lung or double lung transplant for patients with irreversible respiratory failure.
          </p>
          <span className="text-[11px] font-semibold text-[#A9BBA8] block">Donation Type: Deceased Donor</span>
        </div>
      </div>

      <div className="text-center pt-4">
        <button
          onClick={() => setActiveView('landing')}
          className="px-6 py-3 text-xs font-semibold bg-[#E98F83] text-white rounded-xl hover:bg-[#D87B6F] transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <span>Return to Homepage</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export const AboutView: React.FC = () => {
  const { setActiveView } = useApp();

  return (
    <div className="space-y-12 max-w-4xl mx-auto py-4">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
          Our Mission & Ethics
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#243B55] dark:text-white">
          About LifeBridge AI
        </h1>
        <p className="text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
          Designed with the principles of India's Transplantation of Human Organs and Tissues Act (THOTA) 1994 and NOTTO guidelines.
        </p>
      </div>

      <div className="bg-white dark:bg-[#152232] p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-6 text-xs sm:text-sm text-[#788394] leading-relaxed">
        <p>
          LifeBridge AI is an organ-aware, explainable transplant coordination platform developed as an academic and technological prototype. It is designed to assist authorized healthcare coordinators and transplant surgeons in making transparent, fair, and timely organ allocation decisions.
        </p>
        <p>
          <strong className="text-[#243B55] dark:text-white">Zero Autonomous Allocation: </strong>
          Our core architectural guarantee is that artificial intelligence never allocates an organ autonomously. Every match recommendation must be reviewed and authorized by an attending medical doctor with verifiable license credentials.
        </p>
        <p>
          <strong className="text-[#243B55] dark:text-white">Synthetic Data Demonstration: </strong>
          All patient profiles, donor registrations, and hospital records presented in this demonstration system are synthetic and fictional. This platform is an educational prototype and is not certified for real clinical emergency use.
        </p>
      </div>

      <div className="text-center pt-4">
        <button
          onClick={() => setActiveView('landing')}
          className="px-6 py-3 text-xs font-semibold bg-[#E98F83] text-white rounded-xl hover:bg-[#D87B6F] transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <span>Return to Homepage</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
