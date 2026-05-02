'use client';

import { Header } from "@/components/layout/Header";
import { StepsBar } from "@/components/layout/StepsBar";
import { Step1Upload } from "@/components/steps/Step1Upload";
import { Step2Config } from "@/components/steps/Step2Config";
import { Step3Results } from "@/components/steps/Step3Results";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useRutasStore } from "@/store/useRutasStore";

export default function Home() {
  const { currentStep } = useRutasStore();

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden">
      <Header />
      <StepsBar />
      
      <main className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
        <div className="mx-auto h-full max-w-[1400px]">
          {currentStep === 1 && <Step1Upload />}
          {currentStep === 2 && <Step2Config />}
          {currentStep === 3 && <Step3Results />}
        </div>
      </main>

      <LoadingOverlay />
    </div>
  );
}
