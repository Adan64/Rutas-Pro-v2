import React from 'react';
import { useRutasStore } from '@/store/useRutasStore';
import { Check } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Cargar' },
  { id: 2, label: 'Configurar' },
  { id: 3, label: 'Resultados' },
];

export const StepsBar = () => {
  const { currentStep } = useRutasStore();

  return (
    <div className="sticky top-[65px] z-[90] w-full border-b border-[var(--border)] bg-gradient-to-b from-[var(--bg2)] to-[var(--background)] px-6 py-4">
      <div className="mx-auto flex max-w-[1400px] items-center justify-center">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  currentStep === step.id
                    ? 'scale-110 border-[var(--accent)] bg-gradient-to-br from-[var(--accent)] to-[#4f46e5] text-white shadow-[0_0_24px_var(--accent-glow)]'
                    : currentStep > step.id
                    ? 'border-[var(--green)] bg-[var(--green)] text-white'
                    : 'border-[var(--border2)] bg-[var(--card)] text-[var(--text-muted)]'
                }`}
              >
                {currentStep > step.id ? <Check size={18} /> : <span className="text-sm font-bold">{step.id}</span>}
              </div>
              <span
                className={`text-xs font-semibold transition-colors duration-300 ${
                  currentStep === step.id ? 'text-[var(--accent-hover)]' : currentStep > step.id ? 'text-[var(--green)]' : 'text-[var(--text-faint)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 mb-6 h-0.5 w-16 rounded-full transition-colors duration-500 ${
                  currentStep > step.id ? 'bg-[var(--green)]' : 'bg-[var(--border)]'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
