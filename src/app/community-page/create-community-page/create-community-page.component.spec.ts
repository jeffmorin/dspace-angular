import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouteService } from '../../core/services/route.service';
import { of as observableOf } from 'rxjs';
import { CommunityDataService } from '../../core/data/community-data.service';
import { CreateCommunityPageComponent } from './create-community-page.component';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { NotificationsServiceStub } from '../../shared/testing/notifications-service.stub';
import { RequestService } from '../../core/data/request.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuthServiceMock } from '../../shared/mocks/auth.service.mock';
import { CommunityFormComponent } from '../community-form/community-form.component';

describe('CreateCommunityPageComponent', () => {
  let comp: CreateCommunityPageComponent;
  let fixture: ComponentFixture<CreateCommunityPageComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CommonModule, RouterTestingModule, CreateCommunityPageComponent],
      providers: [
        { provide: CommunityDataService, useValue: { findById: () => observableOf({}) } },
        { provide: RouteService, useValue: { getQueryParameterValue: () => observableOf('1234') } },
        { provide: Router, useValue: {} },
        { provide: NotificationsService, useValue: new NotificationsServiceStub() },
        { provide: RequestService, useValue: {} },
        { provide: AuthService, useValue: new AuthServiceMock() },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .overrideComponent(CreateCommunityPageComponent, {
        remove: {
          imports: [CommunityFormComponent]
        }
      })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateCommunityPageComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('frontendURL', () => {
    it('should have the right frontendURL set', () => {
      expect((comp as any).frontendURL).toEqual('/communities/');
    });
  });
});
