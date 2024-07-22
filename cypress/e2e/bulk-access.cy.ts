import { testA11y } from 'cypress/support/utils';
import { Options } from 'cypress-axe';

describe('Bulk Access', () => {
  beforeEach(() => {
    // Must login as an Admin to see the page
    cy.visit('/access-control/bulk-access');
    cy.loginViaForm(Cypress.env('DSPACE_TEST_ADMIN_USER'), Cypress.env('DSPACE_TEST_ADMIN_PASSWORD'));
  });

  it('should pass accessibility tests', () => {
    // Page must first be visible
    cy.get('ds-bulk-access').should('be.visible');
    // Analyze <ds-bulk-access> for accessibility issues
    testA11y('ds-bulk-access', {
      rules: {
        // All panels are accordians & fail "aria-required-children" and "nested-interactive".
        // Seem to require updating ng-bootstrap and https://github.com/DSpace/dspace-angular/issues/2216
        'aria-required-children': { enabled: false },
        'nested-interactive': { enabled: false },
      },
    } as Options);
  });
});
