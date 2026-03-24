import type { AIProvider } from "@/server/services/ai-provider";

export async function composeFinancialAnswer(input: {
  provider: AIProvider;
  baseAnswer: string;
  draftAnswer?: string;
  systemPrompt?: string;
  question: string;
  tone?: string;
  detailLevel?: string;
  contextData: unknown;
}) {
  const generated = await input.provider.generate({
    systemPrompt: input.systemPrompt,
    question: input.question,
    tone: input.tone,
    detailLevel: input.detailLevel,
    contextData: input.contextData,
    draftAnswer: input.draftAnswer
  });

  const generatedText = generated.text?.trim();
  if (generatedText) {
    return generatedText;
  }

  return `${input.baseAnswer} ${input.draftAnswer ?? ""}`.trim();
}
