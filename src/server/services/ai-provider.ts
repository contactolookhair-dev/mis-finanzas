import { z } from "zod";

export const llmInterpretedQuerySchema = z.object({
  intent: z.enum([
    "overview",
    "analysis",
    "by_business_unit",
    "by_category",
    "personal_money_in_business",
    "monthly_trend",
    "transactions_lookup",
    "insights"
  ]),
  dateRange: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    })
    .optional(),
  businessUnitName: z.string().optional(),
  categoryName: z.string().optional(),
  transactionType: z.enum(["INGRESO", "EGRESO"]).optional(),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).optional(),
  searchText: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type LLMInterpretedQuery = z.infer<typeof llmInterpretedQuerySchema>;

export type AIInterpretationInput = {
  systemPrompt?: string;
  question: string;
  tone?: string;
  detailLevel?: string;
  businessUnits: string[];
  categories: string[];
  nowIso: string;
};

export type AIGenerationInput = {
  systemPrompt?: string;
  question: string;
  tone?: string;
  detailLevel?: string;
  contextData: unknown;
  draftAnswer?: string;
};

export type AIGenerationOutput = {
  text: string;
};

export interface AIProvider {
  readonly kind: string;
  interpret(input: AIInterpretationInput): Promise<LLMInterpretedQuery | null>;
  generate(input: AIGenerationInput): Promise<AIGenerationOutput>;
}

export class InternalOnlyAIProvider implements AIProvider {
  readonly kind = "internal";

  async interpret(): Promise<LLMInterpretedQuery | null> {
    return null;
  }

  async generate(_input: AIGenerationInput): Promise<AIGenerationOutput> {
    return {
      text: _input.draftAnswer ?? "Respuesta basada en analítica interna verificada."
    };
  }
}

type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export class OpenAICompatibleProvider implements AIProvider {
  readonly kind = "openai";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  }

  async interpret(input: AIInterpretationInput): Promise<LLMInterpretedQuery | null> {
    const response = await this.createChatCompletion({
      messages: [
        {
          role: "system",
          content:
            `${input.systemPrompt ?? "Interpreta consultas financieras sin inventar datos."}\n` +
            "Tu trabajo es extraer una estructura JSON valida. No calcules métricas, no recomiendes acciones y no respondas texto fuera del JSON."
        },
        {
          role: "user",
          content:
            `Fecha actual: ${input.nowIso}\n` +
            `Unidades disponibles: ${input.businessUnits.join(", ")}\n` +
            `Categorias disponibles: ${input.categories.join(", ")}\n` +
            `Consulta: ${input.question}\n` +
            "Devuelve JSON con: intent, dateRange, businessUnitName, categoryName, transactionType, financialOrigin, searchText, confidence."
        }
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "financial_query_interpretation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                enum: [
                  "overview",
                  "analysis",
                  "by_business_unit",
                  "by_category",
                  "personal_money_in_business",
                  "monthly_trend",
                  "transactions_lookup",
                  "insights"
                ]
              },
              dateRange: {
                type: "object",
                additionalProperties: false,
                properties: {
                  startDate: { type: "string" },
                  endDate: { type: "string" }
                }
              },
              businessUnitName: { type: "string" },
              categoryName: { type: "string" },
              transactionType: { type: "string", enum: ["INGRESO", "EGRESO"] },
              financialOrigin: { type: "string", enum: ["PERSONAL", "EMPRESA"] },
              searchText: { type: "string" },
              confidence: { type: "number" }
            },
            required: ["intent"]
          }
        }
      }
    });

    return llmInterpretedQuerySchema.parse(response);
  }

  async generate(input: AIGenerationInput): Promise<AIGenerationOutput> {
    const response = await this.createChatCompletion({
      messages: [
        {
          role: "system",
          content:
            `${input.systemPrompt ?? "Responde como asistente financiero."}\n` +
            `Tono: ${input.tone ?? "claro-profesional"}.\n` +
            `Nivel de detalle: ${input.detailLevel ?? "medio"}.\n` +
            "Nunca inventes cifras. Usa solo el contexto entregado. Limítate a reescribir y explicar resultados ya verificados, sin realizar cálculos financieros nuevos."
        },
        {
          role: "user",
          content:
            `Pregunta: ${input.question}\n` +
            `Borrador sugerido:\n${input.draftAnswer ?? "Sin borrador"}\n` +
            `Contexto verificado:\n${JSON.stringify(input.contextData, null, 2)}\n` +
            "Redacta una respuesta financiera clara, humana y util. Si hay borrador, mejóralo sin inventar cifras."
        }
      ]
    });

    return {
      text: typeof response === "string" ? response : JSON.stringify(response)
    };
  }

  private async createChatCompletion(input: {
    messages: Array<{ role: "system" | "user"; content: string }>;
    responseFormat?: Record<string, unknown>;
  }) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        messages: input.messages,
        response_format: input.responseFormat
      })
    });

    if (!res.ok) {
      throw new Error(`AI provider error: ${res.status}`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI provider returned empty content");
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      return content;
    }
  }
}

export function createAIProvider(settings: {
  modelProvider: string;
  modelName: string;
}) {
  const provider = settings.modelProvider.toLowerCase();
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAICompatibleProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: settings.modelName || process.env.OPENAI_MODEL || "gpt-4.1-mini"
    });
  }

  return new InternalOnlyAIProvider();
}
