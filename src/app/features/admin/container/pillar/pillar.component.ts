import { Component, OnDestroy, OnInit } from "@angular/core";
import { AdminService } from "../../admin.service";
import { ToasterService } from "src/app/core/services/toaster.service";
import { PillarsVM } from "src/app/core/models/PillersVM";
import { AnalyticalLayerResponseDto } from "src/app/core/models/GetAnalyticalLayerResultDto";
import { environment } from "src/environments/environment";
declare var bootstrap: any;

@Component({
  selector: "app-pillar",
  templateUrl: "./pillar.component.html",
  styleUrl: "./pillar.component.css",
})
export class PillarComponent implements OnInit, OnDestroy {
  pillars: PillarsVM[] = [];
  kpis: AnalyticalLayerResponseDto[] = [];
  selectedPillar: PillarsVM | null = null;
  loading: boolean = false;
  isLoader: boolean = false;
  urlBase = environment.apiUrl;
  isOpendialog: boolean = false;
  readonly blockedDeleteMessage = "You can't delete this pillar as it is binded by KPI's. To delete this pillar first replace the KPI mapping with other pillars.";
  readonly confirmDeleteMessage = "Are you sure you want to delete this pillar? All questions under this pillar will also be deleted.";

  constructor(
    private adminService: AdminService,
    private toaster: ToasterService,
  ) {}

  ngOnInit(): void {
    this.GetAllPillars();
    this.GetAllKpi();
  }

  get nextDisplayOrder(): number {
    if (!this.pillars.length) {
      return 1;
    }
    return Math.max(...this.pillars.map((p) => Number(p.displayOrder) || 0)) + 1;
  }

  GetAllKpi() {
    this.adminService.GetAllKpi().subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.kpis = res.result ?? [];
        }
      },
    });
  }
  GetAllPillars() {
    this.pillars = [];
    this.isLoader = true;
    this.adminService.getAllPillars().subscribe((pillars) => {
      this.pillars = pillars.map((p) => ({
        ...p,
        expand: false,
        showToggle: this.isLongText(p.description),
      }));
      this.isLoader = false;
    });
  }


  isLongText(html: string): boolean {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = temp.innerText || temp.textContent || "";
    return text.split(/\s+/).length > 40; // approx 4 lines
  }

  addUpdatePillar(piller: PillarsVM | any) {
    if (!piller) {
      return;
    }

    if (!piller.pillarName || piller.pillarName.trim().length < 5) {
      this.toaster.showError("Pillar name must be at least 5 characters");
      return;
    }

    this.loading = true;
    const formData = new FormData();
    formData.append("pillarName", piller.pillarName);
    formData.append("pillarCode", (piller.pillarCode ?? "").trim());
    formData.append("weight", (piller.weight ?? 1).toString());
    formData.append("reliability", piller.reliability.toString());
    formData.append("description", piller.description);
    formData.append("displayOrder", (piller.displayOrder ?? 0).toString());    
    if(piller.kpiLayerIds){
      formData.append("kpiLayerIds", (piller.kpiLayerIds ?? []).join(","));
    }
    if (piller.kpiUpdates?.length) {
      formData.append("kpiUpdates", JSON.stringify(piller.kpiUpdates));
    }

    if (piller.imageFile) {
      formData.append("imageFile", piller.imageFile, piller.imageFile.name);
    }
     const isAdd = !piller.pillarID || piller.pillarID === 0;

    if (isAdd) {
      this.adminService.addPillar(formData).subscribe({
        next: (res) => {
          if (res.succeeded) {
            this.closeModal();
            this.toaster.showSuccess(
              res.messages?.join(", ") || "Pillar created successfully",
            );
            this.GetAllPillars();
          } else {
            this.loading = false;
            this.toaster.showError(res.errors?.join(", ") || "Failed to create Pillar");
          }
        },
        error: (err) => {
          this.loading = false;
          this.toaster.showError(err?.message || "Failed to create pillar");
        },
      });
      return;
    }

    if (!this.selectedPillar) {
      this.loading = false;
      this.toaster.showWarning("No selected pillar");
      return;
    }

    this.adminService
      .editAllPillars(this.selectedPillar.pillarID, formData)
      .subscribe({
        next: (res) => {
          if (res.succeeded) {
            this.closeModal();
            this.toaster.showSuccess(
              res.messages?.join(", ") || "Pillar updated successfully",
            );
            this.GetAllPillars();
          } else {
            this.loading = false;
            this.toaster.showError(res.errors?.join(", ") || "Failed to update pillar");
          }
        },
        error: (err) => {
          this.loading = false;
          this.toaster.showError(err?.message || "Failed to update pillar");
        },
      });
  }


  addPillar() {
    this.selectedPillar = null;
    this.openDialog();
  }

  editPillar(piller: PillarsVM, isOpen: boolean = true) {
    this.selectedPillar = piller;
    if (isOpen) {
      this.openDialog();
    }
  }

  openDialog() {
    this.isOpendialog = true;
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

  ngOnDestroy(): void {}

  closeModal() {
    this.loading = false;
    const modalEl = document.getElementById("exampleModal");
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    modalInstance?.hide();
    this.isOpendialog = false;
    setTimeout(() => {
      this.selectedPillar = null;
    }, 100);
  }

  decodeHtml(text: string): string {
    const txt = document.createElement("textarea");
    txt.innerHTML = text;
    return txt.value.replace(/\u00a0/g, " "); // Replace non-breaking space with normal space
  }

   onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/images/noImageAvailable.png';
  }

  
  get canDeleteSelectedPillar() {
    return !this.selectedPillar?.kpiLayerIds?.length;
  }
  
  get deletePromptMessage() {
    return this.canDeleteSelectedPillar ? this.confirmDeleteMessage : this.blockedDeleteMessage;
  }

  onDeletePillarClick(pillar: PillarsVM, event: Event): void {
    event.preventDefault();
    this.selectedPillar = pillar;

    this.adminService.getPillarKpiMappings(pillar.pillarID).subscribe({
      next: (res) => {
        pillar.kpiLayerIds = res.succeeded ? (res.result ?? []).map((m) => +m.layerID) : [];
        bootstrap.Modal.getOrCreateInstance(document.getElementById("confirmModal")).show();
      },
      error: () => this.toaster.showError("Failed to validate pillar KPI mappings"),
    });
  }

  deletePillar() {
    if (this.selectedPillar === null) {
      this.toaster.showError("No pillar selected for deletion");
      return;
    }

    if (!this.canDeleteSelectedPillar) {
      this.toaster.showWarning(this.blockedDeleteMessage);
      return;
    }

    this.adminService.deletePillar(this.selectedPillar.pillarID).subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.GetAllPillars();
          this.toaster.showSuccess(res?.messages?.join(", ") || "Pillar deleted successfully");
        } else {
          this.toaster.showError(res?.errors?.join(", ") || "Failed to delete pillar");
        }
      },
      error: () => {
        this.toaster.showError("Failed to delete pillar");
      },
    });
  }
}
