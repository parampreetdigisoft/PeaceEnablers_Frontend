import { Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { GetAnalyticalLayerResultDto } from 'src/app/core/models/GetAnalyticalLayerResultDto';
import { environment } from 'src/environments/environment';
import {
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexChart,
  ApexFill,
  ChartComponent,
  ApexStroke
} from "ng-apexcharts";
import { UserService } from 'src/app/core/services/user.service';
import { ToasterService } from 'src/app/core/services/toaster.service';
import { UserRole } from 'src/app/core/enums/UserRole';
import { ResultResponseDto } from 'src/app/core/models/ResultResponseDto';
import { SummarizeKpiRequestDto, SummarizeKpiResponseDto } from 'src/app/core/models/SummarizeKpiDto';
import { AiComputationService } from 'src/app/core/services/ai-computation.service';


export type ChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  plotOptions: ApexPlotOptions;
  fill: ApexFill;
  stroke: ApexStroke;
};

@Component({
  selector: 'app-view-kpi-layer',
  templateUrl: './view-kpi-layer.component.html',
  styleUrl: './view-kpi-layer.component.css'
})
export class ViewKpiLayerComponent implements OnInit, OnChanges {

  @Input() selectedLayer?: GetAnalyticalLayerResultDto | null = null;
  urlBase = environment.apiUrl;
  get country() {
    return this.selectedLayer?.country;
  }
  @ViewChild("chart") chart!: ChartComponent;
  public chartOptions!: Partial<ChartOptions>;


  canShowAiSummary = false;

  get isSummarizing(): boolean {
    return !!this.selectedLayer?.isAiSummarizing;
  }

  get aiSummary(): SummarizeKpiResponseDto | null {
    return this.selectedLayer?.aiPerformanceSummary ?? null;
  }

  get aiSummaryError(): string | null {
    return this.selectedLayer?.aiPerformanceSummaryError ?? null;
  }

  constructor(
    private userService: UserService,
    private aiComputationService: AiComputationService,
    private toaster: ToasterService,
  ) {}

  ngOnInit(): void {
    this.updateAiSummaryVisibility();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    this.ApexGetPieOptions();
    this.updateAiSummaryVisibility();
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/images/Frame 1321315029.png';
  }

  private updateAiSummaryVisibility(): void {
    const role = this.userService.userInfo?.role;
    this.canShowAiSummary =
      role === UserRole.Admin ||
      role === UserRole.Analyst ||
      role === UserRole.CountryUser;
  }

  generateAiSummary(): void {
    if (!this.canShowAiSummary) return;

    const layer = this.selectedLayer;
    const layerResultID = layer?.layerResultID;
    if (!layer || !layerResultID) {
      this.toaster.showError('KPI result is missing. Please reopen the KPI details.');
      return;
    }

    if (layer.aiPerformanceSummary || layer.isAiSummarizing) {
      return;
    }

    layer.isAiSummarizing = true;
    layer.aiPerformanceSummaryError = null;

    const payload: SummarizeKpiRequestDto = { layerResultID };
    this.aiComputationService.summarizeKpiPerformance(payload).subscribe({
      next: (res) => {
        const response = res as ResultResponseDto<SummarizeKpiResponseDto>;
        layer.isAiSummarizing = false;
        if (response?.succeeded && response.result?.summary) {
          layer.aiPerformanceSummary = response.result;
          layer.aiPerformanceSummaryError = null;
        } else {
          const message = response?.errors?.[0] || 'Failed to generate AI summary. Please try again.';
          layer.aiPerformanceSummary = null;
          layer.aiPerformanceSummaryError = message;
          if (this.selectedLayer?.layerResultID === layerResultID) {
            this.toaster.showError(message);
          }
        }
      },
      error: () => {
        const message = 'Unable to reach the AI service. Please try again later.';
        layer.isAiSummarizing = false;
        layer.aiPerformanceSummary = null;
        layer.aiPerformanceSummaryError = message;
        if (this.selectedLayer?.layerResultID === layerResultID) {
          this.toaster.showError(message);
        }
      }
    });
  }

  getConditionByid() {
    let condition = this.selectedLayer?.fiveLevelInterpretations?.find(x => x.interpretationID == this.selectedLayer?.interpretationID)?.condition ?? 'NA';
    condition = condition.split(' ')[0];
    return condition;
  }
  getAiConditionByid() {
    let condition = this.selectedLayer?.fiveLevelInterpretations?.find(x => x.interpretationID == this.selectedLayer?.aiInterpretationID)?.condition ?? 'NA';
    condition = condition.split(' ')[0];
    return condition;
  }
  get interpretaions() {
    return this.selectedLayer?.fiveLevelInterpretations;
  }

  getCalculatedValue() {
    const value = this.selectedLayer?.calValue5;
    const aiValue = this.selectedLayer?.aiCalValue5;

    // Return the value rounded to 2 decimal places but keep it as number
    return value !== undefined && value !== null
      ? Math.round((value + Number.EPSILON) * 100) / 100
      : value ?? 0;
  }

  get getAiCalculatedValue() {
    const aiValue = this.selectedLayer?.aiCalValue5 == 100 || this.selectedLayer?.aiCalValue5 == 0 ? this.selectedLayer?.aiCalValue5?.toFixed(0) : this.selectedLayer?.aiCalValue5?.toFixed(2);
    return aiValue !== undefined && aiValue !== null ? aiValue : '0';
  }
  get getEvaluationCalculatedValue() {
    const aiValue = this.selectedLayer?.calValue5 == 100 || this.selectedLayer?.calValue5 == 0 ? this.selectedLayer?.calValue5?.toFixed(0) : this.selectedLayer?.calValue5?.toFixed(2);
    return aiValue !== undefined && aiValue !== null ? aiValue : '0';
  }


  getCalculatedValues() {
    const value = this.selectedLayer?.calValue5 ?? 0;
    const aiValue = this.selectedLayer?.aiCalValue5 ?? 0;

    const round = (val: number) =>
      Math.round((val + Number.EPSILON) * 100) / 100;

    return {
      manual: round(value),
      ai: round(aiValue)
    };
  }
  ApexGetPieOptions() {
    const { manual, ai } = this.getCalculatedValues();

    this.chartOptions = {
      series: [manual, ai],
      chart: {
        height: 360,
        type: "radialBar",
        toolbar: {
          show: false
        }
      },
      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 225,
          hollow: {
            size: "55%"
          },
          track: {
            background: "#f2f2f2",
            strokeWidth: "100%"
          },
          dataLabels: {
            show: true,
            name: {
              fontSize: "14px",
              color: "#666"
            },
            value: {
              fontSize: "22px",
              fontWeight: 600,
              color: "#111",
              formatter: (val: number) => `${val}`
            },
            total: {
              show: true,
              label: "Manual vs AI",
              formatter: () => `${manual} / ${ai}`
            }
          }
        }
      },
      fill: {
        type: "solid",
        colors: ["#003160", "#d6ebc4"] // Manual, AI
      },
      stroke: {
        lineCap: "round"
      },
      labels: ["Manual Score", "AI Score"]
    };
  }
}
