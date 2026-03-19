import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PillarsVM } from 'src/app/core/models/PillersVM';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-update-pillar',
  templateUrl: './update-pillar.component.html',
  styleUrl: './update-pillar.component.css'
})
export class UpdatePillarComponent implements OnInit, AfterViewInit {
  @Input() pillar: PillarsVM | null = null;
  @Output() pillarChange = new EventEmitter<PillarsVM | null>();
  @Input() loading: boolean = false;
  selectedImage: string | ArrayBuffer | null = null;
  imageFile: File | null = null;
  imageError: string = '';
  isSubmitted = false;
  pillarForm!: FormGroup;
   urlBase = environment.apiUrl;
@ViewChild('fileInput') fileInput!: ElementRef;

  constructor(private fb: FormBuilder) { }
  ngAfterViewInit(): void {

  }
  onEditorCreated(quill: any) {
    const html = this.pillarForm.get('description')?.value ?? '';
    if (html) {
      // ensures content appears even if initialization happened early
      quill.clipboard.dangerouslyPasteHTML(html);
    }
  }
   onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/images/noImageAvailable.png';
  }

  ngOnInit(): void {
    this.initializeForm();    
  }

  initializeForm() {
    this.pillarForm = this.fb.group({
      pillarName: ['', Validators.required],
      weight: ['1', [Validators.required, Validators.min(0.01)]],
      reliability: [true, [Validators.required]],
      description: ['', Validators.required],
      imageFile:[null],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.isSubmitted = false;
    this.imageFile = null;
    if(this.fileInput)
    {
       this.fileInput.nativeElement.value = '';
    }
    this.selectedImage = null;
    if (this.pillarForm && !this.loading) {
      this.pillarForm.patchValue({
        pillarName: this.pillar?.pillarName ?? '',
        description: this.pillar?.description ?? '',
        weight: this.pillar?.weight ?? 1,
        reliability: this.pillar?.reliability ?? 1
      });
    } else {
      //this.initializeForm();
    }
  }

  onSubmit() {   
    this.isSubmitted = true;
    if (this.pillarForm.valid) {
      const pillarData: PillarsVM = {
        ...this.pillarForm.value,
        pillarID: this.pillar?.pillarID ?? 0,
        displayOrder: this.pillar?.displayOrder
      };
       if (this.imageFile) {
      pillarData.imageFile = this.imageFile;
    }
      this.pillarChange.emit(pillarData);
      this.isSubmitted = false;
    }
  }
   onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.imageError = 'Please select a valid image file.';
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5 MB limit
      this.imageError = 'Image size should be less than 5MB.';
      return;
    }

    this.imageError = '';
    this.imageFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.selectedImage = reader.result;
    };
    reader.readAsDataURL(file);

    // Add file to form control
    this.pillarForm.patchValue({ image: file });
  }
}