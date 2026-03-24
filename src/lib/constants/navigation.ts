import {
  Coins,
  CreditCard,
  HandCoins,
  Home,
  Wallet
} from "lucide-react";

export const navigationItems = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/gastos", label: "Gastos", icon: CreditCard },
  { href: "/deudas", label: "Deudas", icon: HandCoins },
  { href: "/resumen", label: "Resumen", icon: Wallet },
  { href: "/configuracion", label: "Admin", icon: Coins, hidden: true },
  { href: "/ia", label: "IA", icon: Coins, hidden: true },
  { href: "/reportes", label: "Reportes", icon: Coins, hidden: true },
  { href: "/reembolsos", label: "Reembolsos", icon: Coins, hidden: true },
  { href: "/gastos-fijos", label: "Gastos fijos", icon: Coins, hidden: true },
  { href: "/gastos-variables", label: "Variables", icon: Coins, hidden: true }
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof Home;
  hidden?: boolean;
}>;
