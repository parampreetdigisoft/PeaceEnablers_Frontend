import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AiComputationService } from 'src/app/core/services/ai-computation.service';
import { ToasterService } from 'src/app/core/services/toaster.service';
import { AiCitySummeryRequestDto } from 'src/app/core/models/aiVm/AiCitySummeryRequestDto';
import { SortDirection } from 'src/app/core/enums/SortDirection';
import { UserService } from 'src/app/core/services/user.service';
import { AiCitySummeryDto } from 'src/app/core/models/aiVm/AiCitySummeryDto';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { TypingTextComponent } from 'src/app/shared/standAlone/typing-text/typing-text.component';
import { CityUserService } from 'src/app/features/city-user/city-user.service';
import { CityVM } from 'src/app/core/models/CityVM';
import { CircularScoreComponent } from 'src/app/shared/standAlone/circular-score/circular-score.component';
import { PaginationComponent } from 'src/app/shared/pagination/pagination.component';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ViewCityDetailComponent } from '../../features/view-city-detail/view-city-detail.component';
import { AiCitySummeryRequestPdfDto } from 'src/app/core/models/aiVm/AiCitySummeryRequestPdfDto';
import { CommonService } from 'src/app/core/services/common.service';

declare var bootstrap: any; // 👈 use Bootstrap JS API
@Component({
  selector: 'app-aicity-analysis',
  standalone: true,
  imports: [TypingTextComponent, CommonModule,
    ViewCityDetailComponent, CircularScoreComponent, PaginationComponent, FormsModule, NgSelectModule,
    MatTooltipModule],
  templateUrl: './aicity-analysis.component.html',
  styleUrl: './aicity-analysis.component.css'
})
export class AICityAnalaysisComponent implements OnInit, OnDestroy {
  selectedYear = new Date().getFullYear();
  urlBase = environment.apiUrl;
  totalRecords: number = 0;
  pageSize: number = 10;
  currentPage: number = 1;
  isLoader: boolean = false;
  aiCities: AiCitySummeryDto[] = []
  selectedCity?: AiCitySummeryDto | null = null;
  cities: CityVM[] | null = [];
  filterCity!: number;
  isDownloading: boolean = false;
  selectedIndex: number = -1;

  constructor(private aiComputationService: AiComputationService, private cityUserService: CityUserService,
    private toaster: ToasterService, private userService: UserService, private cdr: ChangeDetectorRef,public commonService: CommonService) { }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  ngOnInit(): void {
    this.getCityUserCities();
    this.getAiCities();
  }
    yearChanged() {
    this.getAiCities();
  }

  getCityUserCities() {
    this.cityUserService.getCityUserCities().subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.cities = res.result;
        }
        else {
          this.toaster.showError(res.errors.join(', '));
        }
      },
      error: () => {
        this.isLoader = false;
        this.toaster.showError('There is an error occure please try again')
      }
    });
  }


  getAiCities(currentPage: any = 1) {
    this.isLoader = true;
    let payload: AiCitySummeryRequestDto = {
      sortDirection: SortDirection.DESC,
      sortBy: 'AIScore',
      pageNumber: currentPage,
      pageSize: this.pageSize,
      year:this.selectedYear
    }
    if (this.userService?.userInfo?.userID == null || this.filterCity > 0) {
      payload.cityID = this.filterCity;
    }
    this.aiCities = [];
    this.aiComputationService.getAICities(payload).subscribe({
      next: (res) => {
        this.aiCities = res.data;
        this.totalRecords = res.totalRecords;
        this.currentPage = currentPage;
        this.pageSize = res.pageSize;
        this.isLoader = false;
      },
      error: () => {
        this.isLoader = false;
        this.toaster.showError("There is an Error Please Try later")
      }
    })
  }
  viewDetails(city: AiCitySummeryDto) {
    this.selectedCity = city;
    const sidebarEl = document.getElementById('kpiLayerSidebar');
    const offcanvas = new bootstrap.Offcanvas(sidebarEl);
    // Clear selection when sidebar closes
    sidebarEl?.addEventListener('hidden.bs.offcanvas', () => {
      this.selectedCity = null;
      this.cdr.detectChanges();
    }, { once: true });

    offcanvas.show();
  }

  aiCityDetailsReport(city: AiCitySummeryDto, selectedIndex: number) {
    if(this.selectedIndex != -1) return;
    this.selectedIndex = selectedIndex;
    let payload: AiCitySummeryRequestPdfDto = {
      cityID: city.cityID,
      year: this.selectedYear
    }
    this.aiComputationService.aiCityDetailsReport(payload).subscribe({
      next: (blob) => {
        this.selectedIndex = -1;
        if (blob) {
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${city.cityName}_Details_${new Date().toISOString().split('T')[0]}.pdf`;

          // Trigger download
          document.body.appendChild(link);
          link.click();

          // Cleanup
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          this.toaster.showSuccess('Report generated successfully')
        }
      },
      error: () => {
        this.toaster.showError('There is an error occure please try again');
        this.selectedIndex = -1;
      }
    });
  }
}
