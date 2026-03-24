import {
  ArrowLeftRight,
  BarChart3,
  Bot,
  CreditCard,
  HandCoins,
  Home,
  Receipt,
  Settings2
} from "lucide-react";

export const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/gastos-fijos", label: "Gastos fijos", icon: CreditCard },
  { href: "/gastos-variables", label: "Variables", icon: Receipt },
  { href: "/deudores", label: "Me deben", icon: HandCoins },
  { href: "/reembolsos", label: "Reembolsos", icon: CreditCard },
  { href: "/ia", label: "IA", icon: Bot },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/configuracion", label: "Config", icon: Settings2 }
] as const;
