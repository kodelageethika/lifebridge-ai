import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { AppBackground } from './components/layout/AppBackground.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { ToastContainer } from './components/common/ToastContainer.tsx';
import { DemoScenarioDrawer } from './components/common/DemoScenarioDrawer.tsx';
import { AiAssistantWidget } from './components/common/AiAssistantWidget.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { Lock, ShieldCheck } from 'lucide-react';

// Views
import { PublicLandingView } from './components/views/PublicLandingView.tsx';
import { HowItWorksView, OrganInfoView, AboutView } from './components/views/PublicInfoViews.tsx';
import { PatientPortalView } from './components/views/PatientPortalView.tsx';
import { RoleDashboardRouter } from './components/views/RoleDashboardRouter.tsx';
import { ExplainableMatchingView } from './components/views/ExplainableMatchingView.tsx';
import { ApprovalWorkflowView } from './components/views/ApprovalWorkflowView.tsx';
import { LogisticsMonitoringView } from './components/views/LogisticsMonitoringView.tsx';
import { WhatIfSimulatorView } from './components/views/WhatIfSimulatorView.tsx';
import { FairnessMetricsView } from './components/views/FairnessMetricsView.tsx';
import { ConsentCenterView } from './components/views/ConsentCenterView.tsx';
import { AuditTrailView } from './components/views/AuditTrailView.tsx';
import { RecoveryTrackerView } from './components/views/RecoveryTrackerView.tsx';
import { HospitalReadinessView } from './components/views/HospitalReadinessView.tsx';

const PUBLIC_VIEWS = ['landing', 'how-it-works', 'organ-info', 'about'];

const AppContent: React.FC = () => {
  const { activeView, setActiveView } = useApp();
  const { isAuthenticated, isAuthLoading, openAuthModal, user } = useAuth();

  const isPublicView = PUBLIC_VIEWS.includes(activeView);

  const renderAuthGate = () => (
    <div className="max-w-lg mx-auto my-12 bg-white dark:bg-[#152232] p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-sm text-center space-y-5">
      <div className="w-12 h-12 rounded-2xl bg-[#F8E8E3] dark:bg-[#2C1C1A] text-[#E98F83] flex items-center justify-center mx-auto">
        <Lock size={22} />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-[#243B55] dark:text-white">
          Sign In Required for Portal Access
        </h2>
        <p className="text-xs text-[#788394] dark:text-[#94A3B8] leading-relaxed">
          All patient records, organ consents, clinical approvals, and audit trails are protected by server-enforced Role-Based Access Control (RBAC).
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          onClick={() => openAuthModal('signin')}
          className="px-5 py-2.5 text-xs font-bold bg-[#E98F83] hover:bg-[#D87B6F] text-white rounded-xl transition-all shadow-xs cursor-pointer"
        >
          Sign In / Demo Accounts
        </button>
        <button
          onClick={() => setActiveView('landing')}
          className="px-4 py-2.5 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white rounded-xl transition-colors cursor-pointer"
        >
          Return to Public Home
        </button>
      </div>
    </div>
  );

  const renderRoleDenied = () => (
    <div className="max-w-lg mx-auto my-12 bg-white dark:bg-[#152232] p-8 rounded-3xl border border-[#EFE7DE] dark:border-[#273A52] shadow-sm text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
        <ShieldCheck size={22} />
      </div>
      <h2 className="text-lg font-bold text-[#243B55] dark:text-white">
        Restricted Clinical Workspace
      </h2>
      <p className="text-xs text-[#788394] dark:text-[#94A3B8]">
        Your current signed-in role (<span className="font-bold uppercase">{user?.role}</span>) is scoped to your personal portal to safeguard medical privacy.
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => setActiveView('patient-portal')}
          className="px-4 py-2 text-xs font-bold bg-[#E98F83] text-white rounded-xl cursor-pointer"
        >
          Go to My Portal
        </button>
        <button
          onClick={() => openAuthModal('signin')}
          className="px-4 py-2 text-xs font-semibold bg-[#F8F5EF] dark:bg-[#1E2E40] text-[#243B55] dark:text-white rounded-xl cursor-pointer"
        >
          Switch Account
        </button>
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (!isPublicView) {
      if (isAuthLoading) {
        return (
          <div className="py-20 text-center text-xs text-[#788394]">
            Verifying encrypted session...
          </div>
        );
      }
      if (!isAuthenticated) {
        return renderAuthGate();
      }
      const isPatientRole = user?.role === 'donor' || user?.role === 'recipient';
      if (isPatientRole && activeView !== 'patient-portal') {
        return renderRoleDenied();
      }
    }

    switch (activeView) {
      case 'landing':
        return <PublicLandingView />;
      case 'how-it-works':
        return <HowItWorksView />;
      case 'organ-info':
        return <OrganInfoView />;
      case 'about':
        return <AboutView />;
      case 'patient-portal':
        return <PatientPortalView />;
      case 'dashboard':
        return <RoleDashboardRouter />;
      case 'matching':
        return <ExplainableMatchingView />;
      case 'approval':
        return <ApprovalWorkflowView />;
      case 'logistics':
        return <LogisticsMonitoringView />;
      case 'simulator':
        return <WhatIfSimulatorView />;
      case 'fairness':
        return <FairnessMetricsView />;
      case 'consent':
        return <ConsentCenterView />;
      case 'audit':
        return <AuditTrailView />;
      case 'recovery':
        return <RecoveryTrackerView />;
      case 'readiness':
        return <HospitalReadinessView />;
      default:
        return <PublicLandingView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-[#16202C] dark:text-[#F1F5F9] relative selection:bg-[#E05A5A]/20 selection:text-[#B83232]">
      <AppBackground />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
        {renderActiveView()}
      </main>

      <footer className="mt-auto border-t border-[#F5D0D0] dark:border-[#203247] bg-white/70 dark:bg-[#111A26]/70 backdrop-blur-xs py-6 px-4 sm:px-6 text-xs text-[#718096] dark:text-[#94A3B8]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <span className="font-bold text-[#16202C] dark:text-white">
              LifeBridge AI — Transplant Coordination Platform
            </span>
            <p className="text-[11px] opacity-80">
              B.Tech Final-Year DTPI Project · Academic Prototype · Synthetic Data Demonstration
            </p>
          </div>

          <div className="text-[11px] space-y-0.5 sm:text-right">
            <div>Designed with NOTTO / SOTTO & THOTA 1994 statutory principles</div>
            <div className="text-[#8C2E2E] dark:text-[#FFA3A3] font-semibold">
              Not certified for real clinical use · Zero autonomous allocations
            </div>
          </div>
        </div>
      </footer>

      <DemoScenarioDrawer />
      <AiAssistantWidget />
      <AuthModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
