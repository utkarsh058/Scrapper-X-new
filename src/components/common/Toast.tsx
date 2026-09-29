'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  XCircle, 
  X 
} from 'lucide-react';
import { ToastMessage } from '@/types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let border = 'border-emerald-200';
        let bg = 'bg-white';
        let iconColor = 'text-emerald-700';

        if (toast.type === 'info') {
          Icon = Info;
          border = 'border-teal-200';
          iconColor = 'text-teal-700';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          border = 'border-amber-200';
          iconColor = 'text-amber-700';
        } else if (toast.type === 'error') {
          Icon = XCircle;
          border = 'border-rose-200';
          iconColor = 'text-rose-700';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border ${border} ${bg} shadow-popover animate-fade-in`}
          >
            <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <h5 className="text-[12.5px] font-semibold text-[#171717] leading-tight">
                {toast.title}
              </h5>
              {toast.description && (
                <p className="text-[11.5px] text-[#6B7280] mt-0.5 leading-snug">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#9CA3AF] hover:text-[#171717] p-0.5 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
