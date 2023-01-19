'use strict';

const {
  flow,
  startsWith,
  replace,
  get,
  toLower,
  trim,
  first,
  map,
  uniqWith,
  isEqual,
  pick,
  size
} = require('lodash/fp');
const { parseErrorToReadableJSON } = require('./errors');

const reduce = require('lodash/fp/reduce').convert({ cap: false });

const EXPECTED_QUERY_STATUS_CODES = [200, 404];

const buildMultiEntityMetaSearchTask = (
  entityGroup,
  options,
  requestWithDefaults,
  Logger,
  done
) => {
  let requestOptions = {
    method: 'GET',
    uri: `${options.url}/services/search/jobs/export`,
    qs: {
      search: buildSearchString(entityGroup, options, Logger),
      output_mode: 'json',
      adhoc_search_level: 'fast'
    },
    json: false
  };

  if (options.earliestTimeBound.length > 0) {
    requestOptions.qs.earliest_time = options.earliestTimeBound;
  }

  requestWithDefaults(
    requestOptions,
    options,
    handleStandardQueryResponse(entityGroup, options, requestWithDefaults, done, Logger)
  );
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
        body,
        Logger
      );
      done(null, taskResult);
    } catch (parserError) {
      // It's possible for the `buildQueryResultFromResponseStatus method to have a JSON parsing error
      // we need to try to catch that here and return an error when this happens.  We've seen this happen
      // when a proxy is between the Polarity Server and Splunk and returns an HTML error page.
      done({
        detail: 'Error JSON parsing meta search result',
        body,
        error: parseErrorToReadableJSON(parserError)
      });
    }
  };

const createMetaSearch = (entityValue, options) => {
  if (options.searchType.value === 'metaSearchTerm') {
    return `| metasearch index=* TERM("${entityValue}") 
     | dedup index, sourcetype    
     | stats values(sourcetype) AS sourcetype by index    
     | mvexpand sourcetype    
     | eval entity="${entityValue}", index=index, sourcetype=sourcetype, searchUrl=""
     | table index, sourcetype, entity`;
  } else {
    return `search index=* "${entityValue}" 
     | dedup index, sourcetype    
     | stats values(sourcetype) AS sourcetype by index    
     | mvexpand sourcetype    
     | eval entity="${entityValue}", index=index, sourcetype=sourcetype, searchUrl=""
     | table index, sourcetype, entity`;
  }
};

const buildSearchString = (entityGroup, options, Logger) => {
  const fullMultiEntitySearchString = reduce(
    (agg, entity, index) =>
      index === 0
        ? createMetaSearch(flow(first, escapeQuotes)(entityGroup), options)
        : `${agg} | append [ ${createMetaSearch(escapeQuotes(entity), options)}]`,
    '',
    entityGroup
  );

  Logger.trace({ fullMultiEntitySearchString }, 'Multi-entity meta search string');
  return fullMultiEntitySearchString;
};

/**
 * Used to escape double quotes in entities
 * @param entityValue
 * @returns {*}
 */
const escapeQuotes = flow(get('value'), replace(/(\r\n|\n|\r)/gm, ''), replace(/"/g, ''));

const buildQueryResultFromResponseStatus = (entityGroup, options, res, body, Logger) => {
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
        searchResponseBody: size(bodyResultsForThisEntity)
          ? bodyResultsForThisEntity
          : null,
        searchQuery,
        searchType: 'meta'
      };
    }, entityGroup);

  const emptyResult =
    get('statusCode', res) === 404 && map((entity) => ({ entity }), entityGroup);

  return successResult || emptyResult || [];
};

const getObjectsContainingString = (entityValue, objs) => {
  return objs.filter((result) => {
    if (result && result.result && result.result.entity) {
      return result.result.entity.toLowerCase() === entityValue.toLowerCase();
    }
    return false;
  });
};

module.exports = {
  buildMultiEntityMetaSearchTask
};
