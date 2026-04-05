"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatPill } from "@/components/ui/stat-pill";
import { AddExpenseWizard } from "@/components/lab/add-expense-wizard";
import { isNewExpenseWizardDemoMode } from "@/lib/feature-flags";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function NewExpenseWizardModal({ open, onOpenChange, onSuccess }: Props) {
  useLockBodyScroll(open);

  if (!open) return null;

  const demoMode = isNewExpenseWizardDemoMode();

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 p-0 sm:items-center sm:p-4">
      <div className="glass-surface safe-pb w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.9)_100%)] p-4 animate-modal-sheet ring-1 ring-white/35 sm:max-w-3xl sm:rounded-[32px] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatPill tone="premium">Wizard</StatPill>
            {demoMode ? (
              <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
                DEMO
              </StatPill>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-10 w-10 rounded-full p-0"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <AddExpenseWizard
          mode={demoMode ? "demo" : "real"}
          onSaved={() => {
            onSuccess?.();
          }}
          onDone={() => {
            onSuccess?.();
            onOpenChange(false);
          }}
        />
      </div>
    </div>
  );
}
