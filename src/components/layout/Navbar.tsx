import React, { useState } from 'react';
import { useApp, ActiveView } from '../../context/AppContext.tsx';
import { UserRole } from '../../types/index.ts';
import {
  Sun,
  Moon,
  Zap,
  Menu,
  X,
  User,
  HeartHandshake,
  ShieldCheck,
  Stethoscope,
  Activity,
  GitBranch,
  Truck,
  RotateCcw,
  Scale,
  FileCheck,
  Building2,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    activeView,
    setActiveView,
    currentUserRole,
    setCurrentUserRole,
    setIsScenarioDrawerOpen,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);

  // Check if we are currently in Public/Patient mode or Professional mode
  const isPublicView = ['landing', 'how-it-works', 'organ-info', 'about'].includes(activeView);
  const isPatientView = activeView === 'patient-portal' || currentUserRole === 'donor' || currentUserRole === 'recipient';

  // Professional Navigation (Part 2.B & Part 4)
  const proNavLinks: { view: ActiveView; label: string }[] = [
    { view: 'dashboard', label: 'Home' },
    { view: 'matching', label: 'Matching' },
    { view: 'approval', label: 'Reviews' },
    { view: 'logistics', label: 'Organ Tracking' },
  ];

  // Public Navigation (Part 2.A)
  const publicNavLinks: { view: ActiveView; label: string }[] = [
    { view: 'landing', label: 'Home' },
    { view: 'how-it-works', label: 'How It Works' },
    { view: 'organ-info', label: 'Organ Donation' },
    { view: 'about', label: 'About' },
  ];

  const roles: { role: UserRole; title: string; badge: string; isPatient?: boolean }[] = [
    { role: 'coordinator', title: 'Transplant Coordinator', badge: 'Ops' },
    { role: 'medical', title: 'Transplant Surgeon / Doctor', badge: 'Clinical' },
    { role: 'hospital', title: 'Hospital Administrator', badge: 'Hospital' },
    { role: 'admin', title: 'System Administrator', badge: 'Admin' },
    { role: 'donor', title: 'Organ Donor Profile', badge: 'Patient', isPatient: true },
    { role: 'recipient', title: 'Recipient Candidate', badge: 'Patient', isPatient: true },
  ];

  const currentRoleInfo = roles.find(r => r.role === currentUserRole) || roles[0];

  const handleRoleSelect = (role: UserRole) => {
    setCurrentUserRole(role);
    setRoleDropdownOpen(false);
    if (role === 'donor' || role === 'recipient') {
      setActiveView('patient-portal');
    } else if (isPublicView) {
      setActiveView('dashboard');
    }
  };

  return (
    <>
      {/* 1. Persistent Non-Negotiable Demonstration Banner */}
      <div className="bg-[#243B55] text-white text-[11px] sm:text-xs py-1.5 px-4 text-center tracking-wide flex items-center justify-center gap-2 z-50">
        <span className="font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.2 rounded text-[9px]">
          Demo Prototype
        </span>
        <span className="truncate">
          Synthetic data only. Not for real clinical use. Clinical decisions remain under authorized human control.
        </span>
      </div>

      {/* 2. Main Top Bar adhering to 3-Zone Contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121D2A]/95 backdrop-blur-md border-b border-[#EFE7DE] dark:border-[#273A52] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 md:gap-8 h-16">
          
          {/* Zone 1: Single Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveView('landing')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-8 h-8 rounded-xl bg-[#E98F83] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <HeartHandshake size={18} className="text-white" />
              </div>
              <div className="leading-tight">
                <span className="text-lg font-bold tracking-tight text-[#243B55] dark:text-white block">
                  LifeBridge <span className="text-[#E98F83] font-extrabold">AI</span>
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links (Clean, Single-Line, Uncrowded) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {isPublicView ? (
              // Public Navigation Links
              publicNavLinks.map(link => {
                const isActive = activeView === link.view;
                return (
                  <button
                    key={link.view}
                    onClick={() => setActiveView(link.view)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#E98F83] bg-[#F8E8E3] dark:bg-[#2C1C1A]'
                        : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white hover:bg-[#F8F5EF] dark:hover:bg-[#1A2636]'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })
            ) : isPatientView ? (
              // Patient Experience Navigation Links
              <>
                <button
                  onClick={() => setActiveView('patient-portal')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeView === 'patient-portal'
                      ? 'text-[#E98F83] bg-[#F8E8E3] dark:bg-[#2C1C1A]'
                      : 'text-[#788394] hover:text-[#243B55]'
                  }`}
                >
                  My Portal
                </button>
                <button
                  onClick={() => setActiveView('landing')}
                  className="px-3 py-1.5 text-xs font-semibold text-[#788394] hover:text-[#243B55] rounded-lg transition-colors cursor-pointer"
                >
                  Public Guide
                </button>
              </>
            ) : (
              // Professional Navigation Links (Part 2.B)
              <>
                {proNavLinks.map(link => {
                  const isActive = activeView === link.view;
                  return (
                    <button
                      key={link.view}
                      onClick={() => setActiveView(link.view)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'text-[#E98F83] bg-[#F8E8E3] dark:bg-[#2C1C1A] font-bold'
                          : 'text-[#788394] hover:text-[#243B55] dark:hover:text-white hover:bg-[#F8F5EF] dark:hover:bg-[#1A2636]'
                      }`}
                    >
                      {link.label}
                    </button>
                  );
                })}

                {/* Categorized "More" Dropdown (Part 4 Screen 6) */}
                <div className="relative">
                  <button
                    onClick={() => setMoreDropdownOpen(prev => !prev)}
                    onBlur={() => setTimeout(() => setMoreDropdownOpen(false), 200)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-[#788394] hover:text-[#243B55] dark:hover:text-white hover:bg-[#F8F5EF] dark:hover:bg-[#1A2636] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>More</span>
                    <ChevronDown size={13} className={`transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {moreDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] rounded-2xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                      
                      {/* DONATION */}
                      <div>
                        <span className="text-[10px] font-bold text-[#E98F83] uppercase tracking-wider block px-2 mb-1">
                          Donation
                        </span>
                        <button
                          onClick={() => { setActiveView('consent'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <FileCheck size={14} className="text-[#E98F83]" />
                          <span>Consent Management</span>
                        </button>
                      </div>

                      {/* HOSPITAL OPERATIONS */}
                      <div>
                        <span className="text-[10px] font-bold text-[#E98F83] uppercase tracking-wider block px-2 mb-1">
                          Hospital Operations
                        </span>
                        <button
                          onClick={() => { setActiveView('readiness'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <Building2 size={14} className="text-[#A9BBA8]" />
                          <span>Hospital Readiness</span>
                        </button>
                        <button
                          onClick={() => { setActiveView('logistics'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <Truck size={14} className="text-[#A9BBA8]" />
                          <span>Organ Tracking</span>
                        </button>
                      </div>

                      {/* PATIENT CARE */}
                      <div>
                        <span className="text-[10px] font-bold text-[#E98F83] uppercase tracking-wider block px-2 mb-1">
                          Patient Care
                        </span>
                        <button
                          onClick={() => { setActiveView('recovery'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCcw size={14} className="text-[#E98F83]" />
                          <span>Recovery Tracking</span>
                        </button>
                      </div>

                      {/* OVERSIGHT & RESEARCH */}
                      <div>
                        <span className="text-[10px] font-bold text-[#E98F83] uppercase tracking-wider block px-2 mb-1">
                          Oversight & Research
                        </span>
                        <button
                          onClick={() => { setActiveView('simulator'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <Scale size={14} className="text-[#788394]" />
                          <span>Scenario Lab (What-If)</span>
                        </button>
                        <button
                          onClick={() => { setActiveView('fairness'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <ShieldCheck size={14} className="text-[#788394]" />
                          <span>Fairness Monitoring</span>
                        </button>
                        <button
                          onClick={() => { setActiveView('audit'); setMoreDropdownOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                        >
                          <FileCheck size={14} className="text-[#788394]" />
                          <span>Secure Activity History</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>

          {/* Zone 3: Actions & Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            
            {/* Context Switcher Button: Public Website vs Clinical Portal */}
            {isPublicView ? (
              <button
                onClick={() => {
                  setCurrentUserRole('coordinator');
                  setActiveView('dashboard');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#243B55] hover:bg-[#1D3045] text-white rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Clinical Portal</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={() => setActiveView('landing')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white hover:bg-[#EFE7DE] rounded-xl transition-all cursor-pointer hidden sm:block"
              >
                Public Website
              </button>
            )}

            {/* Role Switcher Dropdown (for testing and multi-role operations) */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(prev => !prev)}
                onBlur={() => setTimeout(() => setRoleDropdownOpen(false), 200)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[#F8F5EF] dark:bg-[#1A2636] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white flex items-center gap-1.5 hover:border-[#E98F83] transition-colors cursor-pointer"
              >
                <span className="font-semibold">{currentRoleInfo.badge}</span>
                <ChevronDown size={12} className="opacity-60" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#788394] uppercase tracking-wider">
                    Switch User Role
                  </div>
                  <div className="space-y-1 mt-1">
                    {roles.map(r => (
                      <button
                        key={r.role}
                        onClick={() => handleRoleSelect(r.role)}
                        className={`w-full text-left px-2.5 py-2 text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                          currentUserRole === r.role
                            ? 'bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] font-bold'
                            : 'text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40]'
                        }`}
                      >
                        <span className="truncate">{r.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/5 dark:bg-white/10">
                          {r.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Seamless Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl text-[#788394] hover:text-[#243B55] dark:hover:text-white bg-[#F8F5EF] dark:bg-[#1A2636] border border-[#EFE7DE] dark:border-[#273A52] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="md:hidden p-2 rounded-xl text-[#788394] hover:bg-[#F8F5EF] transition-colors"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-[#121D2A] border-b border-[#EFE7DE] dark:border-[#273A52] px-4 py-3 space-y-1">
            {(isPublicView ? publicNavLinks : proNavLinks).map(link => (
              <button
                key={link.view}
                onClick={() => {
                  setActiveView(link.view);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center justify-between transition-colors ${
                  activeView === link.view
                    ? 'bg-[#F8E8E3] text-[#E98F83]'
                    : 'text-[#788394] hover:bg-[#F8F5EF]'
                }`}
              >
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>
    </>
  );
};
