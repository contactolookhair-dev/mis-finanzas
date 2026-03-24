import { appConfig } from "@/lib/config/app-config";
import { editableConfigSections } from "@/lib/config/editable-sections";

export const businessUnits = appConfig.businessUnits;
export const categories = appConfig.categories;
export const accounts = appConfig.accounts;
export const transactionOrigins = appConfig.transactionOrigins;
export const reviewStatuses = appConfig.reviewStatuses;
export const reimbursementStatuses = appConfig.reimbursementStatuses;
export const debtorStatuses = appConfig.debtorStatuses;
export const fixedExpenseFrequencies = appConfig.fixedExpenseFrequencies;
export const suggestedAiQuestions = appConfig.suggestedAiQuestions;

export const dashboardStats = [
  { label: "Saldo total", value: 12450000, detail: "Todas tus cuentas y cajas" },
  { label: "Ingresos del mes", value: 7860000, detail: "Marzo 2026" },
  { label: "Egresos del mes", value: 4590000, detail: "Incluye negocios y personal" },
  { label: "Flujo neto", value: 3270000, detail: "Ahorro operativo del mes" },
  { label: "Gastos fijos", value: 2140000, detail: "Compromisos recurrentes" },
  { label: "Gastos variables", value: 2450000, detail: "Operación y estilo de vida" },
  { label: "Me deben", value: 980000, detail: "Pendiente por cobrar" },
  { label: "Puse en negocios", value: 1640000, detail: "Pagado con fondos personales" },
  { label: "Sin clasificar", value: 276000, detail: "Movimientos por revisar" }
];

export const categorySpend = [
  { name: "Sueldos", value: 1120000 },
  { name: "Publicidad digital", value: 780000 },
  { name: "Arriendo local", value: 650000 },
  { name: "Compras en Chile", value: 590000 },
  { name: "Transporte y movilización", value: 240000 }
];

export const unitSpend = [
  { name: "Personal", value: 920000 },
  { name: "Look Hair", value: 1540000 },
  { name: "House of Hair", value: 1190000 },
  { name: "Detalles Chile", value: 940000 }
];

export const cashFlowSeries = [
  { month: "Oct", ingresos: 6200000, egresos: 4080000 },
  { month: "Nov", ingresos: 6720000, egresos: 4460000 },
  { month: "Dic", ingresos: 8580000, egresos: 6110000 },
  { month: "Ene", ingresos: 7020000, egresos: 4710000 },
  { month: "Feb", ingresos: 7340000, egresos: 4490000 },
  { month: "Mar", ingresos: 7860000, egresos: 4590000 }
];

export const mixSeries = [
  { name: "Personal", value: 34 },
  { name: "Empresa", value: 66 }
];

export const insightCards = [
  {
    title: "Publicidad subio 28%",
    description: "Look Hair aumento inversion en Meta Ads y Google Ads frente al promedio de los ultimos 3 meses."
  },
  {
    title: "Vencen 3 pagos esta semana",
    description: "Arriendo, software de reservas y proveedor floral se concentran antes del viernes."
  },
  {
    title: "Tienes $1.640.000 puestos por ti",
    description: "La mayor exposicion personal esta en Look Hair y House of Hair."
  }
];

export const transactions = [
  {
    id: "tx1",
    date: "2026-03-18",
    description: "Meta Ads Look Hair - campaña Providencia",
    amount: -185000,
    type: "egreso",
    account: "Tarjeta CMR Falabella",
    category: "Publicidad",
    businessUnit: "Look Hair",
    origin: "Empresa",
    reimbursable: true,
    reviewStatus: "Pendiente"
  },
  {
    id: "tx2",
    date: "2026-03-18",
    description: "Uber Centro Santiago",
    amount: -22900,
    type: "egreso",
    account: "Cuenta Vista Banco de Chile",
    category: "Transporte",
    businessUnit: "House of Hair",
    origin: "Empresa",
    reimbursable: true,
    reviewStatus: "Revisado"
  },
  {
    id: "tx3",
    date: "2026-03-17",
    description: "Transferencia cliente ramos y rosas eternas",
    amount: 129900,
    type: "ingreso",
    account: "Cuenta Empresa BancoEstado",
    category: "Ventas",
    businessUnit: "Detalles Chile",
    origin: "Empresa",
    reimbursable: false,
    reviewStatus: "Revisado"
  },
  {
    id: "tx4",
    date: "2026-03-16",
    description: "Arriendo depto comuna de Ñuñoa",
    amount: -620000,
    type: "egreso",
    account: "Cuenta Corriente BCI",
    category: "Vivienda",
    businessUnit: "Personal",
    origin: "Personal",
    reimbursable: false,
    reviewStatus: "Revisado"
  },
  {
    id: "tx5",
    date: "2026-03-15",
    description: "Compra insumos salon - shampoo, tintes y peinados",
    amount: -148000,
    type: "egreso",
    account: "Tarjeta CMR Falabella",
    category: "Insumos",
    businessUnit: "Look Hair",
    origin: "Empresa",
    reimbursable: true,
    reviewStatus: "Pendiente"
  }
];

export const fixedExpenses = [
  {
    id: "fx1",
    name: "Arriendo local Look Hair",
    amount: 780000,
    frequency: "Mensual",
    dueDate: 5,
    category: "Arriendo",
    businessUnit: "Look Hair",
    account: "Cuenta Empresa BancoEstado",
    status: "Pendiente"
  },
  {
    id: "fx2",
    name: "Software de agenda y reservas",
    amount: 45900,
    frequency: "Mensual",
    dueDate: 8,
    category: "Software",
    businessUnit: "House of Hair",
    account: "Tarjeta CMR Falabella",
    status: "Pagado"
  },
  {
    id: "fx3",
    name: "Internet fibra hogar/oficina",
    amount: 26990,
    frequency: "Mensual",
    dueDate: 11,
    category: "Servicios",
    businessUnit: "Personal",
    account: "Cuenta Vista Banco de Chile",
    status: "Pendiente"
  }
];

export const debtors = [
  {
    id: "db1",
    name: "Camila Soto",
    reason: "Prestamo personal",
    totalAmount: 350000,
    paidAmount: 120000,
    pendingAmount: 230000,
    startDate: "2026-01-09",
    estimatedPayDate: "2026-04-05",
    status: "Abonando"
  },
  {
    id: "db2",
    name: "Proveedor evento House of Hair",
    reason: "Reembolso pendiente por activacion en Viña del Mar",
    totalAmount: 630000,
    paidAmount: 0,
    pendingAmount: 630000,
    startDate: "2026-02-28",
    estimatedPayDate: "2026-03-20",
    status: "Atrasado"
  }
];

export const reimbursements = [
  {
    id: "rb1",
    date: "2026-03-18",
    businessUnit: "Look Hair",
    concept: "Meta Ads Look Hair - campaña Providencia",
    amount: 185000,
    account: "Tarjeta CMR Falabella",
    status: "Pendiente de reembolso"
  },
  {
    id: "rb2",
    date: "2026-03-15",
    businessUnit: "Look Hair",
    concept: "Compra insumos salon - shampoo, tintes y peinados",
    amount: 148000,
    account: "Tarjeta CMR Falabella",
    status: "Pendiente de reembolso"
  },
  {
    id: "rb3",
    date: "2026-03-12",
    businessUnit: "House of Hair",
    concept: "Canva Pro + diseno promociones",
    amount: 98990,
    account: "Cuenta Vista Banco de Chile",
    status: "Reembolsado"
  }
];

export const reportCards = [
  { label: "Ingresos", value: 7860000 },
  { label: "Egresos", value: 4590000 },
  { label: "Flujo neto", value: 3270000 },
  { label: "Cuentas por cobrar", value: 980000 }
];

export const configurationSections = editableConfigSections;
