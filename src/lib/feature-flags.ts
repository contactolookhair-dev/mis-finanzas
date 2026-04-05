export function isNewExpenseWizardEnabled() {
  // Default: enabled (new wizard is now the primary flow).
  // Emergency fallback: set either env var to "false".
  // Client components must use NEXT_PUBLIC_* to read flags at runtime, but we also support the server var
  // to keep config consistent across environments.
  const value =
    process.env.NEXT_PUBLIC_ENABLE_NEW_EXPENSE_WIZARD ??
    process.env.ENABLE_NEW_EXPENSE_WIZARD ??
    "";
  if (value === "false") return false;
  if (value === "true") return true;
  return true;
}

export function isNewExpenseWizardDemoMode() {
  return process.env.NEXT_PUBLIC_NEW_EXPENSE_WIZARD_DEMO_MODE === "true";
}
