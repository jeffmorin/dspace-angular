import { of } from 'rxjs';

/**
 * Mock for [[RouterService]]
 */
export class RouterMock {
  public events = of({});
  public routerState = {
    snapshot: {
      url: '',
      root: {
        queryParamMap: null,
      },
    },
  };

  // noinspection TypeScriptUnresolvedFunction
  navigate = jasmine.createSpy('navigate');
  navigateByUrl = jasmine.createSpy('navigateByUrl');

  setRoute(route) {
    this.routerState.snapshot.url = route;
  }

  setParams(paramsMap) {
    this.routerState.snapshot.root.queryParamMap = paramsMap;
  }

  createUrlTree(commands, navExtras = {}) {
    return {};
  }

  get url() {
    return this.routerState.snapshot.url;
  }

  serializeUrl(commands, navExtras = {}) {
    return '/testing-url';
  }
}
