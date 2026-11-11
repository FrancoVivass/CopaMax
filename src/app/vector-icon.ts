import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type VectorIconName = 'spark' | 'ball' | 'cup';

@Component({
  selector: 'app-vector-icon',
  standalone: true,
  imports: [CommonModule],
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" [ngSwitch]="icon">
    <path *ngSwitchCase="'spark'" d="M12 1.5 14.7 9l7.8 3-7.8 3-2.7 7.5L9.3 15 1.5 12l7.8-3L12 1.5Z" />
    <g *ngSwitchCase="'ball'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25"/><path d="m12 7 3.2 2.3-1.2 3.8h-4L8.8 9.3 12 7Zm-3.2 2.3-3.5-.5m10.7.5 3.5-.5m-7.3-1.8V2.8m3 10.3 2.2 3.1m-9.2-3.1L7 16.2m3-3.1-.9 5.1m4.8-5.1.9 5.1"/></g>
    <path *ngSwitchCase="'cup'" d="M5 3h14v3c0 3.7-2.1 6.2-5.3 6.9V16h3.8v3H6.5v-3h3.8v-3.1C7.1 12.2 5 9.7 5 6V3Zm3 3c0 2.4.8 4 2.3 4.8V6H8Zm8 0v4.8c1.5-.8 2.3-2.4 2.3-4.8H16Z" />
  </svg>`,
  styles: [`:host{display:inline-flex;align-items:center;justify-content:center;line-height:0;vertical-align:middle}svg{display:block;width:1em;height:1em;fill:currentColor}`]
})
export class VectorIconComponent {
  @Input() icon: VectorIconName = 'spark';
}
