import React from 'react';
import { OrganType } from '../../types/index.ts';
import { Heart, Activity, Wind, Eye, Droplet, Shield } from 'lucide-react';

interface OrganTagProps {
  organType: OrganType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const OrganTag: React.FC<OrganTagProps> = ({
  organType,
  size = 'md',
  showIcon = true,
}) => {
  const getOrganDetails = (type: OrganType) => {
    switch (type) {
      case 'kidney':
        return {
          label: 'Kidney',
          icon: Activity,
          colorClass: 'text-[#C84B4B] dark:text-[#FF8A8A] bg-[#FFEAEA] dark:bg-[#2A1818] border-[#FFD0D0] dark:border-[#4A2626]',
        };
      case 'liver':
        return {
          label: 'Liver',
          icon: Droplet,
          colorClass: 'text-[#B85C00] dark:text-[#FFA347] bg-[#FFF2E6] dark:bg-[#2C1D0D] border-[#FFD9B3] dark:border-[#523315]',
        };
      case 'heart':
        return {
          label: 'Heart',
          icon: Heart,
          colorClass: 'text-[#B83232] dark:text-[#FF6666] bg-[#FFEBEB] dark:bg-[#301212] border-[#FFCCCC] dark:border-[#591C1C]',
        };
      case 'lung':
        return {
          label: 'Lungs',
          icon: Wind,
          colorClass: 'text-[#286090] dark:text-[#78B4E6] bg-[#EEF6FC] dark:bg-[#122436] border-[#CCE4F7] dark:border-[#204060]',
        };
      case 'pancreas':
        return {
          label: 'Pancreas',
          icon: Shield,
          colorClass: 'text-[#6D4C8C] dark:text-[#C5A3E6] bg-[#F7F0FB] dark:bg-[#241731] border-[#EADBF3] dark:border-[#43275A]',
        };
      case 'intestine':
        return {
          label: 'Intestine',
          icon: Eye,
          colorClass: 'text-[#2D6A4F] dark:text-[#74C69D] bg-[#EAF5EF] dark:bg-[#132A1F] border-[#CDE9DA] dark:border-[#224A37]',
        };
      default:
        return {
          label: organType,
          icon: Activity,
          colorClass: 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const { label, icon: Icon, colorClass } = getOrganDetails(organType);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border tracking-wide whitespace-nowrap shrink-0 transition-colors ${colorClass} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon size={iconSizes[size]} className="shrink-0" />}
      <span>{label}</span>
    </span>
  );
};
