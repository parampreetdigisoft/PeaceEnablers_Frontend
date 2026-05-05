import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { ToasterService } from "src/app/core/services/toaster.service";
import { UserService } from "src/app/core/services/user.service";
import {
  CountryHistoryDto,
  CountryPillarQuestionHistoryResponseDto,
  GetCountryQuestionHistoryResponseDto,
  UserCountryRequestDto,
} from "src/app/core/models/countryHistoryDto";
import { CountryVM } from "src/app/core/models/CountryVM";
import { CommonService } from "src/app/core/services/common.service";
import { CountryUserService } from "../../country-user.service";
import { environment } from "src/environments/environment";
import { Router } from "@angular/router";
import { PillarsVM } from "src/app/core/models/PillersVM";
import { TieredAccessPlanValue } from "src/app/core/enums/TieredAccessPlan";
declare var bootstrap: any;
import {
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexChart,
  ApexFill,
  ApexStroke,
  ApexLegend,
  ApexTooltip,
} from "ng-apexcharts";

export type ChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  plotOptions: ApexPlotOptions;
  fill: ApexFill;
  stroke: ApexStroke;
  legend: ApexLegend;
  colors: string[];
  tooltip?: ApexTooltip;
};

@Component({
  selector: "app-country-user-dashboard",
  templateUrl: "./country-user-dashboard.component.html",
  styleUrl: "./country-user-dashboard.component.css",
})
export class CountryUserDashboardComponent implements OnInit, OnDestroy {
  selectedYear = new Date().getFullYear();
  countries: CountryVM[] | null = [];
  selectedCountries: number | any = "";
  pillars: PillarsVM[] = [];
  countryHistory: CountryHistoryDto | null = null;
  countryQuestionHistoryReponse: GetCountryQuestionHistoryResponseDto | null = null;
  pillarBarOptions: any = {};
  cityLineOptions: any = {};
  isLoader: boolean = false;
  urlBase = environment.apiUrl;
  selectedPillar: CountryPillarQuestionHistoryResponseDto | null = null;
  chooseKpisLayers: boolean = false;
  loading: boolean = false;
  minPillar: CountryPillarQuestionHistoryResponseDto | null = null;
  maxPillar: CountryPillarQuestionHistoryResponseDto | null = null;
  tier: TieredAccessPlanValue = TieredAccessPlanValue.Pending;

  @ViewChild("chartContainer") chartContainer!: ElementRef;
  public chartOptions: Partial<ChartOptions> = {
    series: [],
    chart: { type: 'radialBar' }
  };

  intervalId: any;
  constructor(
    private countryUserService: CountryUserService,
    private toaster: ToasterService,
    private userService: UserService,
    public commonService: CommonService,
    private router: Router
  ) {
    this.tier = this.userService?.userInfo?.tier || 0;
  }
  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  ngAfterViewInit() { }

  ngOnInit(): void {
    this.isLoader = true;
    this.getCountryUserCountries();
    this.GetCountryHistory();
  }
  yearChanged() {
    this.GetCountryHistory();
    this.getCountryQuestionHistory();
  }

  get countryInfo() {
    return this.countries?.find((x) => x.countryID == this.selectedCountries);
  }
  getAllPillars() {
    this.countryUserService.getAllPillars().subscribe({
      next: (res) => {
        this.pillars = res.result ?? [];
      },
    });
  }
  getCountryUserCountries() {
    this.countryUserService.getCountryUserCountries().subscribe({
      next: (res) => {
        this.isLoader = false;
        if (res.succeeded) {
          this.countries = res.result;
          if (this.countries && this.countries.length > 0) {
            this.isLoader = true;
            this.selectedCountries = this.countries[0].countryID;
            this.getCountryQuestionHistory();
          } else {
            this.chooseKpisLayers = true;
            this.getAllPillars();
            this.opendialog();
          }
        } else {
          this.toaster.showError(res.errors.join(", "));
        }
      },
      error: () => {
        this.isLoader = false;
        this.toaster.showError("There is an error occure please try again");
      },
    });
  }
  GetCountryHistory() {
    this.countryUserService.getCountryHistory().subscribe({
      next: (res) => {
        this.countryHistory = res.result;
      },
    });
  }
  getCountryQuestionHistory() {
    if (this.userService?.userInfo?.userID == null || !this.selectedCountries || this.selectedCountries === "" || this.selectedCountries == null) {
      this.toaster.showWarning("Please select one country to view the records")
      return;
    }
    let request: UserCountryRequestDto = {
      userID: this.userService?.userInfo?.userID ?? 0,
      countryID: this.selectedCountries,
      updatedAt: this.commonService.getStartOfYearLocal(this.selectedYear),
    };
    this.countryUserService.getCountryQuestionHistory(request).subscribe({
      next: (res) => {
        this.isLoader = false;
        this.countryQuestionHistoryReponse = res;
        if (this.countryQuestionHistoryReponse) {

          // Filter accessible pillars
          const accessiblePillars =
            this.countryQuestionHistoryReponse.pillars.filter((p) => p.isAccess);

          this.minPillar = accessiblePillars.sort((x, y) => x.scoreProgress - y.scoreProgress)[0]
          this.maxPillar = accessiblePillars.sort((x, y) => y.scoreProgress - x.scoreProgress)[0]

          this.selectedPillar =
            this.countryQuestionHistoryReponse.pillars.length > 0
              ? this.countryQuestionHistoryReponse.pillars[0]
              : null;
          this.SetApexRadialBarOptions();
        }
      },
      error: (err) => {
        this.isLoader = false;
      },
    });
  }

  ExportCountryPillar() {
    let country = this.countries?.find((x) => x.countryID == this.selectedCountries);
    if (this.countryQuestionHistoryReponse?.pillars && country) {
      var exportData = this.countryQuestionHistoryReponse?.pillars.map((x) => {
        return {
          countryName: country?.countryName,
          PillarName: x.pillarName,
          Score: x.scoreProgress?.toFixed(2),
          AnsweredQuestion: x.ansQuestion,
          TotalQuestion: x.totalQuestion,
        };
      });
      this.commonService.exportExcel(exportData);
    } else {
      this.toaster.showWarning("Please select country to export the records");
    }
  }

  pillarChanged(pillar: CountryPillarQuestionHistoryResponseDto) {
    if (pillar?.isAccess) {
      this.selectedPillar = pillar;
      this.SetApexRadialBarOptions();
    }
  }

  opendialog() {
    setTimeout(() => {
      const modalEl = document.getElementById("exampleModal");
      if (modalEl) {
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) {
          modalInstance = new bootstrap.Modal(modalEl);
        }
        modalInstance.show(); // ✅ use show()
      }
    }, 100);
  }
  closeModal() {
    this.loading = false;
    const homeTab = document.querySelector("#pills-home-tab") as HTMLElement;
    if (homeTab) {
      homeTab.click();
    }
    const modalEl = document.getElementById("exampleModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  }
  SelectedKpisLayers(event: any) {
    this.loading = true;
    this.countryUserService.addCountryUserKpisCountryAndPillar(event).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.succeeded) {
          this.closeModal();
          this.toaster.showSuccess("Access granted successfully");
          this.ngOnInit();
        } else {
          this.toaster.showWarning(res.errors[0]);
        }
      },
      error: (err) => {
        this.toaster.showError("Something went wrong");
        this.loading = false;
      },
    });
  }

  SetApexRadialBarOptions(refresh: boolean = true) {
    if (this.selectedPillar?.scoreProgress == 0 && !refresh) return;

    const pillarScore: number = this.selectedPillar?.scoreProgress ?? 0;
    const countryScore: number = this.countryQuestionHistoryReponse?.scoreProgress ?? 0;
    const minScore: number = this.minPillar?.scoreProgress ?? 0;
    const maxScore: number = this.maxPillar?.scoreProgress ?? 0;
    const pillarColors = this.commonService.PillarColors;
    this.chartOptions = {
      series: [countryScore, pillarScore, maxScore, minScore],
      chart: {
        height: 420,
        width: 750,
        type: "radialBar",
        toolbar: { show: false },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1000,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 450
          }
        },
        background: 'transparent',
        dropShadow: {
          enabled: true,
          top: 0,
          left: 0,
          blur: 4,
          opacity: 0.15
        }
      },

      plotOptions: {
        radialBar: {
          startAngle: -135,
          endAngle: 225,
          offsetX: 80,
          offsetY: 0,
          hollow: {
            size: "40%",
            background: "transparent",
            dropShadow: {
              enabled: true,
              top: 2,
              left: 0,
              blur: 8,
              opacity: 0.12
            }
          },
          track: {
            show: true,
            background: "#e7e7e7",
            strokeWidth: "100%",
            opacity: 0.25,
            margin: 8,
            dropShadow: {
              enabled: true,
              top: 0,
              left: 0,
              blur: 2,
              opacity: 0.08
            }
          },
          dataLabels: {
            name: {
              show: true,
              offsetY: -15,
              fontSize: '15px',
              fontWeight: 600,
              color: '#3c5d54',
              fontFamily: 'inherit'
            },
            value: {
              show: true,
              offsetY: 8,
              fontSize: "28px",
              fontWeight: 700,
              color: '#2f4841',
              fontFamily: 'inherit',
              formatter: (v: any) => {
                const value = Number(v);
                return isNaN(value) ? '0' : value.toFixed(1) + '';
              }
            },
            total: {
              show: true,
              label: "Pillar Score",
              fontSize: '16px',
              fontWeight: 600,
              color: "#4a7167",
              formatter: (w: any) => (w.globals.series[1] ?? 0).toFixed(1),
            },
          },
        },
      },

      labels: [
        "Country Score",
        "Pillar Score",
        "Maximum",
        "Minimum",
      ],

      colors: ["#2f4841", "#4a7167", "#79a89b", "#a2c3ba"],

      stroke: {
        lineCap: "round",
      },

      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          type: 'horizontal',
          shadeIntensity: 0.5,
          gradientToColors: ['#3c5d54', '#578679', '#8eb5ab', '#b8d4cc'],
          inverseColors: false,
          opacityFrom: 1,
          opacityTo: 0.85,
          stops: [0, 100]
        }
      },

      legend: {
        show: true,
        floating: true,
        position: "left",
        horizontalAlign: "left",
        offsetX: 65,
        offsetY: 0,
        fontSize: "15px",
        fontWeight: 600,
        fontFamily: 'inherit',
        labels: {
          colors: '#2f4841',
          useSeriesColors: false,
        },
        markers: {
          width: 14,
          height: 14,
          radius: 14,
          offsetX: -5,
          offsetY: 1,
        },
        itemMargin: {
          horizontal: 8,
          vertical: 12,
        },
        formatter: (seriesName: string, opts: any) => {
          const value = opts.w.globals.series[opts.seriesIndex] ?? 0;
          return `<span style="color: #2e4740; font-weight: 600;">${seriesName}</span>: <span style="color: #4a7167; font-weight: 700;">${value.toFixed(2)}</span>`;
        },
      },

      tooltip: {
        enabled: true,
        fillSeriesColor: false,
        theme: 'light',
        style: {
          fontSize: '14px',
          fontFamily: 'inherit'
        },
        y: {
          formatter: (val: number) => val.toFixed(2) + ''
        },
        marker: {
          show: true,
        },
        custom: ({ series, seriesIndex, w }) => {
          let name = 'Pillar';
          if (seriesIndex == 0) {
            name = this.countryInfo?.countryName ?? 'Country';
          }
          else if (seriesIndex == 1) {
            name = this.selectedPillar?.pillarName ?? 'Pillar';
          }
          else if (seriesIndex == 2) {
            name = this.maxPillar?.pillarName ?? 'Max Pillar';
          }
          else if (seriesIndex == 3)
            name = this.minPillar?.pillarName ?? 'Min Pillar';


          const value = series[seriesIndex];
          const color = pillarColors[seriesIndex % pillarColors.length];
          const lightBg = `${color}1A`; // ~10% opacity

          return `
          <div style="
            padding: 14px 16px;
            min-width: 220px;
            background: linear-gradient(135deg, #ffffff, #f7faf9);
            border-radius: 12px;
            border-left: 5px solid ${color};
            box-shadow: 0 10px 25px rgba(0,0,0,0.12);
            font-family: Inter, sans-serif;
          ">

            <!-- Header -->
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 10px;
              font-size: 13px;
              font-weight: 600;
              color: #1f2937;
            ">
              <span style="
                width: 10px;
                height: 10px;
                background: ${color};
                border-radius: 50%;
                display: inline-block;
              "></span>
              ${name}
            </div>

            <!-- Score -->
            <div style="
              font-size: 28px;
              font-weight: 700;
              color: ${color};
              line-height: 1;
            ">
              ${value.toFixed(1)}
            </div>

            <!-- Progress bar -->
            <div style="
              margin-top: 10px;
              height: 6px;
              background: #e5e7eb;
              border-radius: 4px;
              overflow: hidden;
            ">
              <div style="
                width: ${value}%;
                height: 100%;
                background: linear-gradient(90deg, ${color}, #a2c3ba);
                border-radius: 4px;
              "></div>
            </div>

            <!-- Footer -->
            <div style="
              margin-top: 10px;
              padding: 6px 10px;
              background: ${lightBg};
              border-radius: 6px;
              font-size: 11px;
              color: #374151;
              display: flex;
              justify-content: space-between;
            ">
              <span>${this.countryInfo?.countryName}</span>
              <strong>${countryScore.toFixed(2)}</strong>
            </div>
          </div>
        `;
        }

      }
    };
  }
}
