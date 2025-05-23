import {
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { AlertComponent } from '../alert/alert.component';
import { AlertType } from '../alert/alert-type';

@Component({
  selector: 'ds-error',
  styleUrls: ['./error.component.scss'],
  templateUrl: './error.component.html',
  standalone: true,
  imports: [
    AlertComponent,
  ],
})
export class ErrorComponent implements OnDestroy, OnInit {

  @Input() message = 'Error...';

  /**
   * The AlertType enumeration
   * @type {AlertType}
   */
  public AlertTypeEnum = AlertType;

  private subscription: Subscription;

  constructor(private translate: TranslateService) {

  }

  ngOnInit(): void {
    if (this.message === undefined) {
      this.subscription = this.translate.get('error.default').subscribe((message: string) => {
        this.message = message;
      });
    }
  }

  ngOnDestroy(): void {
    if (this.subscription !== undefined) {
      this.subscription.unsubscribe();
    }
  }
}
