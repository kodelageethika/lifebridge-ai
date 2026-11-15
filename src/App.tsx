import React from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { AppBackground } from './components/layout/AppBackground.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { ToastContainer } from './components/common/ToastContainer.tsx';
import { DemoScenarioDrawer } from './components/common/DemoScenarioDrawer.tsx';

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

const AppContent: React.FC = () => {
  const { activeView } = useApp();

  const renderActiveView = () => {
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
      {/* Background with Reference Poster Warm Peach Grid and Ambient Glows */}
      <AppBackground />

      {/* Global Navigation & Disclaimer */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
        {renderActiveView()}
      </main>

      {/* Minimal Anti-Slop Footer */}
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

      {/* Slide-over Scenario Drawer & Toast Container */}
      <DemoScenarioDrawer />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
