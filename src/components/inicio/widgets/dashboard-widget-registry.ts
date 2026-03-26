import type { ReactNode } from "react";

export type WidgetSize = "compact" | "standard" | "featured";

export type InicioWidgetId =
  | "healthToday"
  | "creditAttention"
  | "coach"
  | "priorities"
  | "debtors"
  | "upcomingInstallments"
  | "upcomingPayables"
  | "overduePendings"
  | "recentMovements"
  | "monthFlow"
  | "financialHealth"
  | "calculator"
  | "aiFinancial"
  | "globalAlerts";

export type InicioWidgetCategory =
  | "Resumen"
  | "Tarjetas"
  | "Pendientes"
  | "Movimientos"
  | "Alertas"
  | "Herramientas"
  | "Planeacion";

export type InicioWidgetPlacement = "executive" | "modular" | "footer";

export type InicioWidgetMobileBehavior =
  | "summary-first"
  | "stack"
  | "compact-list"
  | "expandable"
  | "cta-first";

export type InicioWidgetRenderer = (size: WidgetSize) => ReactNode;

export type InicioWidgetDefinitionBase = {
  widgetId: InicioWidgetId;
  title: string;
  description: string;
  category: InicioWidgetCategory;
  enabledByDefault: boolean;
  supportedSizes: WidgetSize[];
  emptyState: {
    title: string;
    description: string;
  };
  priority: number;
  mobileBehavior: InicioWidgetMobileBehavior;
  placement: InicioWidgetPlacement;
};

export type InicioWidgetDefinition = InicioWidgetDefinitionBase & {
  component: InicioWidgetRenderer;
};

export const inicioWidgetDefinitions: InicioWidgetDefinitionBase[] = [
  {
    widgetId: "healthToday",
    title: "Salud financiera hoy",
    description: "Disponible, deuda y pendientes en una sola mirada.",
    category: "Resumen",
    enabledByDefault: true,
    supportedSizes: ["standard", "featured"],
    emptyState: {
      title: "Sin resumen disponible",
      description: "Cuando haya movimientos y cuentas veras aqui tu lectura ejecutiva del dia."
    },
    priority: 10,
    mobileBehavior: "summary-first",
    placement: "executive"
  },
  {
    widgetId: "creditAttention",
    title: "Tarjetas que requieren atencion",
    description: "Tarjetas con cupo alto, intereses, avances o importaciones dudosas.",
    category: "Tarjetas",
    enabledByDefault: true,
    supportedSizes: ["standard", "featured"],
    emptyState: {
      title: "Sin alertas de tarjetas",
      description: "Tus tarjetas apareceran aqui cuando haya algo importante que revisar."
    },
    priority: 20,
    mobileBehavior: "compact-list",
    placement: "executive"
  },
  {
    widgetId: "coach",
    title: "Tu nota del mes",
    description: "Resumen humano y corto con foco en tus habitos del periodo.",
    category: "Resumen",
    enabledByDefault: true,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin nota del mes",
      description: "Cuando haya suficiente actividad, veremos aqui una lectura mas humana."
    },
    priority: 30,
    mobileBehavior: "stack",
    placement: "executive"
  },
  {
    widgetId: "priorities",
    title: "Prioridades del mes",
    description: "Checklist corto para saber que mirar primero.",
    category: "Alertas",
    enabledByDefault: true,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin prioridades urgentes",
      description: "Cuando haya algo importante por hacer, este bloque lo resumira."
    },
    priority: 40,
    mobileBehavior: "compact-list",
    placement: "modular"
  },
  {
    widgetId: "debtors",
    title: "Mis deudores",
    description: "Personas que te deben y cuotas del mes.",
    category: "Pendientes",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin deudores pendientes",
      description: "Activalo para seguir a quienes te deben dinero."
    },
    priority: 50,
    mobileBehavior: "compact-list",
    placement: "modular"
  },
  {
    widgetId: "upcomingInstallments",
    title: "Cobros proximos",
    description: "Cuotas por cobrar y vencimientos cercanos.",
    category: "Pendientes",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin cobros proximos",
      description: "Aqui veras las proximas cuotas por cobrar."
    },
    priority: 60,
    mobileBehavior: "compact-list",
    placement: "modular"
  },
  {
    widgetId: "upcomingPayables",
    title: "Cuotas proximas",
    description: "Pagos por hacer y proximos vencimientos.",
    category: "Pendientes",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin cuotas por pagar",
      description: "Activalo para seguir tus vencimientos proximos."
    },
    priority: 70,
    mobileBehavior: "compact-list",
    placement: "modular"
  },
  {
    widgetId: "overduePendings",
    title: "Vencidos",
    description: "Pendientes vencidos: por cobrar y por pagar.",
    category: "Alertas",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin vencidos",
      description: "Cuando haya algo atrasado, este bloque lo mostrara."
    },
    priority: 80,
    mobileBehavior: "compact-list",
    placement: "modular"
  },
  {
    widgetId: "recentMovements",
    title: "Movimientos recientes",
    description: "Ultimos gastos e ingresos registrados.",
    category: "Movimientos",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin movimientos",
      description: "Activalo para tener tu actividad reciente a mano."
    },
    priority: 90,
    mobileBehavior: "stack",
    placement: "modular"
  },
  {
    widgetId: "monthFlow",
    title: "Flujo del mes",
    description: "Ingresos, gastos y neto del periodo.",
    category: "Resumen",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin flujo mensual",
      description: "Veras aqui una lectura corta de ingresos y gastos del mes."
    },
    priority: 100,
    mobileBehavior: "summary-first",
    placement: "modular"
  },
  {
    widgetId: "financialHealth",
    title: "Salud financiera",
    description: "Semaforo, alertas y foco del mes.",
    category: "Resumen",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard", "featured"],
    emptyState: {
      title: "Sin salud financiera",
      description: "Activalo para ver tu semaforo y foco del mes."
    },
    priority: 110,
    mobileBehavior: "summary-first",
    placement: "modular"
  },
  {
    widgetId: "calculator",
    title: "Calculadora",
    description: "Haz cuentas rapidas sin salir de Inicio.",
    category: "Herramientas",
    enabledByDefault: false,
    supportedSizes: ["compact", "standard"],
    emptyState: {
      title: "Calculadora desactivada",
      description: "Activa este widget para hacer cuentas cortas al vuelo."
    },
    priority: 120,
    mobileBehavior: "cta-first",
    placement: "modular"
  },
  {
    widgetId: "aiFinancial",
    title: "IA financiera",
    description: "Analisis bajo demanda con tus datos reales.",
    category: "Planeacion",
    enabledByDefault: false,
    supportedSizes: ["standard", "featured"],
    emptyState: {
      title: "IA financiera desactivada",
      description: "Activa este widget si quieres analisis guiado bajo demanda."
    },
    priority: 130,
    mobileBehavior: "stack",
    placement: "modular"
  },
  {
    widgetId: "globalAlerts",
    title: "Alertas importantes",
    description: "Lo mas importante que deberias revisar hoy.",
    category: "Alertas",
    enabledByDefault: true,
    supportedSizes: ["standard", "featured"],
    emptyState: {
      title: "Sin alertas",
      description: "Cuando aparezca algo importante, este bloque lo priorizara."
    },
    priority: 140,
    mobileBehavior: "compact-list",
    placement: "footer"
  }
];

export const inicioWidgetDefinitionMap = Object.fromEntries(
  inicioWidgetDefinitions.map((definition) => [definition.widgetId, definition])
) as Record<InicioWidgetId, InicioWidgetDefinitionBase>;

export const defaultInicioWidgetOrder = inicioWidgetDefinitions.map(
  (definition) => definition.widgetId
);

export const defaultInicioVisibleWidgets = inicioWidgetDefinitions
  .filter((definition) => definition.enabledByDefault)
  .map((definition) => definition.widgetId);

export function buildInicioWidgetRegistry(
  renderers: Record<InicioWidgetId, InicioWidgetRenderer>
): Record<InicioWidgetId, InicioWidgetDefinition> {
  return Object.fromEntries(
    inicioWidgetDefinitions.map((definition) => [
      definition.widgetId,
      {
        ...definition,
        component: renderers[definition.widgetId]
      }
    ])
  ) as Record<InicioWidgetId, InicioWidgetDefinition>;
}
