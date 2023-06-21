'use strict';

const {
  flow,
  startsWith,
  replace,
  get,
  toLower,
  trim,
  includes,
  first,
  filter,
  map,
  uniqWith,
  isEqual,
  pick,
  size
} = require('lodash/fp');
const { getLogger } = require('./logger');
const { escapeQuotes } = require('./utils');
const { parseErrorToReadableJSON } = require('./errors');

const { searchKvStoreAndAddToResults } = require('./getKvStoreQueryResults');
const { buildMultiEntityMetaSearchTask } = require('./buildMultiEntityMetaSearchTask');

const EXPECTED_QUERY_STATUS_CODES = [200, 404];
const VALID_SPL_COMMAND_REGEXES = [
  /search/i,
  /\|\s*metasearch/i,
  /\|\s*tstats/i,
  /\|\s*inputlookup/i,
  /\|\s*`/i //macros in Splunk are encapsulated in backticks
];

const buildMultiEntityQueryTask =
  (entityGroup, options, requestWithDefaults, Logger) => (done) => {
    if (options.searchType.value === 'searchKvStore') {
      searchKvStoreAndAddToResults(
        entityGroup,
        options,
        requestWithDefaults,
        done,
        Logger
      );
    } else if (
      options.searchType.value === 'metaSearch' ||
      options.searchType.value === 'metaSearchTerm'
    ) {
      buildMultiEntityMetaSearchTask(
        entityGroup,
        options,
        requestWithDefaults,
        Logger,
        done
      );
    } else {
      let requestOptions = {
        method: 'GET',
        uri: `${options.url}/services/search/jobs/export`,
        qs: {
          search: buildSearchString(entityGroup, options, Logger),
          output_mode: 'json'
        },
        json: false
      };

      if (options.earliestTimeBound.length > 0) {
        requestOptions.qs.earliest_time = options.earliestTimeBound;
      }

      Logger.trace({ requestOptions }, 'Custom SPL Search Request Options');

      requestWithDefaults(
        requestOptions,
        options,
        handleStandardQueryResponse(
          entityGroup,
          options,
          requestWithDefaults,
          done,
          Logger
        )
      );
    }
  };

const handleStandardQueryResponse =
  (entityGroup, options, requestWithDefaults, done, Logger) => (error, res, body) => {
    Logger.trace(
      { body, statusCode: res ? res.statusCode : 'N/A' },
      'Raw Query Response'
    );
    const responseHadUnexpectedStatusCode = !EXPECTED_QUERY_STATUS_CODES.includes(
      get('statusCode', res)
    );

    const err =
      error && JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    if (err || responseHadUnexpectedStatusCode) {
      const formattedError = get('isAuthError', err)
        ? {
            err,
            detail: 'Error Getting Auth Token'
          }
        : {
            err: { ...err, statusCode: get('statusCode', res), body },
            detail: responseHadUnexpectedStatusCode
              ? 'Standard Query Request Status Code Unexpected'
              : 'Error Executing HTTP Request to Splunk REST API'
          };

      return done(formattedError);
    }

    try {
      const taskResult = buildQueryResultFromResponseStatus(
        entityGroup,
        options,
        res,
        body
      );
      done(null, taskResult);
    } catch (parserError) {
      // It's possible for the `buildQueryResultFromResponseStatus method to have a JSON parsing error
      // we need to try to catch that here and return an error when this happens.  We've seen this happen
      // when a proxy is between the Polarity Server and Splunk and returns an HTML error page.
      done({
        detail: 'Error JSON parsing search result',
        body,
        error: parseErrorToReadableJSON(parserError)
      });
    }
  };

/**
 * If the SPL string has no search prefix then add the `search` command prefix, otherwise don't modify the search
 * Valid prefixes are specified in the `VALID_SPL_COMMANDS` set:
 *
 * ```
 * tstats
 * metasearch
 * search
 * inputlookup
 * ```
 *
 * @param entityGroup
 * @param options
 * @param Logger
 * @returns {*}
 */
const buildSearchString = (entityGroup, options, Logger) => {
  const searchString = flow(get('searchString'), trim)(options);

  const queryStartsWithValidSplCommand = VALID_SPL_COMMAND_REGEXES.some((splCommand) => {
    if (splCommand.test(searchString)) {
      return true;
    }
  });

  const fullMultiEntitySearchString = entityGroup.reduce((accum, entity, index) => {
    if (index === 0) {
      if (queryStartsWithValidSplCommand) {
        return `${replace(
          /{{ENTITY}}/gi,
          flow(first, escapeQuotes)(entityGroup),
          searchString
        )}`;
      } else {
        return `search ${replace(
          /{{ENTITY}}/gi,
          flow(first, escapeQuotes)(entityGroup),
          searchString
        )}`;
      }
    } else {
      if (queryStartsWithValidSplCommand) {
        return `${accum} | append [ ${replace(
          /{{ENTITY}}/gi,
          escapeQuotes(entity),
          searchString
        )}]`;
      } else {
        return `${accum} | append [ search ${replace(
          /{{ENTITY}}/gi,
          escapeQuotes(entity),
          searchString
        )}]`;
      }
    }
  }, '');

  Logger.trace({ fullMultiEntitySearchString }, 'Multi-entity search string');

  return fullMultiEntitySearchString;
};

const buildQueryResultFromResponseStatus = (entityGroup, options, res, body) => {
  const Logger = getLogger();
  const statusSuccess = get('statusCode', res) === 200;

  // Splunk returns newline delimited JSON objects.  As a result we need to
  // custom parse the data.  We replace newlines with commas and then wrap the
  // text in an array so the end result is an array of result objects.
  const formattedBody =
    statusSuccess &&
    flow(
      trim,
      replace(/\n/g, ','),
      (commaDelineatedResult) => JSON.parse(`[${commaDelineatedResult}]`),
      map(pick('result')),
      uniqWith(isEqual)
    )(body);

  Logger.trace({ formattedBody }, 'Formatted Body');

  const successResult =
    statusSuccess &&
    map((entity) => {
      const bodyResultsForThisEntity = getObjectsContainingString(
        entity.value,
        formattedBody
      );

      const searchString = flow(get('searchString'), trim)(options);
      const searchAppQueryString = flow(get('searchAppQueryString'), trim)(options);

      const searchStringWithoutPrefix = flow(toLower, startsWith('search'))(searchString)
        ? flow(replace(/search/i, ''), trim)(searchString)
        : searchString;

      const searchAppQueryStringWithoutPrefix = flow(
        toLower,
        startsWith('search')
      )(searchAppQueryString)
        ? flow(replace(/search/i, ''), trim)(searchAppQueryString)
        : searchAppQueryString;

      const searchQuery = `search ${replace(
        /{{ENTITY}}/gi,
        escapeQuotes(entity),
        searchStringWithoutPrefix
      )}`;

      const searchAppQuery = `search ${replace(
        /{{ENTITY}}/gi,
        escapeQuotes(entity),
        searchAppQueryStringWithoutPrefix
      )}`;

      return {
        entity,
        searchResponseBody: size(bodyResultsForThisEntity)
          ? bodyResultsForThisEntity
          : null,
        searchQuery,
        searchAppQuery: searchAppQueryString.length === 0 ? searchQuery : searchAppQuery,
        searchType: 'search'
      };
    }, entityGroup);

  const emptyResult =
    get('statusCode', res) === 404 && map((entity) => ({ entity }), entityGroup);

  return successResult || emptyResult || [];
};

const getObjectsContainingString = (string, objs) =>
  filter(
    flow(
      JSON.stringify,
      replace(/[^\w]/g, ''),
      toLower,
      includes(flow(replace(/[^\w]/g, ''), toLower)(string))
    ),
    objs
  );

module.exports = buildMultiEntityQueryTask;
