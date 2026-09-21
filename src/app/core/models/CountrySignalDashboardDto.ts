export type SignalCondition = "Stable" | "Watch" | "Elevated" | "Critical" | string;



export interface FiveLevelInterpretationDto {

  interpretationID: number;

  layerID: number;

  minRange?: number | null;

  maxRange?: number | null;

  condition: string;

  descriptor: string;

  strategicAction: string;

}



export interface SignalCardDto {

  layerID: number;

  layerCode: string;

  layerName: string;

  description: string;

  code: string;

  name: string;

  value: number;

  delta?: number | null;

  condition: SignalCondition;

  narrative: string;

  descriptor: string;

  strategicAction: string;

  interpretationID: number;

  isAlert: boolean;

  isAccessible: boolean;

  interpretations: FiveLevelInterpretationDto[];

}



export interface StressNarrativeDto {

  headline?: string;

  title?: string;

  detail?: string;

  text?: string;

  narrative?: string;

}



export interface PeaceStressTestDashboardDto {

  countryID: number;

  year: number;

  pem: number;

  countryScore: number;

  pemDirectionalMovement: number;

  pemCondition: SignalCondition;

  pemDescriptor?: string;

  pemStrategicAction?: string;

  signals: SignalCardDto[];

  primarySignals: SignalCardDto[];

  secondarySignals: SignalCardDto[];

  narratives: StressNarrativeDto[];

}



export interface SignalTrendPointDto {

  year: number;

  value: number;

}



export interface SignalTrendDto {

  code: string;

  name: string;

  series: SignalTrendPointDto[];

}



export interface EarlyWarningDashboardDto {

  countryID: number;

  year: number;

  alerts: SignalCardDto[];

  trendSeries: SignalTrendDto[];

  outlook: string | string[] | Record<string, string> | null;

}



export interface PeerResilienceDto {
  countryID?: number;
  countryName: string;
  scs?: number;
  scsRank?: number;

}



export interface ResilienceScorecardDto {

  countryID: number;

  year: number;

  region: string;

  scs: number;

  regionalRank: number;

  regionSampleSize: number;

  peerAverageScs: number;

  investmentImplication: string;

  resilienceSignals: SignalCardDto[];

  primarySignals: SignalCardDto[];

  secondarySignals: SignalCardDto[];

  peers: PeerResilienceDto[];

}


