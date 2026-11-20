import React, { useState } from 'react';
import { useApp, ActiveView } from '../../context/AppContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Sun,
  Moon,
  Menu,
  X,
  HeartHandshake,
  ShieldCheck,
  Truck,
  RotateCcw,
  Scale,
  FileCheck,
  Building2,
  ChevronDown,
  ArrowRight,
  Bell,
  LogIn,
  LogOut,
  CheckCheck,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    activeView,
    setActiveView,
    currentUserRole,
    currentUserName,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isPublicView = ['landing', 'how-it-works', 'organ-info', 'about'].includes(activeView);
  const isPatientView =
    activeView === 'patient-portal' ||
    (isAuthenticated && (currentUserRole === 'donor' || currentUserRole === 'recipient'));

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const proNavLinks: { view: ActiveView; label: string }[] = [
    { view: 'dashboard', label: 'Home' },
    { view: 'matching', label: 'Matching' },
    { view: 'approval', label: 'Reviews' },
    { view: 'logistics', label: 'Organ Tracking' },
  ];

  const publicNavLinks: { view: ActiveView; label: string }[] = [
    { view: 'landing', label: 'Home' },
    { view: 'how-it-works', label: 'How It Works' },
    { view: 'organ-info', label: 'Organ Donation' },
    { view: 'about', label: 'About' },
  ];

  const roleBadges: Record<string, string> = {
    coordinator: 'Ops',
    medical: 'Clinical',
    hospital: 'Hospital',
    admin: 'Admin',
    donor: 'Donor',
    recipient: 'Recipient',
  };

  const handlePortalEntry = () => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }
    if (user?.role === 'donor' || user?.role === 'recipient') {
      setActiveView('patient-portal');
    } else {
      setActiveView('dashboard');
    }
  };

  const handleSignOut = async () => {
    setRoleDropdownOpen(false);
    await logout();
    setActiveView('landing');
  };

  return (
    <>
      {/* Persistent Non-Negotiable Demonstration Banner */}
      <div className="bg-[#243B55] text-white text-[11px] sm:text-xs py-1.5 px-4 text-center tracking-wide flex items-center justify-center gap-2 z-50">
        <span className="font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.2 rounded text-[9px]">
          Demo Prototype
        </span>
        <span className="truncate">
          Synthetic data only. Not for real clinical use. Clinical decisions remain under authorized human control.
        </span>
      </div>

      {/* Main Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#121D2A]/95 backdrop-blur-md border-b border-[#EFE7DE] dark:border-[#273A52] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 md:gap-8 h-16">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveView('landing')}
              className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
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

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {isPublicView ? (
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
                  className="px-3 py-1.5 text-xs font-semibold text-[#788394] hover:text-[#243B55] dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Public Guide
                </button>
              </>
            ) : (
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

                {/* More Dropdown */}
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
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {isPublicView ? (
              <button
                onClick={handlePortalEntry}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#243B55] hover:bg-[#1D3045] text-white rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>{isAuthenticated ? 'Open Portal' : 'Clinical Portal'}</span>
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

            {/* Notifications Bell (Authenticated Users) */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(prev => !prev)}
                  aria-label="Notifications"
                  className="relative p-2 rounded-xl text-[#788394] hover:text-[#243B55] dark:hover:text-white bg-[#F8F5EF] dark:bg-[#1A2636] border border-[#EFE7DE] dark:border-[#273A52] transition-colors cursor-pointer"
                >
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#E98F83] text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] rounded-2xl shadow-xl p-3 z-50 space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-[#243B55] dark:text-white">
                        Notifications ({unreadCount} unread)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllNotificationsRead()}
                          className="text-[11px] font-semibold text-[#E98F83] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheck size={12} />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#788394]">No notifications yet.</div>
                      ) : (
                        notifications.slice(0, 8).map(n => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.isRead) markNotificationRead(n.id);
                            }}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              n.isRead
                                ? 'bg-[#F8F5EF]/50 dark:bg-[#111A26] border-[#EFE7DE] dark:border-[#273A52] opacity-75'
                                : 'bg-[#F8E8E3]/50 dark:bg-[#2C1C1A]/50 border-[#E98F83]/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#243B55] dark:text-white truncate">
                                {n.title}
                              </span>
                              <span className="text-[9px] font-mono text-[#788394] shrink-0">
                                {n.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#788394] dark:text-[#94A3B8] mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Authenticated Account / Sign In Button */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(prev => !prev)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[#F8F5EF] dark:bg-[#1A2636] border border-[#EFE7DE] dark:border-[#273A52] text-[#243B55] dark:text-white flex items-center gap-1.5 hover:border-[#E98F83] transition-colors cursor-pointer"
                >
                  <span className="font-semibold">{roleBadges[currentUserRole] || currentUserRole}</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>

                {roleDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[#152232] border border-[#EFE7DE] dark:border-[#273A52] rounded-2xl shadow-xl p-3 z-50 space-y-2.5">
                    <div className="px-2 py-1 border-b border-[#EFE7DE] dark:border-[#273A52]">
                      <div className="text-xs font-bold text-[#243B55] dark:text-white truncate">
                        {currentUserName}
                      </div>
                      <div className="text-[11px] text-[#788394] truncate">{user?.email}</div>
                    </div>

                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        openAuthModal('signin');
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold rounded-xl text-[#243B55] dark:text-[#CBD5E1] hover:bg-[#F8F5EF] dark:hover:bg-[#1E2E40] flex items-center gap-2 cursor-pointer"
                    >
                      <LogIn size={14} className="text-[#E98F83]" />
                      <span>Switch Account (Sign In)</span>
                    </button>

                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('signin')}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#E98F83] hover:bg-[#D87B6F] text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            )}

            {/* Dark / Light Mode Toggle */}
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
              className="md:hidden p-2 rounded-xl text-[#788394] hover:bg-[#F8F5EF] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-[#121D2A] border-b border-[#EFE7DE] dark:border-[#273A52] px-4 py-3 space-y-1">
            {(isPublicView ? publicNavLinks : isPatientView ? [{ view: 'patient-portal' as ActiveView, label: 'My Portal' }] : proNavLinks).map(
              link => (
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
              )
            )}
          </div>
        )}
      </header>
    </>
  );
};
