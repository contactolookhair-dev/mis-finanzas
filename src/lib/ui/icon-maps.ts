import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BadgeDollarSign,
  CarFront,
  CircleDollarSign,
  CreditCard,
  Building2,
  Fuel,
  HeartPulse,
  Home,
  Landmark,
  ReceiptText,
  PiggyBank,
  Shirt,
  Sparkles,
  ShoppingBag,
  Utensils,
  Wallet
} from "lucide-react";

type IconMapEntry = {
  match: RegExp;
  icon: LucideIcon;
};

const categoryIconMap: IconMapEntry[] = [
  { match: /(comida|almuerzo|cena|super|mercado|restaurant)/i, icon: Utensils },
  { match: /(transporte|uber|taxi|metro|bus)/i, icon: CarFront },
  { match: /(bencina|combustible|gasolina)/i, icon: Fuel },
  { match: /(ropa|vestuario)/i, icon: ShoppingBag },
  { match: /(salud|medic|farmacia|doctor|clinica)/i, icon: HeartPulse },
  { match: /(hogar|casa|arriendo)/i, icon: Home },
  { match: /(servicio|luz|agua|internet|telefono)/i, icon: ReceiptText },
  { match: /(ocio|entret|cine|bar|viaje)/i, icon: Sparkles },
  { match: /(empresa|negocio|publicidad|marketing)/i, icon: Landmark }
];

const accountIconMap: IconMapEntry[] = [
  { match: /(efectivo|billetera|caja)/i, icon: Banknote },
  { match: /(ahorro|ahorros|inversi[oó]n|reserva)/i, icon: PiggyBank },
  { match: /(credito|crédito|visa|master|cmr|tarjeta)/i, icon: CreditCard },
  { match: /(debito|débito|cuenta|banco|corriente|vista)/i, icon: Building2 },
  { match: /(digital|virtual|online|wallet|tenpo|rappi|mercado pago|paypal)/i, icon: BadgeDollarSign },
  { match: /(empresa|negocio|corporativo)/i, icon: Landmark }
];

export function getCategoryIcon(name?: string | null): LucideIcon {
  if (!name) return CircleDollarSign;
  return categoryIconMap.find((entry) => entry.match.test(name))?.icon ?? CircleDollarSign;
}

export function getAccountIcon(name?: string | null): LucideIcon {
  if (!name) return Wallet;
  return accountIconMap.find((entry) => entry.match.test(name))?.icon ?? Wallet;
}
