export interface PillarKpiReplacement {
  layerID: number;
  replacedPillarID: number;
  newPillarID: number;
  categoryNumber: number;
}

export interface PillarsVM {
  pillarID: number;
  pillarName: string;
  pillarCode?: string | null;
  description: string;
  displayOrder: number;
  imagePath?:string;
  weight: number;
  reliability: boolean;
  expand?: boolean;
  showToggle?: boolean;
  imageFile?: File | null;
  kpiLayerIds?: number[];
  addedKpiLayerIds?: number[];
  kpiUpdates?: PillarKpiReplacement[];
}