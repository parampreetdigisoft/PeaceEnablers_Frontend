import { PaginationRequest } from "../PaginationRequest";

export interface AiCountrySummeryRequestDto extends PaginationRequest {
  countryID?:number;
  year?:number
}

export interface AiPillarQuetionsRequestDto extends AiCountrySummeryRequestDto {
  pillarID?:number;
}