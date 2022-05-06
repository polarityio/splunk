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
  map
} = require('lodash/fp');

const addAuthHeaders = require('./addAuthHeaders');

const EXPECTED_QUERY_STATUS_CODES = [200, 404];

const buildMultiEntityQueryTask =
  (entityGroup, tokenCache, options, requestWithDefaults) => (done) => {
    const requestOptions = {
      method: 'GET',
      uri: `${options.url}/services/search/jobs/export`,
      qs: {
        search: buildSearchString(entityGroup, options),
        output_mode: 'json'
      },
      json: false
    };

    addAuthHeaders(
      requestOptions,
      tokenCache,
      options,
      requestWithDefaults,
      executeQuery(entityGroup, requestWithDefaults, done)
    );
  };

const executeQuery =
  (entityGroup, requestWithDefaults, done) => (err, requestOptionsWithAuth) => {
    if (err) {
      return done({
        err,
        detail: 'Error Getting Auth Token'
      });
    }

    requestWithDefaults(requestOptionsWithAuth, function (error, res, body) {
      if (error) {
        return done({
          err: { statusCode: res.statusCode, body },
          detail: 'Error Executing HTTP Request to Splunk REST API'
        });
      }

      const taskError = EXPECTED_QUERY_STATUS_CODES.includes(res.statusCode)
        ? null
        : {
            err: { statusCode: res.statusCode, body },
            detail: 'Query Request Status Code Unexpected'
          };

      // extract out to package
      const taskResult = buildQueryResultFromResponseStatus(
        entityGroup,
        requestOptionsWithAuth,
        res,
        body
      );

      return done(taskError, taskResult);
    });
  };

const buildSearchString = (entityGroup, options) => {
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
const escapeQuotes = flow(
  get('value'),
  replace(/(\r\n|\n|\r)/gm, ''),
  replace(/"/g, '"')
);


const buildQueryResultFromResponseStatus = (
  entityGroup,
  requestOptionsWithAuth,
  res,
  body
) =>
  res.statusCode === 200
    ? map((entity) => {
        // Splunk returns newline delimited JSON objects.  As a result we need to
        // custom parse the data.  We replace newlines with commas and then wrap the
        // text in an array so the end result is an array of result objects.
        const formattedBody = JSON.parse(`[${flow(trim, replace(/\n/g, ','))(body)}]`);

        const bodyResultsForThisEntity = getObjectsContainingString(
          entity.value,
          formattedBody
        );

        return {
          entity,
          body: bodyResultsForThisEntity,
          search: requestOptionsWithAuth.qs.search
        };
      }, entityGroup)
    : res.statusCode === 404
    ? map((entity) => ({ entity, body: null }), entityGroup)
    : [];

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
