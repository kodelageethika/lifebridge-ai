import React from 'react';

export const AppBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none"
    >
      {/* Base Canvas */}
      <div className="absolute inset-0 bg-[#F8F5EF] dark:bg-[#0F1722] transition-colors duration-300" />

      {/* Grid Pattern matching the World Organ Donation Day Reference Poster */}
      <div className="absolute inset-0 bg-grid-poster opacity-35 dark:opacity-20" />

      {/* Subtle organic radial glows */}
      <div className="absolute -top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#E98F83]/10 dark:bg-[#E98F83]/5 blur-3xl" />
      <div className="absolute top-[40%] -right-[10%] w-[600px] h-[600px] rounded-full bg-[#F8E8E3]/60 dark:bg-[#1E2E42]/30 blur-3xl" />
      <div className="absolute -bottom-[10%] left-[20%] w-[600px] h-[600px] rounded-full bg-[#F8E8E3]/40 dark:bg-[#0F1D2E]/50 blur-3xl" />

      {/* Subtle floating organic anatomical silhouettes in the margins */}
      <svg
        className="absolute top-24 right-8 w-64 h-64 text-[#E05A5A]/5 dark:text-[#FF6B6B]/4 transform rotate-12"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M50 88s-35-22-35-46c0-14 11-22 22-22 7 0 13 4 13 4s6-4 13-4c11 0 22 8 22 22 0 24-35 46-35 46z" />
      </svg>
    </div>
  );
};
