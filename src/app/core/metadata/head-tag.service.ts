import {
  Inject,
  Injectable,
} from '@angular/core';
import {
  Meta,
  MetaDefinition,
  Title,
} from '@angular/platform-browser';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
} from '@angular/router';
import {
  createSelector,
  select,
  Store,
} from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import {
  BehaviorSubject,
  combineLatest,
  concat as observableConcat,
  EMPTY,
  Observable,
  of,
} from 'rxjs';
import {
  filter,
  map,
  mergeMap,
  switchMap,
  take,
} from 'rxjs/operators';

import {
  APP_CONFIG,
  AppConfig,
} from '../../../config/app-config.interface';
import { getBitstreamDownloadRoute } from '../../app-routing-paths';
import {
  hasNoValue,
  hasValue,
  isNotEmpty,
} from '../../shared/empty.util';
import { followLink } from '../../shared/utils/follow-link-config.model';
import { DSONameService } from '../breadcrumbs/dso-name.service';
import { coreSelector } from '../core.selectors';
import { CoreState } from '../core-state.model';
import { BundleDataService } from '../data/bundle-data.service';
import { AuthorizationDataService } from '../data/feature-authorization/authorization-data.service';
import { FindListOptions } from '../data/find-list-options.model';
import { PaginatedList } from '../data/paginated-list.model';
import { RemoteData } from '../data/remote-data';
import { RootDataService } from '../data/root-data.service';
import { HardRedirectService } from '../services/hard-redirect.service';
import { Bitstream } from '../shared/bitstream.model';
import { getDownloadableBitstream } from '../shared/bitstream.operators';
import { BitstreamFormat } from '../shared/bitstream-format.model';
import { Bundle } from '../shared/bundle.model';
import { DSpaceObject } from '../shared/dspace-object.model';
import { Item } from '../shared/item.model';
import {
  getFirstCompletedRemoteData,
  getFirstSucceededRemoteDataPayload,
} from '../shared/operators';
import { URLCombiner } from '../url-combiner/url-combiner';
import {
  AddMetaTagAction,
  ClearMetaTagAction,
} from './meta-tag.actions';
import { MetaTagState } from './meta-tag.reducer';

/**
 * The base selector function to select the metaTag section in the store
 */
const metaTagSelector = createSelector(
  coreSelector,
  (state: CoreState) => state.metaTag,
);

/**
 * Selector function to select the tags in use from the MetaTagState
 */
const tagsInUseSelector =
  createSelector(
    metaTagSelector,
    (state: MetaTagState) => state.tagsInUse,
  );

@Injectable({
  providedIn: 'root',
})
export class HeadTagService {

  private currentObject: BehaviorSubject<DSpaceObject> = new BehaviorSubject<DSpaceObject>(undefined);

  /**
   * When generating the citation_pdf_url meta tag for Items with more than one Bitstream (and no primary Bitstream),
   * the first Bitstream to match one of the following MIME types is selected.
   * See {@linkcode getFirstAllowedFormatBitstreamLink}
   * @private
   */
  private readonly CITATION_PDF_URL_MIMETYPES = [
    'application/pdf',                                                          // .pdf
    'application/postscript',                                                   // .ps
    'application/msword',                                                       // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
    'application/rtf',                                                          // .rtf
    'application/epub+zip',                                                     // .epub
  ];

  constructor(
    protected router: Router,
    protected translate: TranslateService,
    protected meta: Meta,
    protected title: Title,
    protected dsoNameService: DSONameService,
    protected bundleDataService: BundleDataService,
    protected rootService: RootDataService,
    protected store: Store<CoreState>,
    protected hardRedirectService: HardRedirectService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
    protected authorizationService: AuthorizationDataService,
  ) {
  }

  public listenForRouteChange(): void {
    // This never changes, set it only once
    this.setGenerator();

    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.routerState.root),
      map((route: ActivatedRoute) => {
        route = this.getCurrentRoute(route);
        return { params: route.params, data: route.data };
      })).subscribe((routeInfo: any) => {
      this.processRouteChange(routeInfo);
    });
  }

  protected processRouteChange(routeInfo: any): void {
    this.clearMetaTags();

    if (hasValue(routeInfo.data.value.dso) && hasValue(routeInfo.data.value.dso.payload)) {
      this.currentObject.next(routeInfo.data.value.dso.payload);
      this.setDSOMetaTags();
    }

    if (routeInfo.data.value.title) {
      const titlePrefix = this.translate.get('repository.title.prefix');
      const title = this.translate.get(routeInfo.data.value.title, routeInfo.data.value);
      combineLatest([titlePrefix, title]).pipe(take(1)).subscribe(([translatedTitlePrefix, translatedTitle]: [string, string]) => {
        this.addMetaTag('title', translatedTitlePrefix + translatedTitle);
        this.title.setTitle(translatedTitlePrefix + translatedTitle);
      });
    }
    if (routeInfo.data.value.description) {
      this.translate.get(routeInfo.data.value.description).pipe(take(1)).subscribe((translatedDescription: string) => {
        this.addMetaTag('description', translatedDescription);
      });
    }
  }

  protected getCurrentRoute(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }

  protected setDSOMetaTags(): void {

    this.setTitleTag();
    this.setDescriptionTag();

    this.setCitationTitleTag();
    this.setCitationAuthorTags();
    this.setCitationPublicationDateTag();
    this.setCitationISSNTag();
    this.setCitationISBNTag();

    this.setCitationLanguageTag();
    this.setCitationKeywordsTag();

    this.setCitationAbstractUrlTag();
    this.setCitationDoiTag();
    this.setCitationPdfUrlTag();
    this.setCitationPublisherTag();

    if (this.isDissertation()) {
      this.setCitationDissertationNameTag();
    }

    // this.setCitationJournalTitleTag();
    // this.setCitationVolumeTag();
    // this.setCitationIssueTag();
    // this.setCitationFirstPageTag();
    // this.setCitationLastPageTag();
    // this.setCitationPMIDTag();

    // this.setCitationFullTextTag();

    // this.setCitationConferenceTag();

    // this.setCitationPatentCountryTag();
    // this.setCitationPatentNumberTag();

  }

  /**
   * Add <meta name="title" ... >  to the <head>
   */
  protected setTitleTag(): void {
    const value = this.dsoNameService.getName(this.currentObject.getValue());
    this.addMetaTag('title', value);
    this.title.setTitle(value);
  }

  /**
   * Add <meta name="description" ... >  to the <head>
   */
  protected setDescriptionTag(): void {
    // TODO: truncate abstract
    const value = this.getMetaTagValue('dc.description.abstract');
    this.addMetaTag('description', value);
  }

  /**
   * Add <meta name="citation_title" ... >  to the <head>
   */
  protected setCitationTitleTag(): void {
    const value = this.getMetaTagValue('dc.title');
    this.addMetaTag('citation_title', value);
  }

  /**
   * Add <meta name="citation_author" ... >  to the <head>
   */
  protected setCitationAuthorTags(): void {
    const values: string[] = this.getMetaTagValues(['dc.author', 'dc.contributor.author', 'dc.creator']);
    this.addMetaTags('citation_author', values);
  }

  /**
   * Add <meta name="citation_publication_date" ... >  to the <head>
   */
  protected setCitationPublicationDateTag(): void {
    const value = this.getFirstMetaTagValue(['dc.date.copyright', 'dc.date.issued', 'dc.date.available', 'dc.date.accessioned']);
    this.addMetaTag('citation_publication_date', value);
  }

  /**
   * Add <meta name="citation_issn" ... >  to the <head>
   */
  protected setCitationISSNTag(): void {
    const value = this.getMetaTagValue('dc.identifier.issn');
    this.addMetaTag('citation_issn', value);
  }

  /**
   * Add <meta name="citation_isbn" ... >  to the <head>
   */
  protected setCitationISBNTag(): void {
    const value = this.getMetaTagValue('dc.identifier.isbn');
    this.addMetaTag('citation_isbn', value);
  }

  /**
   * Add <meta name="citation_language" ... >  to the <head>
   */
  protected setCitationLanguageTag(): void {
    const value = this.getFirstMetaTagValue(['dc.language', 'dc.language.iso']);
    this.addMetaTag('citation_language', value);
  }

  /**
   * Add <meta name="citation_dissertation_name" ... >  to the <head>
   */
  protected setCitationDissertationNameTag(): void {
    const value = this.getMetaTagValue('dc.title');
    this.addMetaTag('citation_dissertation_name', value);
  }

  /**
   * Add dc.publisher to the <head>. The tag name depends on the item type.
   */
  protected setCitationPublisherTag(): void {
    const value = this.getMetaTagValue('dc.publisher');
    if (this.isDissertation()) {
      this.addMetaTag('citation_dissertation_institution', value);
    } else if (this.isTechReport()) {
      this.addMetaTag('citation_technical_report_institution', value);
    } else {
      this.addMetaTag('citation_publisher', value);
    }
  }

  /**
   * Add <meta name="citation_keywords" ... >  to the <head>
   */
  protected setCitationKeywordsTag(): void {
    const value = this.getMetaTagValuesAndCombine('dc.subject');
    this.addMetaTag('citation_keywords', value);
  }

  /**
   * Add <meta name="citation_abstract_html_url" ... >  to the <head>
   */
  protected setCitationAbstractUrlTag(): void {
    if (this.currentObject.value instanceof Item) {
      let url = this.getMetaTagValue('dc.identifier.uri');
      if (hasNoValue(url)) {
        url = new URLCombiner(this.hardRedirectService.getCurrentOrigin(), this.router.url).toString();
      }
      this.addMetaTag('citation_abstract_html_url', url);
    }
  }

  /**
   * Add <meta name="citation_doi" ... >  to the <head>
   */
  protected setCitationDoiTag(): void {
    if (this.currentObject.value instanceof Item) {
      const doi = this.getMetaTagValue('dc.identifier.doi');
      if (hasValue(doi)) {
        this.addMetaTag('citation_doi', doi);
      }
    }
  }

  /**
   * Add <meta name="citation_pdf_url" ... >  to the <head>
   */
  protected setCitationPdfUrlTag(): void {
    if (this.currentObject.value instanceof Item) {
      const item = this.currentObject.value as Item;

      // Retrieve the ORIGINAL bundle for the item
      this.bundleDataService.findByItemAndName(
        item,
        'ORIGINAL',
        true,
        true,
        new FindListOptions(),
        followLink('primaryBitstream'),
        followLink('bitstreams', {
          findListOptions: {
            // limit the number of bitstreams used to find the citation pdf url to the number
            // shown by default on an item page
            elementsPerPage: this.appConfig.item.bitstream.pageSize,
          },
        }, followLink('format')),
      ).pipe(
        getFirstSucceededRemoteDataPayload(),
        switchMap((bundle: Bundle) =>
          // First try the primary bitstream
          bundle.primaryBitstream.pipe(
            getFirstCompletedRemoteData(),
            map((rd: RemoteData<Bitstream>) => {
              if (hasValue(rd.payload)) {
                return rd.payload;
              } else {
                return null;
              }
            }),
            getDownloadableBitstream(this.authorizationService),
            // return the bundle as well so we can use it again if there's no primary bitstream
            map((bitstream: Bitstream) => [bundle, bitstream]),
          ),
        ),
        switchMap(([bundle, primaryBitstream]: [Bundle, Bitstream]) => {
          if (hasValue(primaryBitstream)) {
            // If there was a downloadable primary bitstream, emit its link
            return [getBitstreamDownloadRoute(primaryBitstream)];
          } else {
            // Otherwise consider the regular bitstreams in the bundle
            return bundle.bitstreams.pipe(
              getFirstCompletedRemoteData(),
              switchMap((bitstreamRd: RemoteData<PaginatedList<Bitstream>>) => {
                if (hasValue(bitstreamRd.payload) && bitstreamRd.payload.totalElements === 1) {
                  // If there's only one bitstream in the bundle, emit its link if its downloadable
                  return this.getBitLinkIfDownloadable(bitstreamRd.payload.page[0], bitstreamRd);
                } else {
                  // Otherwise check all bitstreams to see if one matches the format whitelist
                  return this.getFirstAllowedFormatBitstreamLink(bitstreamRd);
                }
              }),
            );
          }
        }),
        take(1),
      ).subscribe((link: string) => {
        // Use the found link to set the <meta> tag
        this.addMetaTag(
          'citation_pdf_url',
          new URLCombiner(this.hardRedirectService.getCurrentOrigin(), link).toString(),
        );
      });
    }
  }

  getBitLinkIfDownloadable(bitstream: Bitstream, bitstreamRd: RemoteData<PaginatedList<Bitstream>>): Observable<string> {
    return of(bitstream).pipe(
      getDownloadableBitstream(this.authorizationService),
      switchMap((bit: Bitstream) => {
        if (hasValue(bit)) {
          return [getBitstreamDownloadRoute(bit)];
        } else {
          // Otherwise check all bitstreams to see if one matches the format whitelist
          return this.getFirstAllowedFormatBitstreamLink(bitstreamRd);
        }
      }),
    );
  }

  /**
   * For Items with more than one Bitstream (and no primary Bitstream), link to the first Bitstream
   * with a MIME type.
   *
   * Note this will only check the current page (page size determined item.bitstream.pageSize in the
   * config) of bitstreams for performance reasons.
   * See https://github.com/DSpace/DSpace/issues/8648 for more info
   *
   * included in {@linkcode CITATION_PDF_URL_MIMETYPES}
   * @param bitstreamRd
   * @private
   */
  protected getFirstAllowedFormatBitstreamLink(bitstreamRd: RemoteData<PaginatedList<Bitstream>>): Observable<string> {
    if (hasValue(bitstreamRd.payload) && isNotEmpty(bitstreamRd.payload.page)) {
      // Retrieve the formats of all bitstreams in the page sequentially
      return observableConcat(
        ...bitstreamRd.payload.page.map((bitstream: Bitstream) => bitstream.format.pipe(
          getFirstSucceededRemoteDataPayload(),
          // Keep the original bitstream, because it, not the format, is what we'll need
          // for the link at the end
          map((format: BitstreamFormat) => [bitstream, format]),
        )),
      ).pipe(
        // Verify that the bitstream is downloadable
        mergeMap(([bitstream, format]: [Bitstream, BitstreamFormat]) => of(bitstream).pipe(
          getDownloadableBitstream(this.authorizationService),
          map((bit: Bitstream) => [bit, format]),
        )),
        // Filter out only pairs with whitelisted formats and non-null bitstreams, null from download check
        filter(([bitstream, format]: [Bitstream, BitstreamFormat]) =>
          hasValue(format) && hasValue(bitstream) && this.CITATION_PDF_URL_MIMETYPES.includes(format.mimetype)),
        // We only need 1
        take(1),
        // Emit the link of the match
        // tap((v) => console.log('result', v)),
        map(([bitstream, format]: [Bitstream, BitstreamFormat]) => getBitstreamDownloadRoute(bitstream)),
      );
    } else {
      return EMPTY;
    }
  }

  /**
   * Add <meta name="Generator" ... >  to the <head> containing the current DSpace version
   */
  protected setGenerator(): void {
    this.rootService.findRoot().pipe(getFirstSucceededRemoteDataPayload()).subscribe((root) => {
      this.meta.addTag({ name: 'Generator', content: root.dspaceVersion });
    });
  }

  protected hasType(value: string): boolean {
    return this.currentObject.value.hasMetadata('dc.type', { value: value, ignoreCase: true });
  }

  /**
   * Returns true if this._item is a dissertation
   *
   * @returns {boolean}
   *      true if this._item has a dc.type equal to 'Thesis'
   */
  protected isDissertation(): boolean {
    return this.hasType('thesis');
  }

  /**
   * Returns true if this._item is a technical report
   *
   * @returns {boolean}
   *      true if this._item has a dc.type equal to 'Technical Report'
   */
  protected isTechReport(): boolean {
    return this.hasType('technical report');
  }

  protected getMetaTagValue(key: string): string {
    return this.currentObject.value.firstMetadataValue(key);
  }

  protected getFirstMetaTagValue(keys: string[]): string {
    return this.currentObject.value.firstMetadataValue(keys);
  }

  protected getMetaTagValuesAndCombine(key: string): string {
    return this.getMetaTagValues([key]).join('; ');
  }

  protected getMetaTagValues(keys: string[]): string[] {
    return this.currentObject.value.allMetadataValues(keys);
  }

  protected addMetaTag(name: string, content: string): void {
    if (content) {
      const tag = { name, content } as MetaDefinition;
      this.meta.addTag(tag);
      this.storeTag(name);
    }
  }

  protected addMetaTags(name: string, content: string[]): void {
    for (const value of content) {
      this.addMetaTag(name, value);
    }
  }

  protected storeTag(key: string): void {
    this.store.dispatch(new AddMetaTagAction(key));
  }

  protected clearMetaTags(): void {
    this.store.pipe(
      select(tagsInUseSelector),
      take(1),
    ).subscribe((tagsInUse: string[]) => {
      for (const name of tagsInUse) {
        this.meta.removeTag('name=\'' + name + '\'');
      }
      this.store.dispatch(new ClearMetaTagAction());
    });
  }


}
