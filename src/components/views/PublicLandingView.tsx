import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { OrganType } from '../../types/index.ts';
import {
  Heart,
  Activity,
  Droplet,
  Wind,
  Shield,
  Eye,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
  HeartHandshake
} from 'lucide-react';

export const PublicLandingView: React.FC = () => {
  const { setActiveView, registerDonorPledge, setCurrentUserRole } = useApp();

  // Registration Modal State
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [donorAge, setDonorAge] = useState('28');
  const [bloodGroup, setBloodGroup] = useState<'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'>('O+');
  const [selectedOrgans, setSelectedOrgans] = useState<OrganType[]>(['kidney', 'liver', 'heart', 'lung']);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleOrgan = (organ: OrganType) => {
    setSelectedOrgans(prev =>
      prev.includes(organ) ? prev.filter(o => o !== organ) : [...prev, organ]
    );
  };

  const handlePledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || selectedOrgans.length === 0) return;
    registerDonorPledge({
      name: donorName,
      age: parseInt(donorAge) || 28,
      bloodGroup,
      consentedOrgans: selectedOrgans,
    });
    setShowPledgeModal(false);
  };

  const faqs = [
    {
      q: 'Who can register as an organ donor?',
      a: 'Anyone aged 18 and above can register their consent to become an organ donor. There is no strict upper age limit—clinical fitness and organ suitability are assessed by certified doctors at the time of donation.',
    },
    {
      q: 'Does organ donation cost any money for the donor or their family?',
      a: 'No. Organ donation is a purely altruistic act. Neither the donor nor the donor’s family pays or receives any financial compensation. All costs associated with organ retrieval are covered under hospital and transplant programs.',
    },
    {
      q: 'Can I change my mind after registering?',
      a: 'Yes, absolutely. Consent is never permanent or irrevocable. You can update your organ preferences or withdraw your consent at any time through your donor dashboard with a single click.',
    },
    {
      q: 'Can living donors donate organs?',
      a: 'Yes. Living donors can safely donate one kidney or a portion of their liver to a compatible family recipient under strict statutory medical guidelines and committee approval.',
    },
    {
      q: 'How does LifeBridge AI protect fairness and transparency?',
      a: 'LifeBridge AI uses transparent, open medical criteria (blood group compatibility, clinical urgency, and waitlist time). Protected demographic factors such as wealth or background are never scored, and every allocation must be signed by an authorized surgeon.',
    },
  ];

  const organsList: { type: OrganType; name: string; icon: React.ElementType; desc: string; typeBadge: string }[] = [
    {
      type: 'kidney',
      name: 'Kidneys',
      icon: Activity,
      desc: 'Can restore health for two individuals suffering from end-stage renal disease.',
      typeBadge: 'Living or Deceased',
    },
    {
      type: 'liver',
      name: 'Liver',
      icon: Droplet,
      desc: 'The only internal organ that can regenerate. Can be split for an adult and child.',
      typeBadge: 'Living or Deceased',
    },
    {
      type: 'heart',
      name: 'Heart',
      icon: Heart,
      desc: 'Gives a second chance to individuals with critical end-stage heart failure.',
      typeBadge: 'Deceased Donor',
    },
    {
      type: 'lung',
      name: 'Lungs',
      icon: Wind,
      desc: 'Can be donated to patients with severe pulmonary fibrosis, COPD, or cystic fibrosis.',
      typeBadge: 'Deceased Donor',
    },
    {
      type: 'pancreas',
      name: 'Pancreas',
      icon: Shield,
      desc: 'Restores natural insulin production for severe type 1 diabetes candidates.',
      typeBadge: 'Deceased Donor',
    },
    {
      type: 'intestine',
      name: 'Corneas & Tissues',
      icon: Eye,
      desc: 'Restores sight to corneal blindness patients and repairs damaged musculoskeletal tissues.',
      typeBadge: 'Tissue Donation',
    },
  ];

  return (
    <div className="space-y-16 py-4 max-w-5xl mx-auto">
      
      {/* 1. HERO SECTION (Clean, Welcoming, Emotionally Engaging) */}
      <section className="relative overflow-hidden bg-white dark:bg-[#152232] rounded-3xl p-8 sm:p-12 lg:p-16 border border-[#EFE7DE] dark:border-[#273A52] shadow-sm text-center">
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] text-xs font-semibold">
            <Heart size={14} className="fill-current text-[#E98F83]" />
            <span>Organ Donation Awareness</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#243B55] dark:text-white leading-[1.15]">
            Give the Gift of Life.
          </h1>

          <p className="text-base sm:text-lg text-[#788394] dark:text-[#CBD5E1] max-w-xl mx-auto leading-relaxed">
            A single act of generosity can create hope for another life.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setShowPledgeModal(true)}
              className="px-6 py-3.5 text-sm font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center gap-2"
            >
              <span>Become a Donor</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('how-it-works-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3.5 text-sm font-semibold bg-[#F8F5EF] dark:bg-[#1C2C3E] text-[#243B55] dark:text-white hover:bg-[#F2ECE2] rounded-xl transition-all cursor-pointer"
            >
              Learn How It Works
            </button>
          </div>
        </div>
      </section>

      {/* 2. HOW ORGAN DONATION WORKS (3 Clean Steps) */}
      <section id="how-it-works-section" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
            Simple & Transparent
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#243B55] dark:text-white">
            How Organ Donation Works
          </h2>
          <p className="text-xs sm:text-sm text-[#788394] dark:text-[#94A3B8]">
            Three safe, dignified steps connecting donors and patients.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#152232] p-6 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">
              Pledge Your Consent
            </h3>
            <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              Register online in under two minutes. Select which organs you wish to donate. Your decision is strictly confidential and can be updated anytime.
            </p>
          </div>

          <div className="bg-white dark:bg-[#152232] p-6 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">
              Intelligent Verified Matching
            </h3>
            <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              When an organ becomes available, our explainable system checks medical compatibility and urgency. Only certified doctors make the final decision.
            </p>
          </div>

          <div className="bg-white dark:bg-[#152232] p-6 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-[#243B55] dark:text-white">
              Safe, Coordinated Care
            </h3>
            <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              Hospital teams monitor organ transport and temperature continuously. Recipients receive transparent follow-up care for a healthy recovery.
            </p>
          </div>
        </div>
      </section>

      {/* 3. ORGANS & TISSUES THAT CAN BE DONATED */}
      <section className="space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
            What You Can Give
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#243B55] dark:text-white">
            Organs & Tissues That Save Lives
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {organsList.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.type}
                className="bg-white dark:bg-[#152232] p-5 rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] hover:border-[#E98F83] transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#E98F83] flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83]">
                    {item.typeBadge}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#243B55] dark:text-white">
                    {item.name}
                  </h3>
                  <p className="text-xs text-[#788394] dark:text-[#94A3B8] mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. HOW LIFEBRIDGE AI HELPS COORDINATE */}
      <section className="bg-white dark:bg-[#152232] p-8 sm:p-10 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] space-y-6">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#A9BBA8]">
            Safe, Ethical Technology
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#243B55] dark:text-white">
            How LifeBridge AI Coordinates with Care
          </h2>
          <p className="text-xs sm:text-sm text-[#788394] dark:text-[#94A3B8] leading-relaxed">
            We believe technology in healthcare must always empower human doctors, protect patient privacy, and ensure fairness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#243B55] dark:text-white">
              <CheckCircle2 size={16} className="text-[#A9BBA8]" />
              <span>Human-in-the-Loop</span>
            </div>
            <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              AI provides decision support and explanation. Certified doctors and transplant surgeons make every allocation and medical decision.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#243B55] dark:text-white">
              <ShieldCheck size={16} className="text-[#A9BBA8]" />
              <span>Zero Discrimination</span>
            </div>
            <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              Protected characteristics like wealth, gender, or social background are never scored. Allocations follow strictly objective medical need.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#243B55] dark:text-white">
              <Sparkles size={16} className="text-[#A9BBA8]" />
              <span>Transparent & Audit-Proof</span>
            </div>
            <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
              Every step is recorded in a secure, tamper-evident history so hospitals, regulators, and families have full confidence in the process.
            </p>
          </div>
        </div>
      </section>

      {/* 5. FREQUENTLY ASKED QUESTIONS */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E98F83]">
            Questions & Answers
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#243B55] dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="bg-white dark:bg-[#152232] rounded-2xl border border-[#EFE7DE] dark:border-[#273A52] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-semibold text-sm text-[#243B55] dark:text-white hover:text-[#E98F83] transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp size={16} className="text-[#E98F83] shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-[#788394] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed border-t border-[#EFE7DE] dark:border-[#273A52] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. FINAL CALL TO ACTION */}
      <section className="bg-gradient-to-br from-[#F8E8E3] to-[#F8F5EF] dark:from-[#1E2E40] dark:to-[#152232] p-8 sm:p-12 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#243B55] dark:text-white">
          Ready to make a difference?
        </h2>
        <p className="text-xs sm:text-sm text-[#788394] dark:text-[#CBD5E1] max-w-md mx-auto">
          Take two minutes to pledge your decision. Your choice can save up to eight lives and improve dozens more.
        </p>
        <div className="pt-2">
          <button
            onClick={() => setShowPledgeModal(true)}
            className="px-8 py-3.5 text-sm font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Register as an Organ Donor
          </button>
        </div>
      </section>

      {/* QUICK DONOR PLEDGE MODAL */}
      {showPledgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#152232] rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#E98F83] uppercase tracking-wider">
                Step 1 of 1 · Simple Pledge
              </span>
              <h3 className="text-lg font-bold text-[#243B55] dark:text-white">
                Register Your Organ Donation Pledge
              </h3>
              <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
                Your decision will be recorded in the confidential registry and can be updated at any time.
              </p>
            </div>

            <form onSubmit={handlePledgeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="e.g. Ananya Rao"
                  className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min="18"
                    max="100"
                    required
                    value={donorAge}
                    onChange={(e) => setDonorAge(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value as any)}
                    className="w-full text-xs p-3 rounded-xl border border-[#EFE7DE] dark:border-[#273A52] bg-[#F8F5EF] dark:bg-[#0E1722] text-[#243B55] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E98F83]"
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B55] dark:text-white mb-1.5">
                  Organs You Wish to Donate:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(['kidney', 'liver', 'heart', 'lung', 'pancreas', 'intestine'] as OrganType[]).map(org => {
                    const isChecked = selectedOrgans.includes(org);
                    return (
                      <button
                        type="button"
                        key={org}
                        onClick={() => toggleOrgan(org)}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between cursor-pointer capitalize transition-colors ${
                          isChecked
                            ? 'bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] border-[#E98F83] font-semibold'
                            : 'bg-[#F8F5EF] dark:bg-[#0E1722] text-[#788394] border-[#EFE7DE] dark:border-[#273A52]'
                        }`}
                      >
                        <span>{org}</span>
                        {isChecked && <CheckCircle2 size={13} className="text-[#E98F83]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPledgeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#788394] hover:text-[#243B55] dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Confirm & View Donor Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
