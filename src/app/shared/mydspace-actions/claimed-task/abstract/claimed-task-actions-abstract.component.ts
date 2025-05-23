import {
  Component,
  Injector,
  Input,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { RemoteData } from '../../../../core/data/remote-data';
import { RequestService } from '../../../../core/data/request.service';
import { DSpaceObject } from '../../../../core/shared/dspace-object.model';
import { Item } from '../../../../core/shared/item.model';
import { SearchService } from '../../../../core/shared/search/search.service';
import { WorkflowItem } from '../../../../core/submission/models/workflowitem.model';
import { ClaimedTaskDataService } from '../../../../core/tasks/claimed-task-data.service';
import { ClaimedTask } from '../../../../core/tasks/models/claimed-task-object.model';
import { CLAIMED_TASK } from '../../../../core/tasks/models/claimed-task-object.resource-type';
import { isEmpty } from '../../../empty.util';
import { NotificationsService } from '../../../notifications/notifications.service';
import { MyDSpaceReloadableActionsComponent } from '../../mydspace-reloadable-actions';

/**
 * Abstract component for rendering a claimed task's action
 * To create a child-component for a new option:
 * - Set the "option" of the component
 * - Add a @rendersWorkflowTaskOption annotation to your component providing the same enum value
 * - Optionally overwrite createBody if the request body requires more than just the option
 */
@Component({
  selector: 'ds-claimed-task-action-abstract',
  standalone: true,
  template: '',
})
export abstract class ClaimedTaskActionsAbstractComponent extends MyDSpaceReloadableActionsComponent<ClaimedTask, ClaimedTaskDataService> implements OnDestroy {

  /**
   * The workflow task option the child component represents
   */
  @Input() option: string;

  object: ClaimedTask;

  /**
   * The item object that belonging to the ClaimedTask object
   */
  @Input() item: Item;

  /**
   * Anchor used to reload the pool task.
   */
  itemUuid: string;

  subs = [];

  /**
   * The workflowitem object that belonging to the ClaimedTask object
   */
  @Input() workflowitem: WorkflowItem;

  protected constructor(protected injector: Injector,
                        protected router: Router,
                        protected notificationsService: NotificationsService,
                        protected translate: TranslateService,
                        protected searchService: SearchService,
                        protected requestService: RequestService) {
    super(CLAIMED_TASK, injector, router, notificationsService, translate, searchService, requestService);
  }

  /**
   * Submit the action on the claimed object.
   */
  submitTask() {
    this.subs.push(this.startActionExecution().pipe(take(1)).subscribe());
  }

  /**
   * Create a request body for submitting the task
   * Overwrite this method in the child component if the body requires more than just the option
   */
  createbody(): any {
    return {
      [this.option]: 'true',
    };
  }

  reloadObjectExecution(): Observable<RemoteData<DSpaceObject> | DSpaceObject> {
    return this.objectDataService.findByItem(this.itemUuid as string);
  }

  actionExecution(): Observable<any> {
    return this.objectDataService.submitTask(this.object.id, this.createbody());
  }

  initObjects(object: ClaimedTask) {
    this.object = object;
  }

  /**
   * Retrieve the itemUuid.
   */
  initReloadAnchor() {
    if (isEmpty(this.item)) {
      return;
    }
    this.itemUuid = this.item.uuid;
  }

  ngOnDestroy() {
    this.subs.forEach((sub) => sub.unsubscribe());
  }

}
