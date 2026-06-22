import { Component, OnDestroy, OnInit } from "@angular/core";
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from "ng-apexcharts";
import { CountryVM } from "src/app/core/models/CountryVM";
import { TieredAccessPlanValue } from "src/app/core/enums/TieredAccessPlan";
import {
  EarlyWarningDashboardDto,
  PeaceStressTestDashboardDto,
  PeerResilienceDto,
  ResilienceScorecardDto,
  SignalCardDto,
  SignalTrendDto,
  StressNarrativeDto,
  FiveLevelInterpretationDto,
} from "src/app/core/models/CountrySignalDashboardDto";
import { PillarsVM } from "src/app/core/models/PillersVM";
import { ToasterService } from "src/app/core/services/toaster.service";
import { CommonService } from "src/app/core/services/common.service";
import { UserService } from "src/app/core/services/user.service";
import { CountryUserService } from "../../country-user.service";
import { interval, Subscription } from "rxjs";
declare var bootstrap: any;

export type EarlyWarningChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  legend: ApexLegend;
  grid: ApexGrid;
  colors: string[];
};

type SignalTab = "stress" | "warning" | "resilience";

@Component({
  selector: "app-country-user-dashboard",
  templateUrl: "./country-signal-dashboard.component.html",
  styleUrl: "./country-signal-dashboard.component.css",
})
export class CountryUserDashboardComponent implements OnInit, OnDestroy {
  selectedYear = new Date().getFullYear();
  countries: CountryVM[] = [];
  selectedCountryID: number | null = null;
  activeTab: SignalTab = "stress";

  tier: TieredAccessPlanValue = TieredAccessPlanValue.Pending;
  pillars: PillarsVM[] = [];
  chooseKpisLayers = false;
  loading = false;

  isLoading = false;

  stressDashboard: PeaceStressTestDashboardDto | null = null;
  warningDashboard: EarlyWarningDashboardDto | null = null;
  resilienceDashboard: ResilienceScorecardDto | null = null;
  warningPollingSub: Subscription | null = null;
  selectedSignal: SignalCardDto | null = null;

  public earlyWarningChartOptions: Partial<EarlyWarningChartOptions> = {};
  readonly stressPrimaryCodes = ["PEM", "SFS", "GAS", "SCS", "NCS"];
  readonly stressSecondaryCodes = ["IIS", "SCSS", "TIS", "MAS", "IAS"];

  constructor(
    private countryUserService: CountryUserService,
    private toaster: ToasterService,
    private userService: UserService,
    public commonService: CommonService
  ) {
    this.tier = this.userService?.userInfo?.tier || TieredAccessPlanValue.Pending;
  }

  ngOnInit(): void {
    this.getCountryUserCountries();
  }

  ngOnDestroy(): void {
    this.stopEarlyWarningPolling();
  }

  getCountryUserCountries(): void {
    this.isLoading = true;
    this.countryUserService.getCountryUserCountries().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.succeeded) {
          this.countries = res.result ?? [];
          if (this.countries.length) {
            this.selectedCountryID = this.countries[0].countryID;
            this.loadActiveTabData();
          } else {
            this.selectedCountryID = null;
            this.chooseKpisLayers = true;
            this.getAllPillars();
            this.opendialog();
          }
        } else {
          this.toaster.showWarning(res.errors?.[0] || "Failed to load countries.");
        }
      },
      error: () => {
        this.isLoading = false;
        this.toaster.showError("Failed to load country list.");
      },
    });
  }

  onCountryChanged(): void {
    this.loadActiveTabData();
  }

  onYearChanged(): void {
    this.loadActiveTabData();
  }

  setActiveTab(tab: SignalTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.loadActiveTabData();
  }

  loadActiveTabData(): void {
    if (!this.selectedCountryID) {
      this.toaster.showWarning("Please select a country.");
      return;
    }

    this.stopEarlyWarningPolling();

    if (this.activeTab === "stress") {
      this.loadStressDashboard();
      return;
    }
    if (this.activeTab === "warning") {
      this.loadEarlyWarningDashboard();
      this.startEarlyWarningPolling();
      return;
    }
    this.loadResilienceDashboard();
  }

  loadStressDashboard(): void {
    if (!this.selectedCountryID) return;
    this.isLoading = true;
    this.countryUserService
      .getPeaceStressTestDashboard(this.selectedCountryID, this.selectedYear)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (!res.succeeded) {
            this.stressDashboard = null;
            this.toaster.showWarning(res.errors?.[0] || "No stress test data found.");
            return;
          }
          this.stressDashboard = res.result;
        },
        error: () => {
          this.isLoading = false;
          this.toaster.showError("Failed to load stress test dashboard.");
        },
      });
  }

  loadEarlyWarningDashboard(isSilent = false): void {
    if (!this.selectedCountryID) return;
    if (!isSilent) this.isLoading = true;
    this.countryUserService
      .getEarlyWarningDashboard(this.selectedCountryID, this.selectedYear)
      .subscribe({
        next: (res) => {
          if (!isSilent) this.isLoading = false;
          if (!res.succeeded) {
            this.warningDashboard = null;
            if (!isSilent) {
              this.toaster.showWarning(
                res.errors?.[0] || "No early warning data found."
              );
            }
            return;
          }
          this.warningDashboard = res.result;
          this.setEarlyWarningChartOptions();
        },
        error: () => {
          if (!isSilent) this.isLoading = false;
          if (!isSilent) {
            this.toaster.showError("Failed to load early warning dashboard.");
          }
        },
      });
  }

  loadResilienceDashboard(): void {
    if (!this.selectedCountryID) return;
    this.isLoading = true;
    this.countryUserService
      .getResilienceScorecard(this.selectedCountryID, this.selectedYear)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (!res.succeeded) {
            this.resilienceDashboard = null;
            this.toaster.showWarning(res.errors?.[0] || "No resilience data found.");
            return;
          }
          this.resilienceDashboard = res.result;
        },
        error: () => {
          this.isLoading = false;
          this.toaster.showError("Failed to load resilience scorecard.");
        },
      });
  }

  startEarlyWarningPolling(): void {
    if (this.warningPollingSub || this.activeTab !== "warning") return;
    this.warningPollingSub = interval(60000).subscribe(() => {
      if (this.activeTab === "warning") {
        this.loadEarlyWarningDashboard(true);
      }
    });
  }

  stopEarlyWarningPolling(): void {
    if (this.warningPollingSub) {
      this.warningPollingSub.unsubscribe();
      this.warningPollingSub = null;
    }
  }

  getConditionClass(condition?: string): string {
    const value = (condition || "").toLowerCase();
    if (value.includes("critical")) return "critical";
    if (value.includes("elevated")) return "elevated";
    if (value.includes("watch")) return "watch";
    return "stable";
  }

  getAlertClass(severity?: string): string {
    const value = (severity || "").toLowerCase();
    if (value.includes("critical")) return "critical";
    if (value.includes("high")) return "high";
    if (value.includes("medium")) return "medium";
    return "low";
  }

  getPrimaryStressSignalByCode(code: string): SignalCardDto | undefined {
    return this.stressDashboard?.signals?.find((x) => this.normalizeCode(x.code) === code);
  }

  getPemValue(): number {
    return this.stressDashboard?.pem || 0;
  }

  getSfsValue(): number {
    return this.getPrimaryStressSignalByCode("SFS")?.value || 0;
  }

  getGasValue(): number {
    return this.getPrimaryStressSignalByCode("GAS")?.value || 0;
  }

  getSignalProgress(value: number): number {
    const normalized = Math.max(0, Math.min(100, value || 0));
    return normalized;
  }

  getSignalDelta(signal: SignalCardDto): string {
    const delta = signal?.delta ?? 0;
    const prefix = delta > 0 ? "+" : "";
    return `${prefix}${delta.toFixed(1)}`;
  }

  hasSignalDelta(signal: SignalCardDto): boolean {
    return signal?.delta !== null && signal?.delta !== undefined;
  }

  getCountryName(): string {
    return (
      this.countries.find((x) => x.countryID === this.selectedCountryID)?.countryName ||
      "Selected Country"
    );
  }

  getStressPrimarySignals(): SignalCardDto[] {
    if (this.stressDashboard?.primarySignals?.length) {
      return this.stressDashboard.primarySignals;
    }
    const signals = this.stressDashboard?.signals || [];
    return signals.filter((x) => this.stressPrimaryCodes.includes(this.normalizeCode(x.code || x.layerCode)));
  }

  getStressSecondarySignals(): SignalCardDto[] {
    if (this.stressDashboard?.secondarySignals?.length) {
      return this.stressDashboard.secondarySignals;
    }
    const signals = this.stressDashboard?.signals || [];
    return signals.filter((x) => this.stressSecondaryCodes.includes(this.normalizeCode(x.code || x.layerCode)));
  }

  getLiveSignals(): SignalCardDto[] {
    return this.warningDashboard?.alerts || [];
  }

  getResilienceSignals(): SignalCardDto[] {
    if (this.resilienceDashboard?.primarySignals?.length) {
      return this.resilienceDashboard.primarySignals;
    }
    return this.resilienceDashboard?.resilienceSignals || [];
  }

  getPeerRows(): PeerResilienceDto[] {
    return this.resilienceDashboard?.peers || [];
  }

  getResilienceRankText(): string {
    if (!this.resilienceDashboard) return "";
    return `Rank ${this.resilienceDashboard.regionalRank} / ${this.resilienceDashboard.regionSampleSize}`;
  }

  getResilienceRegionText(): string {
    return this.resilienceDashboard?.region || "";
  }

  getOutlookLines(): string[] {
    const outlook = this.warningDashboard?.outlook;
    if (!outlook) return [];
    if (Array.isArray(outlook)) return outlook;
    if (typeof outlook === "string") return [outlook];

    const values = Object.values(outlook).filter((x) => typeof x === "string");
    return values.length ? (values as string[]) : [];
  }

  getStressNarratives(): StressNarrativeDto[] {
    return this.stressDashboard?.narratives || [];
  }

  getNarrativeHeadline(item: StressNarrativeDto): string {
    return item?.headline || item?.title || "Narrative";
  }

  getSignalIconClass(code?: string): string {
    const icons: Record<string, string> = {
      PEM: "bi-shield-check",
      PEM_DM: "bi-radar",
      SFS: "bi-activity",
      GAS: "bi-exclamation-triangle",
      SCS: "bi-link-45deg",
      NCS: "bi-diagram-3",
      IIS: "bi-info-circle",
      SCSS: "bi-sliders",
      TIS: "bi-clock-history",
      MAS: "bi-people",
      IAS: "bi-bullseye",
      NSS: "bi-broadcast",
      EWES: "bi-lightning-charge",
      VCS: "bi-virus",
      CRS: "bi-hand-thumbs-up",
      MPS: "bi-geo-alt",
      LRS: "bi-tree",
      YFS: "bi-sun",
      HVS: "bi-heart-pulse",
      USS: "bi-mortarboard",
      ESS: "bi-building",
      SAS: "bi-patch-check",
    };
    return icons[this.normalizeCode(code)] || "bi-graph-up-arrow";
  }

  getSignalAccentClass(code?: string): string {
    const accents: Record<string, string> = {
      PEM: "accent-pem",
      PEM_DM: "accent-warning",
      SFS: "accent-risk",
      GAS: "accent-alert",
      SCS: "accent-cohesion",
      NCS: "accent-network",
      IIS: "accent-default",
      SCSS: "accent-cohesion",
      TIS: "accent-warning",
      MAS: "accent-network",
      IAS: "accent-default",
      NSS: "accent-warning",
      EWES: "accent-alert",
      VCS: "accent-risk",
      CRS: "accent-cohesion",
      MPS: "accent-network",
      LRS: "accent-growth",
      YFS: "accent-growth",
      HVS: "accent-health",
      USS: "accent-education",
      ESS: "accent-institution",
      SAS: "accent-pem",
    };
    return accents[this.normalizeCode(code)] || "accent-default";
  }

  getTabIcon(tab: SignalTab): string {
    const icons: Record<SignalTab, string> = {
      stress: "bi-speedometer2",
      warning: "bi-bell",
      resilience: "bi-bar-chart-steps",
    };
    return icons[tab];
  }

  getSignalCode(signal: SignalCardDto): string {
    return signal?.code || signal?.layerCode || "SIG";
  }

  getSignalName(signal: SignalCardDto): string {
    return signal?.name || signal?.layerName || this.getSignalCode(signal);
  }

  getSignalDescription(signal: SignalCardDto): string {
    return signal?.description || signal?.narrative || "";
  }

  openSignalDetails(signal: SignalCardDto): void {
    this.selectedSignal = signal;
    setTimeout(() => {
      const modalEl = document.getElementById("signalDetailModal");
      if (modalEl) {
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) {
          modalInstance = new bootstrap.Modal(modalEl);
        }
        modalInstance.show();
      }
    }, 50);
  }

  closeSignalDetails(): void {
    const modalEl = document.getElementById("signalDetailModal");
    if (!modalEl) return;
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
    this.selectedSignal = null;
  }

  getSelectedInterpretation(): FiveLevelInterpretationDto | undefined {
    if (!this.selectedSignal?.interpretations?.length) return undefined;
    if (this.selectedSignal.interpretationID) {
      return this.selectedSignal.interpretations.find(
        (x) => x.interpretationID === this.selectedSignal?.interpretationID
      );
    }
    return this.selectedSignal.interpretations[0];
  }

  getNarrativeDetail(item: StressNarrativeDto): string {
    return item?.detail || item?.text || item?.narrative || "";
  }


  getAllPillars(): void {
    this.countryUserService.getAllPillars().subscribe({
      next: (res) => {
        this.pillars = res.result ?? [];
      },
    });
  }

  opendialog(): void {
    setTimeout(() => {
      const modalEl = document.getElementById("exampleModal");
      if (modalEl) {
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) {
          modalInstance = new bootstrap.Modal(modalEl);
        }
        modalInstance.show();
      }
    }, 100);
  }

  closeModal(): void {
    this.loading = false;
    const homeTab = document.querySelector("#pills-home-tab") as HTMLElement;
    if (homeTab) {
      homeTab.click();
    }
    const modalEl = document.getElementById("exampleModal");
    if (!modalEl) return;
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }
  }

  SelectedKpisLayers(event: any): void {
    this.loading = true;
    this.countryUserService.addCountryUserKpisCountryAndPillar(event).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.succeeded) {
          this.closeModal();
          this.toaster.showSuccess("Access granted successfully");
          this.ngOnInit();
        } else {
          this.toaster.showWarning(res.errors?.[0] || "Failed to save KPI access.");
        }
      },
      error: () => {
        this.loading = false;
        this.toaster.showError("Something went wrong");
      },
    });
  }

  private setEarlyWarningChartOptions(): void {
    const trendSeries: SignalTrendDto[] = this.warningDashboard?.trendSeries || [];

    const categorySet = new Set<number>();
    trendSeries.forEach((x) => {
      x.series?.forEach((point) => categorySet.add(point.year));
    });

    const categories = Array.from(categorySet).sort((a, b) => a - b);

    const series =
      trendSeries.map((item) => {
        const mapByYear = new Map<number, number>();
        item.series?.forEach((point) => mapByYear.set(point.year, point.value));
        return {
          name: item.name,
          data: categories.map((year) => mapByYear.get(year) ?? null),
        };
      }) || [];

    this.earlyWarningChartOptions = {
      series: series.length ? series : [{ name: "Signal Trend", data: [] }],
      chart: {
        type: "line",
        height: 320,
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      stroke: {
        curve: "smooth",
        width: 3,
      },
      xaxis: {
        categories: categories.map((x) => `${x}`),
      },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 5,
      },
      dataLabels: {
        enabled: false,
      },
      legend: {
        position: "top",
        horizontalAlign: "left",
      },
      grid: {
        borderColor: "#e5ebe9",
      },
      colors: ["#003160", "#77BD3E", "#14416c", "#9ad76c"],
      tooltip: {
        y: {
          formatter: (v?: number) => (typeof v === "number" ? `${v.toFixed(1)}` : "0.0"),
        },
      },
    };
  }

  private normalizeCode(code?: string): string {
    return (code || "").trim().toUpperCase();
  }
}
