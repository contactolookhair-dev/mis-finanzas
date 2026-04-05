"use client";

import { isNewExpenseWizardEnabled } from "@/lib/feature-flags";
import { NewExpenseWizardModal } from "@/components/movimientos/new-expense-wizard-modal";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function TransactionEntryModal(props: Props) {
  if (isNewExpenseWizardEnabled()) {
    return <NewExpenseWizardModal {...props} />;
  }
  return <NewTransactionModal {...props} />;
}

