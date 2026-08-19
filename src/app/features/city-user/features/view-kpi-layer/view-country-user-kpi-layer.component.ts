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
import { SharedModule } from 'src/app/shared/share.module';
import { CommonModule } from '@angular/common';
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
  selector: 'app-view-country-user-kpi-layer',
  standalone: true,
  imports: [SharedModule, CommonModule],
  templateUrl: './view-country-user-kpi-layer.component.html',
  styleUrl: './view-country-user-kpi-layer.component.css'
})
export class ViewCountryUserKpiLayerComponent implements OnInit, OnChanges {

  @Input() selectedLayer?: GetAnalyticalLayerResultDto | null = null;
  urlBase = environment.apiUrl;
  get country() {
    return this.selectedLayer?.country;
  }
  @ViewChild("chart") chart!: ChartComponent;
  public chartOptions!: Partial<ChartOptions>;



  canShowAiSummary = false;
  isSummarizing = false;
  aiSummary: SummarizeKpiResponseDto | null = null;
  aiSummaryError: string | null = null;

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
    if (changes['selectedLayer']) {
      this.aiSummary = null;
      this.aiSummaryError = null;
      this.isSummarizing = false;
    }
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/images/Frame 1321315029.png';
  }

  private updateAiSummaryVisibility(): void {
    const role = this.userService.userInfo?.role;
    this.canShowAiSummary = role === UserRole.CountryUser;
  }

  generateAiSummary(): void {
    if (!this.canShowAiSummary || this.isSummarizing) return;

    const layerResultID = this.selectedLayer?.layerResultID;
    if (!layerResultID) {
      this.toaster.showError('KPI result is missing. Please reopen the KPI details.');
      return;
    }

    this.isSummarizing = true;
    this.aiSummaryError = null;

    const payload: SummarizeKpiRequestDto = { layerResultID };
    this.aiComputationService.summarizeKpiPerformance(payload).subscribe({
      next: (res) => {
        const response = res as ResultResponseDto<SummarizeKpiResponseDto>;
        this.isSummarizing = false;
        if (response?.succeeded && response.result?.summary) {
          this.aiSummary = response.result;
          this.aiSummaryError = null;
        } else {
          const message = response?.errors?.[0] || 'Failed to generate AI summary. Please try again.';
          this.aiSummary = null;
          this.aiSummaryError = message;
          this.toaster.showError(message);
        }
      },
      error: () => {
        this.isSummarizing = false;
        this.aiSummary = null;
        this.aiSummaryError = 'Unable to reach the AI service. Please try again later.';
        this.toaster.showError(this.aiSummaryError);
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


  private getScoreColor(score: number): string {
    if (score >= 75) return "#575c59";   // Green – strong
    if (score >= 50) return "#f59e0b";   // Amber – moderate
    return "#dc2626";                    // Red – weak
  }

  ApexGetPieOptions() {
    const round = (val: number) =>
    Math.round((val + Number.EPSILON) * 100) / 100;

    const aiValue = this.selectedLayer?.aiCalValue5 ?? 0;
    const value = round(aiValue);
    const scoreColor = this.getScoreColor(value);

    this.chartOptions = {
      series: [value],
      chart: {
        height: 360,
        type: "radialBar",
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 900
        },
        toolbar: { show: false }
      },

      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 225,
          hollow: {
            margin: 0,
            size: "70%",
            background: "#fff",
            image: undefined,
            position: "front",
            dropShadow: {
              enabled: true,
              top: 3,
              left: 0,
              blur: 4,
              opacity: 0.24
            }
          },
          track: {
            background: "#fff",
            strokeWidth: "67%",
            margin: 0, // margin is in pixels
            dropShadow: {
              enabled: true,
              top: -3,
              left: 0,
              blur: 4,
              opacity: 0.35
            }
          },
          dataLabels: {
            show: true,
            name: {
              offsetY: -10,
              show: true,
              color: "#888",
              fontSize: "17px"
            },
            value: {
              formatter: function (val) {
                return val.toString();
              },
              color: "#111",
              fontSize: "36px",
              show: true
            }
          }
        }
      },
      fill: {
        type: "solid",
        colors: ["#77bd3e"]
      },
      stroke: {
        lineCap: "round"
      },
      labels: ["Performance"]
    };
  }
}