import { Component, OnDestroy, OnInit } from '@angular/core';
import { PaginationUserRequest } from 'src/app/core/models/PaginationRequest';
import { CityVM } from '../../../../core/models/CityVM';
import { PaginationResponse } from 'src/app/core/models/PaginationResponse';
import { ToasterService } from 'src/app/core/services/toaster.service';
import { UserService } from 'src/app/core/services/user.service';
import { SortDirection } from 'src/app/core/enums/SortDirection';
import { environment } from 'src/environments/environment';
import { CityUserService } from '../../city-user.service';
import { Router } from '@angular/router';
import { UserDataShareService } from '../../user-data-share.service';
import { TieredAccessPlanValue } from 'src/app/core/enums/TieredAccessPlan';
declare var bootstrap: any;
@Component({
  selector: 'app-city-view',
  templateUrl: './city-view.component.html',
  styleUrl: './city-view.component.css'
})
export class CityViewComponent {
  urlBase = environment.apiUrl;
  selectedCity: CityVM | null | undefined = null;
  citiesResponse: PaginationResponse<CityVM> | undefined;
  totalRecords: number = 0;
  pageSize: number = 10;
  currentPage: number = 1;
  loading: boolean = false;
  isLoader: boolean = false;
  isOpendialog = false;
  selectedCities: CityVM[] = [];
  cities: CityVM[] = [];
  tier: TieredAccessPlanValue = TieredAccessPlanValue.Pending;
  constructor(private cityuserService: CityUserService, private toaster: ToasterService,
    private userService: UserService, private router: Router, private userDataService: UserDataShareService) {
    this.tier = this.userService?.userInfo?.tier || 0;
  }

  ngOnInit(): void {
    this.getCities(1);
  }

  getCities(currentPage: any = 1) {
    this.citiesResponse = undefined;
    this.isLoader = true;
    let payload: PaginationUserRequest = {
      sortDirection: SortDirection.DESC,
      sortBy: 'score',
      pageNumber: currentPage,
      pageSize: this.pageSize,
      userId: this.userService?.userInfo?.userID
    }

    this.cityuserService.getCities(payload).subscribe(cities => {
      this.citiesResponse = cities;
      this.totalRecords = cities.totalRecords;
      this.currentPage = currentPage;
      this.pageSize = cities.pageSize;
      this.isLoader = false;
    });

  }

  ngOnDestroy(): void {

  }

  viewDetails(city: CityVM) {
    this.userDataService.city.set(city);
    this.router.navigate(['cityuser/city-details']);
  }


  CitySelected(event: any, city: CityVM) {
    const isChecked = event.target.checked;

    if (isChecked) {
      // Add city if not already in list
      const exists = this.selectedCities.some(c => c.cityID === city.cityID);
      if (!exists) {
        this.selectedCities.push(city);
      }
    } else {
      // Remove city if unchecked
      this.selectedCities = this.selectedCities.filter(c => c.cityID !== city.cityID);
    }
  }

  isCitySelected(city: CityVM): boolean {
    return this.selectedCities.some(x => x.cityID === city.cityID);
  }
  gotoComparision() {
    this.userDataService.compareCity.set(this.selectedCities);
    this.router.navigate(['/cityuser/comparision']);
  }

}
