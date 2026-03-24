export const appConfig = {
  region: {
    locale: "es-CL",
    currencyCode: "CLP",
    currencySymbol: "$",
    dateFormat: "dd-MM-yyyy"
  },
  modules: [
    "Dashboard",
    "Movimientos",
    "Gastos fijos",
    "Gastos variables",
    "Deudores",
    "Reembolsos",
    "IA",
    "Reportes",
    "Configuración"
  ],
  businessUnits: [
    { id: "consolidado", name: "Consolidado", type: "overview" },
    { id: "personal", name: "Personal", type: "personal" },
    { id: "look-hair", name: "Look Hair", type: "business" },
    { id: "house-of-hair", name: "House of Hair", type: "business" },
    { id: "detalles-chile", name: "Detalles Chile", type: "business" }
  ],
  categories: [
    "Arriendo",
    "Publicidad",
    "Sueldos",
    "Compras",
    "Transporte",
    "Insumos",
    "Servicios",
    "Software",
    "Vivienda",
    "Ventas",
    "Marketing digital",
    "Regalos y flores"
  ],
  accounts: [
    "Cuenta Vista Banco de Chile",
    "Cuenta Corriente BCI",
    "Tarjeta CMR Falabella",
    "Cuenta Empresa BancoEstado"
  ],
  transactionOrigins: ["Personal", "Empresa"],
  reviewStatuses: ["Pendiente", "Revisado", "Observado"],
  reimbursementStatuses: ["Pendiente de reembolso", "Reembolsado", "No aplica"],
  debtorStatuses: ["Pendiente", "Abonando", "Pagado", "Atrasado"],
  fixedExpenseFrequencies: ["Mensual", "Quincenal", "Semanal"],
  suggestedAiQuestions: [
    "¿Cuánto gasté en Uber este mes?",
    "¿Cuánto dinero puse en Look Hair y House of Hair?",
    "¿Qué negocio gastó más en marzo?",
    "¿Cuánto me deben hoy?",
    "¿Dónde puedo ahorrar este mes en Chile?"
  ]
} as const;

export type BusinessUnitId = (typeof appConfig.businessUnits)[number]["id"];
export type TransactionOrigin = (typeof appConfig.transactionOrigins)[number];
export type ReviewStatus = (typeof appConfig.reviewStatuses)[number];
export type ReimbursementStatus = (typeof appConfig.reimbursementStatuses)[number];
