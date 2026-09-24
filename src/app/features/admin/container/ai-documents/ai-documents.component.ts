declare var bootstrap: any;
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../admin.service';
import { CountryVM } from 'src/app/core/models/CountryVM';
import { SharedModule } from 'src/app/shared/share.module';
import { PillarsVM } from 'src/app/core/models/PillersVM';
import { UserService } from 'src/app/core/services/user.service';
import { SortDirection } from 'src/app/core/enums/SortDirection';
import { ToasterService } from 'src/app/core/services/toaster.service';
import { PaginationResponse } from 'src/app/core/models/PaginationResponse';
import { AiComputationService } from 'src/app/core/services/ai-computation.service';
import { GetCountryDocumentResponseDto, GetCountryPillarDocumentResponseDto } from 'src/app/core/models/aiVm/GetCountryDocumentResponseDto';
import { AiCountryDocumentRequestDto, DeleteCountryDocumentRequestDto } from 'src/app/core/models/aiVm/AiCountrySummeryRequestDto';

type DocumentScope = 'platform' | 'country';
type CountryDocumentFilter = 'with' | 'without' | 'all';

@Component({
  selector: 'app-ai-documents',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './ai-documents.component.html',
  styleUrl: './ai-documents.component.css'
})
export class AiDocumentsComponent {

  selectedYear = new Date().getFullYear();
  scope: DocumentScope = 'platform';
  documentFilter: CountryDocumentFilter = 'with';
  selectedCountry: GetCountryDocumentResponseDto | null = null;
  selectedCountryID?: number;
  documentLayersResponse: PaginationResponse<GetCountryDocumentResponseDto> | undefined;
  totalRecords = 0;
  pageSize = 10;
  currentPage = 1;
  isLoader = false;
  countryList: CountryVM[] = [];
  pillars: PillarsVM[] = [];
  saveDocumentLoader = false;
  isDeletePromptOpen = false;
  selectedDoc: GetCountryPillarDocumentResponseDto | null = null;
  platformDocuments: GetCountryPillarDocumentResponseDto[] = [];
  countryDocuments: GetCountryPillarDocumentResponseDto[] = [];
  platformFiles: File[] = [];
  countryFiles: File[] = [];
  classification = 'Internal';
  retentionChoice = '90';
  legalHold = false;
  selectedPillarID: number | null = null;
  classifications = ['Public', 'Internal', 'Confidential', 'Secret', 'Top Secret'];
  countryFilters: { value: CountryDocumentFilter; label: string }[] = [
    { value: 'with', label: 'Countries that have files' },
    { value: 'without', label: 'Countries with no files' },
    { value: 'all', label: 'All countries' }
  ];
  retentionOptions = [
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days (usual)' },
    { value: '365', label: '1 year' },
    { value: '2555', label: '7 years' },
    { value: 'indefinite', label: 'Keep until I delete it' }
  ];

  constructor(
    private adminService: AdminService,
    private toaster: ToasterService,
    private userService: UserService,
    private aiComputationService: AiComputationService) { }

  ngOnInit(): void {
    this.loadPlatformDocuments();
    this.getAICountryDocuments(1);
    this.getCountryUserCountries();
    this.getPillars();
  }

  showScope(scope: DocumentScope) {
    this.scope = scope;
  }

  getPillars() {
    this.adminService.getAllPillars().subscribe(r => {
      this.pillars = r;
    });
  }

  getAICountryDocuments(currentPage: any = 1) {
    this.documentLayersResponse = undefined;
    this.isLoader = true;
    const payload: AiCountryDocumentRequestDto = {
      sortDirection: SortDirection.ASC,
      sortBy: 'CountryName',
      pageNumber: currentPage,
      pageSize: this.pageSize
    };
    if (this.documentFilter === 'with') {
      payload.hasDocuments = true;
    } else if (this.documentFilter === 'without') {
      payload.hasDocuments = false;
    }

    this.aiComputationService.getAICountryDocuments(payload).subscribe({
      next: (documentLayers) => {
        this.documentLayersResponse = documentLayers;
        this.totalRecords = documentLayers.totalRecords;
        this.currentPage = currentPage;
        this.pageSize = documentLayers.pageSize;
        this.isLoader = false;
      },
      error: () => {
        this.isLoader = false;
      }
    });
  }

  onCountryFilterChange() {
    this.getAICountryDocuments(1);
  }

  onCountryPicked() {
    const country = this.countryList.find(item => item.countryID == this.selectedCountryID);
    if (!country) {
      this.selectedCountry = null;
      this.countryDocuments = [];
      return;
    }
    if (this.selectedCountry?.countryID === country.countryID) {
      return;
    }
    this.openCountry({
      countryID: country.countryID,
      countryName: country.countryName,
      noOfUsers: 0,
      noOfFiles: 0,
      fileTypes: ''
    });
  }

  openCountry(country: GetCountryDocumentResponseDto) {
    this.selectedCountry = country;
    this.selectedCountryID = country.countryID;
    this.scope = 'country';
    this.countryFiles = [];
    this.selectedPillarID = null;
    this.loadCountryDocuments();
  }

  loadPlatformDocuments() {
    this.aiComputationService.getAICountryPillarDocuments({ countryID: 0, platformOnly: true }).subscribe({
      next: (res) => {
        this.platformDocuments = res.succeeded ? (res.result ?? []) : [];
      }
    });
  }

  loadCountryDocuments() {
    if (!this.selectedCountry?.countryID) {
      this.countryDocuments = [];
      return;
    }
    this.aiComputationService.getAICountryPillarDocuments({
      countryID: this.selectedCountry.countryID,
      platformOnly: false
    }).subscribe({
      next: (res) => {
        this.countryDocuments = res.succeeded ? (res.result ?? []) : [];
        if (this.selectedCountry) {
          this.selectedCountry.noOfFiles = this.countryDocuments.length;
        }
      }
    });
  }

  getCountryUserCountries() {
    this.adminService.getAllCountriesByUserId(this.userService.userInfo.userID ?? 0).subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.countryList = res.result ?? [];
        }
      }
    });
  }

  onFileSelected(target: DocumentScope, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const next = target === 'platform' ? [...this.platformFiles] : [...this.countryFiles];
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      if (!allowed.includes(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name)) continue;
      if (!next.some(existing => existing.name === file.name && existing.size === file.size)) {
        next.push(file);
      }
    }
    if (target === 'platform') {
      this.platformFiles = next;
    } else {
      this.countryFiles = next;
    }
    input.value = '';
  }

  removePending(target: DocumentScope, index: number) {
    if (target === 'platform') {
      this.platformFiles = this.platformFiles.filter((_, i) => i !== index);
    } else {
      this.countryFiles = this.countryFiles.filter((_, i) => i !== index);
    }
  }

  upload(target: DocumentScope) {
    const files = target === 'platform' ? this.platformFiles : this.countryFiles;
    if (!files.length) {
      this.toaster.showWarning('Choose a PDF or Word file first.');
      return;
    }
    if (target === 'country' && !this.selectedCountry?.countryID) {
      this.toaster.showWarning('Choose the country this file belongs to.');
      return;
    }

    const formData = new FormData();
    formData.append('Classification', this.classification);
    formData.append('LegalHold', String(this.legalHold));
    if (this.retentionChoice === 'indefinite') {
      formData.append('KeepIndefinitely', 'true');
    } else {
      formData.append('KeepIndefinitely', 'false');
      formData.append('RetentionDays', this.retentionChoice);
    }
    if (target === 'country' && this.selectedCountry?.countryID) {
      formData.append('CountryID', String(this.selectedCountry.countryID));
    }
    files.forEach(file => {
      formData.append('Files', file);
      formData.append('PillarIDs', target === 'country' && this.selectedPillarID ? String(this.selectedPillarID) : '0');
    });

    this.saveDocumentLoader = true;
    this.aiComputationService.uploadAiDocuments(formData).subscribe({
      next: (res) => {
        this.saveDocumentLoader = false;
        if (res.succeeded) {
          this.toaster.showSuccess(res.messages.join(', '));
          if (target === 'platform') {
            this.platformFiles = [];
            this.loadPlatformDocuments();
          } else {
            this.countryFiles = [];
            this.selectedPillarID = null;
            this.loadCountryDocuments();
            this.getAICountryDocuments(this.currentPage);
          }
        } else {
          this.toaster.showError((res.messages || ['Upload failed.']).join(', '));
        }
      },
      error: () => {
        this.saveDocumentLoader = false;
        this.toaster.showError('Upload failed. Please try again.');
      }
    });
  }

  downloadDocument(request: GetCountryPillarDocumentResponseDto) {
    this.aiComputationService.downloadDocument(request.countryDocumentID).subscribe({
      next: (blob) => {
        if (blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = request.fileName || `document${request.fileType || ''}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } else {
          this.toaster.showWarning('This file could not be downloaded.');
        }
      },
      error: () => {
        this.toaster.showError('There is an error occured, please try again');
      }
    });
  }

  onDeleteClick(doc: GetCountryPillarDocumentResponseDto) {
    this.selectedDoc = doc;
    this.isDeletePromptOpen = true;
    setTimeout(() => {
      const modalEl = document.getElementById('exampleModal');
      if (!modalEl) return;
      let modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (!modalInstance) {
        modalInstance = new bootstrap.Modal(modalEl);
      }
      modalInstance.show();
    }, 100);
  }

  closeModal() {
    const modalEl = document.getElementById('exampleModal');
    const modalInstance = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
    if (modalInstance) modalInstance.hide();
    this.isDeletePromptOpen = false;
  }

  onConfirmDelete() {
    if (!this.selectedDoc) return;
    const payload: DeleteCountryDocumentRequestDto = {
      countryID: this.selectedDoc.countryID || 0,
      countryDocumentID: this.selectedDoc.countryDocumentID,
      isAll: false
    };
    this.aiComputationService.deleteDocument(payload).subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.toaster.showSuccess(res.messages.join(', '));
          this.loadPlatformDocuments();
          this.loadCountryDocuments();
          this.getAICountryDocuments(this.currentPage);
        } else {
          this.toaster.showError((res.messages || ['Delete failed.']).join(', '));
        }
      }
    });
    this.selectedDoc = null;
    this.closeModal();
  }

  retentionLabel(days?: number | null): string {
    if (days == null) return 'Until deleted';
    if (days === 365) return '1 year';
    if (days === 2555) return '7 years';
    return `${days} days`;
  }

  formatBytes(size: number): string {
    if (!size) return '0 KB';
    if (size < 1024) return `${size} B`;
    return `${(size / 1024).toFixed(1)} KB`;
  }

  formatStoredSize(size?: number): string {
    if (!size) return '0 KB';
    return `${size} KB`;
  }
}
