import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { UpdateInviteUserDto } from 'src/app/core/models/AnalystVM';
import { CountryVM } from 'src/app/core/models/CountryVM';
import { UserService } from 'src/app/core/services/user.service';
import { CountryUserService } from '../../country-user.service';
import { AnalyticalLayerResponseDto } from 'src/app/core/models/GetAnalyticalLayerResultDto';
import { PillarsVM } from 'src/app/core/models/PillersVM';
import { TieredAccessPlanValue } from 'src/app/core/enums/TieredAccessPlan';

@Component({
  selector: 'app-choose-kpis',
  templateUrl: './choose-kpis.component.html',
  styleUrl: './choose-kpis.component.css'
})
export class ChooseKpisComponent {
  kpis: AnalyticalLayerResponseDto[] = [];
  countryList: CountryVM[] = [];
  @Input() pillars: PillarsVM[] = [];
  tier: TieredAccessPlanValue = TieredAccessPlanValue.Pending;
  @Output() kpiChange = new EventEmitter<any | null>();
  @Output() closeAnalystModel = new EventEmitter<boolean>();
  @Input() loading: boolean = false;
  alertMsg = "";
  excelData: any;
  isSubmitted: boolean = false;
  kpiForm: FormGroup<any> = this.fb.group({});
  pillarLimitMsg: string = '';
  limitMessages: { [key: string]: string } = {};
  premiumGeoMode: 'select' | 'all' = 'select';
  pillarLimits: any = {
    1: { min: 1, max: 7, name: 'Basic' },
    2: { min: 1, max: 12, name: 'Standard' }
  };

  get isPremium(): boolean {
    return this.tier === TieredAccessPlanValue.Premium;
  }

  constructor(private fb: FormBuilder, private countryUserService: CountryUserService, private userService: UserService) {
    this.tier = this.userService?.userInfo?.tier || TieredAccessPlanValue.Pending;
  }
  ngOnInit(): void {
    this.initializeForm();
    this.getAllCountries();
    if (this.isPremium) {
      this.applyPremiumPillars();
      this.kpiForm.get('pillars')?.clearValidators();
      this.kpiForm.get('pillars')?.updateValueAndValidity({ emitEvent: false });
    }
  }
  initializeForm() {
    this.kpiForm = this.fb.group({
      pillars: [[], this.isPremium ? [] : [Validators.required]],
      countries: [[], [Validators.required]]
    });
  }
  trackByFn(item: any) {
    return item.pillarID;
  }
  ngOnChanges(changes: SimpleChanges): void {
    this.alertMsg = "";
    this.isSubmitted = false;
    if (this.isPremium && this.pillars?.length) {
      this.applyPremiumPillars();
    }
  }

  GetAllKpi() {
    this.countryUserService.GetAllKpi().subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.kpis = res.result ?? [];
        }
      }
    });
  }
  getAllCountries() {
    this.countryUserService.getAllCountries().subscribe({
      next: (res) => {
        if (res.succeeded) {
          this.countryList = res.result ?? [];
        }
      }
    });
  }

  onPremiumGeoModeChange(mode: 'select' | 'all'): void {
    this.premiumGeoMode = mode;
    this.limitMessages['countries'] = '';
    if (mode === 'all') {
      this.kpiForm.patchValue({ countries: [] }, { emitEvent: false });
      this.kpiForm.get('countries')?.clearValidators();
      this.kpiForm.get('countries')?.updateValueAndValidity({ emitEvent: false });
    } else {
      this.kpiForm.get('countries')?.setValidators([Validators.required]);
      this.kpiForm.get('countries')?.updateValueAndValidity({ emitEvent: false });
    }
  }

  private applyPremiumPillars(): void {
    const allPillarIds = (this.pillars ?? []).map(p => p.pillarID);
    this.kpiForm.patchValue({ pillars: allPillarIds }, { emitEvent: false });
  }

  checkSelectionLimit(controlName: string) {
    const selected = this.kpiForm.get(controlName)?.value || [];
    let message = '';

    if (!Array.isArray(selected)) {
      this.limitMessages[controlName] = '';
      return;
    }

    if (controlName === 'countries') {
      if (this.isPremium && this.premiumGeoMode === 'all') {
        this.limitMessages[controlName] = '';
        return;
      }
      if (selected.length < 1) {
        message = 'Please select at least one country.';
      }
      this.limitMessages[controlName] = message;
      return;
    }

    if (controlName === 'pillars') {
      if (this.isPremium) {
        this.limitMessages[controlName] = '';
        return;
      }
      const limits = this.pillarLimits[this.tier];
      if (!limits) {
        this.limitMessages[controlName] = 'Invalid tier access.';
        return;
      }
      if (selected.length > limits.max) {
        this.kpiForm.patchValue({ pillars: selected.slice(0, limits.max) });
        message = `${limits.name} plan allows maximum ${limits.max} pillars.`;
      } else if (selected.length < limits.min) {
        message = `${limits.name} plan requires at least ${limits.min} pillar.`;
      }
      this.limitMessages[controlName] = message;
    }
  }

  onSubmit() {
    this.isSubmitted = true;
    const isAllCountries = this.isPremium && this.premiumGeoMode === 'all';
    if (this.isPremium) {
      this.applyPremiumPillars();
      if (isAllCountries) {
        this.kpiForm.patchValue({ countries: [] }, { emitEvent: false });
        this.kpiForm.get('countries')?.clearValidators();
        this.kpiForm.get('countries')?.updateValueAndValidity({ emitEvent: false });
      }
    }

    this.checkSelectionLimit('pillars');
    this.checkSelectionLimit('countries');
    if (this.limitMessages['pillars'] || this.limitMessages['countries']) {
      return;
    }

    if (this.kpiForm.valid) {
      this.kpiChange.emit({
        ...this.kpiForm.value,
        countries: isAllCountries ? [] : this.kpiForm.value.countries,
        isAllCountries
      });
    }
  }
  closeModel() {
    this.closeAnalystModel.emit(true);
  }
}
