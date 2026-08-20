import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonService } from 'src/app/core/services/common.service';

@Component({
  selector: 'app-circular-score',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './circular-score.component.html',
  styleUrl: './circular-score.component.css'
})
export class CircularScoreComponent implements OnInit, OnChanges {

  commonService = inject(CommonService);
  @Input() value: number | null = null;
  @Input() tooltipText: string = '';
  @Input() maxRangeValue: number = 100;

  formattedValue: string = '';
  symbol: string = '';
  circumference: number = 2 * Math.PI * 20;
  dashOffset: number = 0;

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.value === null ||
      isNaN(this.value) ||
      !this.maxRangeValue ||
      this.maxRangeValue <= 0
    ) {
      this.formattedValue = 'NA';
      this.dashOffset = this.circumference;
      return;
    }

    const val = Number(this.value);

    // Convert value into 0-100 percentage based on maxRangeValue
    const percentage = (val / this.maxRangeValue) * 100;

    // Keep percentage between 0 and 100
    const progress = Math.min(Math.max(percentage, 0), 100);

    this.formattedValue =
      val === this.maxRangeValue || val === 0
        ? val.toFixed(0)
        : val.toFixed(2);

    // Calculate dash offset
    this.dashOffset = this.circumference * (1 - progress / 100);
  }

  getColor(value: number): string {
    const colors = this.commonService.PillarColors;

    // Convert value based on maxRangeValue to a 0-100 scale
    const percentage = this.maxRangeValue > 0
      ? (value / this.maxRangeValue) * 100
      : 0;

    if (percentage >= 90) return colors[0];
    else if (percentage >= 80) return colors[1];
    else if (percentage >= 70) return colors[2];
    else if (percentage >= 60) return colors[3];
    else if (percentage >= 50) return colors[4];
    else if (percentage >= 40) return colors[5];
    else if (percentage >= 30) return colors[6];
    else if (percentage >= 20) return colors[7];
    else if (percentage >= 10) return colors[8];
    else return colors[9];
  }

  getColorR(value: number): string {
    const colors = this.commonService.PillarColors;

    // Convert value based on maxRangeValue to a 0-100 scale
    const percentage = this.maxRangeValue > 0
      ? (value / this.maxRangeValue) * 100
      : 0;

    if (percentage >= 80) return colors[5];
    else if (percentage >= 60) return colors[4];
    else if (percentage >= 40) return colors[3];
    else return colors[1];
  }
}