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
const { parseErrorToReadableJSON } = require('./errors');

const reduce = require('lodash/fp/reduce').convert({ cap: false });

const { searchKvStoreAndAddToResults } = require('./getKvStoreQueryResults');
const { buildMultiEntityMetaSearchTask } = require('./buildMultiEntityMetaSearchTask');

const EXPECTED_QUERY_STATUS_CODES = [200, 404];

const buildMultiEntityQueryTask =
  (entityGroup, options, requestWithDefaults, Logger) => (done) => {
    if (options.searchKvStore) {
      searchKvStoreAndAddToResults(
        entityGroup,
        options,
        requestWithDefaults,
        done,
        Logger
      );
    } else if (options.doMetasearch) {
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

const buildSearchString = (entityGroup, options, Logger) => {
  const searchString = flow(get('searchString'), trim)(options);
  const searchStringWithoutPrefix = flow(toLower, startsWith('search'))(searchString)
    ? flow(replace(/search/i, ''), trim)(searchString)
    : searchString;

  const fullMultiEntitySearchString = reduce(
    (agg, entity, index) =>
      index === 0
        ? `search ${replace(
            /{{ENTITY}}/gi,
            flow(first, escapeQuotes)(entityGroup),
            searchStringWithoutPrefix
          )}`
        : `${agg} | append [ search ${replace(
            /{{ENTITY}}/gi,
            escapeQuotes(entity),
            searchStringWithoutPrefix
          )}]`,
    '',
    entityGroup
  );

  Logger.trace({ fullMultiEntitySearchString }, 'Multi-entity search string');

  return fullMultiEntitySearchString;
};

/**
 * Used to escape double quotes in entities
 * @param entityValue
 * @returns {*}
 */
const escapeQuotes = flow(get('value'), replace(/(\r\n|\n|\r)/gm, ''), replace(/"/g, ''));

const buildQueryResultFromResponseStatus = (entityGroup, options, res, body) => {
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
        searchAppQuery,
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
