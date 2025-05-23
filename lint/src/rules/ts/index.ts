/**
 * The contents of this file are subject to the license and copyright
 * detailed in the LICENSE and NOTICE files at the root of the source
 * tree and available online at
 *
 * http://www.dspace.org/license/
 */
import {
  bundle,
  RuleExports,
} from '../../util/structure';
/* eslint-disable import/no-namespace */
import * as aliasImports from './alias-imports';
import * as sortStandaloneImports from './sort-standalone-imports';
import * as themedComponentClasses from './themed-component-classes';
import * as themedComponentSelectors from './themed-component-selectors';
import * as themedComponentUsages from './themed-component-usages';
import * as themedDecorators from './themed-decorators';
import * as themedWrapperNoInputDefaults from './themed-wrapper-no-input-defaults';
import * as uniqueDecorators from './unique-decorators';

const index = [
  aliasImports,
  sortStandaloneImports,
  themedComponentClasses,
  themedComponentSelectors,
  themedComponentUsages,
  themedDecorators,
  themedWrapperNoInputDefaults,
  uniqueDecorators,
] as unknown as RuleExports[];

export = {
  ...bundle('dspace-angular-ts', 'TypeScript',  index),
};
