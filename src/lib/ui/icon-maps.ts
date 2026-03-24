import type { LucideIcon } from "lucide-react";
import {
  Bus,
  CircleDollarSign,
  CreditCard,
  Fuel,
  HeartPulse,
  Home,
  Landmark,
  Receipt,
  Shirt,
  Sparkles,
  Utensils,
  Wallet
} from "lucide-react";

type IconMapEntry = {
  match: RegExp;
  icon: LucideIcon;
};

const categoryIconMap: IconMapEntry[] = [
  { match: /(comida|almuerzo|cena|super|mercado|restaurant)/i, icon: Utensils },
  { match: /(transporte|uber|taxi|metro|bus)/i, icon: Bus },
  { match: /(bencina|combustible|gasolina)/i, icon: Fuel },
  { match: /(ropa|vestuario)/i, icon: Shirt },
  { match: /(salud|medic|farmacia|doctor|clinica)/i, icon: HeartPulse },
  { match: /(hogar|casa|arriendo)/i, icon: Home },
  { match: /(servicio|luz|agua|internet|telefono)/i, icon: Receipt },
  { match: /(ocio|entret|cine|bar|viaje)/i, icon: Sparkles },
  { match: /(empresa|negocio|publicidad|marketing)/i, icon: Landmark }
];

const accountIconMap: IconMapEntry[] = [
  { match: /(efectivo|billetera|caja)/i, icon: Wallet },
  { match: /(credito|crédito|visa|master|cmr|tarjeta)/i, icon: CreditCard },
  { match: /(debito|débito|cuenta|banco|corriente|vista)/i, icon: Landmark }
];

export function getCategoryIcon(name?: string | null): LucideIcon {
  if (!name) return CircleDollarSign;
  return categoryIconMap.find((entry) => entry.match.test(name))?.icon ?? CircleDollarSign;
}

export function getAccountIcon(name?: string | null): LucideIcon {
  if (!name) return Wallet;
  return accountIconMap.find((entry) => entry.match.test(name))?.icon ?? Wallet;
}
