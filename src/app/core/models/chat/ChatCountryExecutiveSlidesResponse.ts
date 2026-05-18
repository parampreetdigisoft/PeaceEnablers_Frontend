export interface PerformanceSummary {
  trend: string;
  summary: string;
}

export interface CombinedRiskItem {
  rank: number;
  title: string;
  riskScore: number;
  severity: string;
  trend: string;
  description: string;
  recommendation: string;
}

export interface EarlyWarningItem {
  title: string;
  description: string;
  timeframe: string;
  impactLevel: string;
}

export interface CountryExecutiveSlidesResult {
  countryId: number;
  countryName: string;

  recentPerformance: PerformanceSummary;

  combinedRisks: CombinedRiskItem[];

  earlyWarnings: EarlyWarningItem[];
}

export interface ChatCountryExecutiveSlidesResponse {
  success: boolean;
  message: string;
  result: CountryExecutiveSlidesResult;
}