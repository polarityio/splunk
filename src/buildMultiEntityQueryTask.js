'use strict';

const {
  flow,
  reduce,
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
  pick
} = require('lodash/fp');

const { searchKvStoreAndAddToResults } = require('./getKvStoreQueryResults');

const EXPECTED_QUERY_STATUS_CODES = [200, 404];

const buildMultiEntityQueryTask =
  (entityGroup, options, requestWithDefaults, Logger) => (done) =>
    !options.searchKvStore
      ? requestWithDefaults(
          {
            method: 'GET',
            uri: `${options.url}/services/search/jobs/export`,
            qs: {
              search: buildSearchString(entityGroup, options, Logger),
              output_mode: 'json'
            },
            json: false
          },
          options,
          handleStandardQueryResponse(
            entityGroup,
            options,
            requestWithDefaults,
            done,
            Logger
          )
        )
      : searchKvStoreAndAddToResults(
          entityGroup,
          options,
          requestWithDefaults,
          done,
          Logger
        );;

const handleStandardQueryResponse =
  (entityGroup, options, requestWithDefaults, done, Logger) => (err, res, body) => {
    const responseHadUnexpectedStatusCode = !EXPECTED_QUERY_STATUS_CODES.includes(
      get('statusCode', res)
    );
    if (err || responseHadUnexpectedStatusCode) {
      const formattedError = get('isAuthError', err)
        ? {
            err,
            detail: 'Error Getting Auth Token'
          }
        : {
            err: { statusCode: get('statusCode', res), body },
            detail: responseHadUnexpectedStatusCode
              ? 'Standard Query Request Status Code Unexpected'
              : 'Error Executing HTTP Request to Splunk REST API'
          };

      return done(formattedError);
    }

    const taskResult = buildQueryResultFromResponseStatus(
      entityGroup,
      options,
      res,
      body
    );

    done(null, taskResult);
  };

const buildSearchString = (entityGroup, options, Logger) => {
  const searchString = flow(get('searchString'), trim)(options);
  const searchStringWithoutPrefix = flow(toLower, startsWith('search'))(searchString)
    ? flow(replace(/search/i, ''), trim)(searchString)
    : searchString;

  const fullMutliEntitySearchString = reduce(
    (agg, entity) =>
      `${agg} | append [ search ${replace(
        /{{ENTITY}}/gi,
        escapeQuotes(entity),
        searchStringWithoutPrefix
      )}]`,
    `search ${replace(
      /{{ENTITY}}/gi,
      flow(first, escapeQuotes)(entityGroup),
      searchStringWithoutPrefix
    )}`,
    entityGroup
  );

  return fullMutliEntitySearchString;
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

      const searchStringWithoutPrefix = flow(toLower, startsWith('search'))(searchString)
        ? flow(replace(/search/i, ''), trim)(searchString)
        : searchString;

      const searchQuery = `search ${replace(
        /{{ENTITY}}/gi,
        escapeQuotes(entity),
        searchStringWithoutPrefix
      )}`;

      return {
        entity,
        searchResponseBody: bodyResultsForThisEntity,
        searchQuery
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
