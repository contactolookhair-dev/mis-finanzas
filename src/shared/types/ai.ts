export type FinancialAISection = {
  summary: string;
  explanation: string;
  recommendations: string[];
  keyFindings: string[];
  dataUsed: string[];
};

export type FinancialAIResponse = {
  intent: string;
  question: string;
  scope: {
    workspaceId: string;
    dateRange?: {
      startDate?: string;
      endDate?: string;
    };
  };
  answer: string;
  data: unknown;
  source: "internal_analytics";
  nextSuggestedQuestions: string[];
  interpretedQuery: {
    confidence?: number;
    businessUnitName?: string;
    categoryName?: string;
  };
  sections: FinancialAISection;
};
