"use client";

import { isNewExpenseWizardEnabled } from "@/lib/feature-flags";
import { NewExpenseWizardModal } from "@/components/movimientos/new-expense-wizard-modal";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialMovementType?: "GASTO" | "INGRESO";
};

export function TransactionEntryModal(props: Props) {
  const handleSuccess = () => {
    try {
      window.dispatchEvent(new Event("mis-finanzas:accounts-changed"));
    } catch {
      // noop
    }
    props.onSuccess?.();
  };

  if (isNewExpenseWizardEnabled()) {
    return <NewExpenseWizardModal {...props} onSuccess={handleSuccess} />;
  }
  return <NewTransactionModal {...props} onSuccess={handleSuccess} />;
}
