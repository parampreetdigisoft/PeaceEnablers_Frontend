import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { PillarsVM } from "src/app/core/models/PillersVM";
import { CityVM } from "src/app/core/models/CityVM";
import { UserService } from "src/app/core/services/user.service";
import { CityMappingPillerRequestDto } from "src/app/core/models/QuestionRequest";
import { GetQuestionByCityMappingRespones } from "src/app/core/models/QuestonResponse";
import { ToasterService } from "src/app/core/services/toaster.service";
import { FormBuilder, FormGroup, FormArray, Validators } from "@angular/forms";
import {
  AddAssessmentDto,
  AddAssessmentResponseDto,
  GetCityPillarHistoryRequestDto,
} from "src/app/core/models/AssessmentRequest";
import { AnalystService } from "../../analyst.service";
import { environment } from "src/environments/environment";
import { CommonService } from "src/app/core/services/common.service";
import { finalize } from "rxjs";
import { AiComputationService } from "src/app/core/services/ai-computation.service";
import { AITransferAssessmentRequestDto } from "src/app/core/models/aiVm/AITransferAssessmentRequestDto";
import { AdminService } from "src/app/features/admin/admin.service";
import { ExportType } from "src/app/core/enums/exportEnum";

@Component({
  selector: "app-analyst-assessment",
  templateUrl: "./analyst-assessment.component.html",
  styleUrls: ["./analyst-assessment.component.css"], // ✅ fixed
})
export class AnalystAssessmentComponent implements OnInit, OnDestroy {
  pillars: PillarsVM[] = [];
  cities: CityVM[] = []; // ✅ fixed type
  selectedUserCityMappingID: number = 0;
  pillerQuestions: GetQuestionByCityMappingRespones | null = null;
  form!: FormGroup;
  pillarDisplayOrder: number = 1;
  selectedPillar?: PillarsVM;
  @ViewChild("scrollContainer") scrollContainer!: ElementRef;
  isloading = false;
  isUploading = false;
  isLoader: boolean = false;
  urlBase = environment.apiUrl;
  isAssessementFinalized = false;
  isAItransfer: boolean = false;
  selectedYear = new Date().getFullYear();
  constructor(
    private analystService: AnalystService,
    private userService: UserService,
    private toaster: ToasterService,
    private fb: FormBuilder,
    private commonService: CommonService,
    private aiComputationService: AiComputationService,
    private adminService: AdminService
  ) { }

  ngOnInit(): void {
    this.isLoader = true;
    this.formInitialized();
    this.GetAllPillars();
    this.getCityByUserIdForAssessment();
  }

  get questions() {
    return this.pillerQuestions?.questions ?? [];
  }

  formInitialized() {
    this.form = this.fb.group({
      questions: this.fb.array([]),
    });
  }

  get questionsArray(): FormArray {
    return this.form.get("questions") as FormArray;
  }

  loadQuestions() {
    this.pillerQuestions?.questions.forEach((q) => {
      let option = q.questionOptions.find((x) => x.isSelected);
      this.questionsArray.push(
        this.fb.group({
          questionID: [q.questionID, Validators.required],
          responseID: [q.responseID],
          assessmentID: [this.pillerQuestions?.assessmentID],
          questionOptionID: [
            q.isSelected ? option?.optionID : "",
            Validators.required,
          ],
          score: [q.isSelected ? option?.scoreValue : ""],
          justification: [
            q.isSelected ? option?.justification : "",
            Validators.required,
          ],
          source: [q.isSelected ? option?.source : ""],
          historyQuestionOptionID: [""],
        })
      );
    });
  }

  onOptionChange(event: any, index: number) {
    const optionId = +event.target.value;
    const selectedOption = this.pillerQuestions?.questions[
      index
    ].questionOptions.find((o) => o.optionID === optionId);

    if (selectedOption) {
      const formGroup = this.questionsArray.at(index) as FormGroup;
      formGroup.patchValue({
        questionOptionID: selectedOption.optionID,
        score: selectedOption.scoreValue,
        historyQuestionOptionID: ''
      });
    }
  }

  GetAllPillars() {
    this.analystService.getAllPillars().subscribe((pillars) => {
      this.pillars = pillars;
    });
  }
  pillarChanged(pillar?: PillarsVM) {
    if (!this.selectedUserCityMappingID || this.selectedUserCityMappingID == 0) {
      this.toaster.showWarning("Please select city first");
      return;
    }

    this.isAssessementFinalized = false;
    if (pillar) {
      this.selectedPillar = pillar;
      this.getQuestionsByCityId();
    }
    else {
      this.selectedPillar = this.pillars.find((x) => x.pillarID == this.pillerQuestions?.pillarID);
      if (this.pillerQuestions && this.pillerQuestions?.submittedPillarDisplayOrder < (this.selectedPillar?.displayOrder ?? 0)) {
        this.pillarDisplayOrder = this.selectedPillar?.displayOrder ?? 1;
      }
    }
  }
  cityChanged() {
    this.selectedPillar = undefined;
    this.getQuestionsByCityId();
  }

  getCityByUserIdForAssessment() {
    this.selectedPillar = undefined;
    this.commonService.getUserNearestCity()
      .subscribe({
        next: (res) => {
          this.cities = res.result ?? [];
          if (this.cities.length > 0) {
            this.selectedUserCityMappingID = this.analystService.userCityMappingIDSubject$.value != null ?
              this.analystService.userCityMappingIDSubject$.value
              : this.cities[0].userCityMappingID ?? 0;
            setTimeout(() => {
              this.toaster.showInfo("You have rediredected to assgined city, please submit all pillars for the city");
            }, 1000);
            this.getQuestionsByCityId();
          } else {
            this.toaster.showWarning(res.errors.join(", "));
          }
        },
        error: () => {
          this.toaster.showWarning("There is an error please try again");
        },
      });
  }

  getQuestionsByCityId() {
    if (
      !this.selectedUserCityMappingID ||
      this.selectedUserCityMappingID == 0
    ) {
      this.toaster.showWarning("Please select city first");
      return;
    }
    this.formInitialized();
    const payload: CityMappingPillerRequestDto = {
      userCityMappingID: this.selectedUserCityMappingID ?? 0,
    };
    if (this.selectedPillar) {
      payload.pillarID = this.selectedPillar.pillarID;
    }
    this.pillerQuestions = null;
    this.isLoader = true;
    this.analystService.getQuestionsByCityId(payload).subscribe({
      next: (res) => {
        this.isLoader = false;
        if (res.succeeded) {
          this.pillerQuestions = res.result;
          this.pillarDisplayOrder = this.pillerQuestions?.submittedPillarDisplayOrder ?? 1;
          if (this.pillerQuestions && this.pillerQuestions?.assessmentID > 0) {
            this.getAssessmentProgressHistory();
          } else {
            this.userService.assessmentProgress.next(null);
          }
          this.pillarChanged();
          this.loadQuestions();
        } else {
          this.toaster.showWarning("City's assessment is already submitted");
        }
      },
    });
  }

  SaveAssessment() {
    if (
      !this.selectedUserCityMappingID ||
      this.selectedUserCityMappingID == 0
    ) {
      this.toaster.showWarning("Please select city first");
      return;
    }
    const validQuestions = this.questionsArray.controls
      .filter((ctrl) => ctrl.valid)
      .map((ctrl) => ctrl.value as AddAssessmentResponseDto);
    const payload: AddAssessmentDto = {
      userCityMappingID: this.selectedUserCityMappingID,
      assessmentID: this.pillerQuestions?.assessmentID ?? 0,
      pillarID: this.pillerQuestions?.pillarID ?? 0,
      responses: validQuestions ?? [],
      isAutoSave: false,
      isFinalized: this.isAssessementFinalized
    };
    if (
      this.pillerQuestions?.pillarID != null &&
      this.pillerQuestions?.pillarID > 0
    ) {
      this.analystService.saveAssessment(payload).subscribe({
        next: (res) => {
          setTimeout(() => {
            this.scrollContainer.nativeElement.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }, 300);
          if (res.succeeded) {
            if (this.pillerQuestions?.displayOrder == 14 || this.isAssessementFinalized) {
              this.analystService.userCityMappingIDSubject$.next(null);
              this.getCityByUserIdForAssessment();
            } else {
              if (this.selectedPillar)
                this.selectedPillar = this.pillars.find(x => x.displayOrder == (Number(this.selectedPillar?.displayOrder) + 1));
              this.getQuestionsByCityId();
            }
            this.toaster.showSuccess(res.messages.join(", "));
          } else {
            this.toaster.showError(res.errors.join(", "));
          }
        },
        error: () => {
          this.toaster.showError("Failed to save assessment. Try again.");
        },
      });
    } else {
      this.toaster.showWarning("Please refresh the page and try again");
    }
  }

  ngOnDestroy(): void {
    this.userService.assessmentProgress.next(null);
  }

  ImportQuestions() {
    if (this.selectedUserCityMappingID != 0) {
      this.isloading = true;
      this.analystService
        .ExportQuestions(this.selectedUserCityMappingID)
        .subscribe({
          next: (res: any) => {
            var city = this.cities?.find(
              (x) => x.userCityMappingID == this.selectedUserCityMappingID
            );
            this.isloading = false;
            const url = window.URL.createObjectURL(res);
            const a = document.createElement("a");
            a.href = url;
            a.download =
              city?.cityName + "_" + city?.assignedBy + "_Questions.xlsx";
            a.click();
            this.toaster.showSuccess("Questions downloaded successfully");
          },
          error: () => {
            this.isloading = false;
            this.toaster.showError("failed to download questions try again");
          },
        });
    } else {
      this.toaster.showWarning("Please select city to get questions");
    }
  }

  handleFileUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userID", this.userService?.userInfo?.userID?.toString());
    this.isUploading = true;
    this.analystService.ImportAssessment(formData).subscribe({
      next: (res) => {
        this.selectedPillar = undefined;
        this.isUploading = false;
        if (res.succeeded) {
          this.getCityByUserIdForAssessment();
          this.toaster.showSuccess(res.messages.join(", "));
        } else {
          this.toaster.showError(res.errors.join(", "));
        }
      },
      error: () => {
        this.isUploading = false;
        this.toaster.showError("failed to download questions try again");
      },
    });
  }
  getAssessmentProgressHistory() {
    this.analystService
      .getAssessmentProgressHistory(this.pillerQuestions?.assessmentID ?? 0)
      .subscribe((res) => {
        if (res.succeeded) {
          this.userService.assessmentProgress.next(res.result);
        } else {
          this.toaster.showError("Failed to fetch assessment progress history");
        }
      });
  }

  autoSaveSingleAssessemnt(index: number) {
    if (this.questionsArray.controls[index].valid) {
      if (!this.selectedUserCityMappingID || this.selectedUserCityMappingID == 0) {
        this.toaster.showWarning("Please select city first");
        return;
      }
      const payload: AddAssessmentDto = {
        userCityMappingID: this.selectedUserCityMappingID,
        assessmentID: this.pillerQuestions?.assessmentID ?? 0,
        pillarID: this.pillerQuestions?.pillarID ?? 0,
        responses: [this.questionsArray.controls[index].value],
        isAutoSave: true,
        isFinalized: false
      };
      this.analystService.saveAssessment(payload).subscribe({
        next: (res) => {
          if (res.succeeded) {
          }
        },
        error: () => {
          this.toaster.showError("Failed to save assessment. Try again.");
        },
      });
    }
  }
  decodeHtml(text: string | undefined): string {
    if (text) {
      const txt = document.createElement('textarea');
      txt.innerHTML = text;
      return txt.value.replace(/\u00a0/g, ' '); // Replace non-breaking space with normal space
    }
    return "";
  }
  aiResultTransfer() {

    const city = this.cities.find(x => x.userCityMappingID === Number(this.selectedUserCityMappingID));

    if (!city) {
      this.toaster.showWarning("Please select a city");
      return;
    }

    const payload: AITransferAssessmentRequestDto = {
      cityID: city.cityID,
      transferToUserID: this.userService.userInfo?.userID
    };

    this.isAItransfer = true;
    this.isLoader = true;

    this.aiComputationService.aiResultTransfer(payload)
      .pipe(finalize(() => {
        this.isLoader = false
        this.isAItransfer = false
      }))
      .subscribe({
        next: (res: any) => {
          if (res?.succeeded) {
            this.cityChanged();
            this.toaster.showSuccess(res.messages?.join(", ") || "Transfer successful");
          } else {
            this.toaster.showError(res.errors?.join(", ") || "Transfer failed");
          }
        },
        error: () => {
          this.toaster.showError("Failed to transfer assessment. Please try again.");
        }
      });
  }
  downloadQuestions(mode: string) {
    if (mode === 'excel') { this.ImportQuestions() }
    else { this.exportPillarsHistoryByUserId(ExportType.Pdf); }


  }

  exportPillarsHistoryByUserId(type: ExportType) {   
    if (
      this.userService?.userInfo?.userID == null ||
      !this.selectedUserCityMappingID ||
      this.selectedUserCityMappingID == 0 ||
      this.selectedUserCityMappingID == null
    ) {
      return;
    }

    const selectedCity = this.cities.find(
      (x: any) => x.userCityMappingID == this.selectedUserCityMappingID
    );

    if (!selectedCity) {
      this.isLoader = false;
      return;
    }

    let payload: GetCityPillarHistoryRequestDto = {
      userID: this.userService?.userInfo?.userID,
      cityID: selectedCity.cityID,   // ✅ Correct cityID
      updatedAt: this.commonService.getStartOfYearLocal(this.selectedYear),
      exportType: type
    };


    this.adminService.exportPillarsHistoryByUserId(payload).subscribe({
      next: (res: Blob) => {
        const url = window.URL.createObjectURL(res);

        const a = document.createElement("a");
        a.href = url;

        // ✅ Dynamic filename
        a.download = type === ExportType.Pdf
          ? "PillarQuestionHistory.pdf"
          : "PillarQuestionHistory.xlsx";

        a.click();
        window.URL.revokeObjectURL(url);

        this.isLoader = false;
        const fileType = type === ExportType.Pdf ? "PDF" : "EXCEL";

        this.toaster.showSuccess(`Pillars History ${fileType} downloaded successfully`);
      },
      error: () => {
        this.isLoader = false;
        this.toaster.showError("There is an error please try later");
      },
    });
  }
  onHistoryOptionChange(event: any, index: number) {
    const userId = +event.target.value;
    const selectedOption = this.pillerQuestions?.questions[
      index
    ].history.find((o) => o.userID === userId);

    if (selectedOption) {
      const formGroup = this.questionsArray.at(index) as FormGroup;
      formGroup.patchValue({
        questionOptionID: selectedOption.optionID,
        score: selectedOption.scoreValue,
        source: selectedOption.source,
        justification: selectedOption.justification,
        historyQuestionOptionID: selectedOption.userID
      });
      this.autoSaveSingleAssessemnt(index);
    }
  }
}
