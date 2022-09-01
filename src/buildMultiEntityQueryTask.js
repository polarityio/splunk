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

const reduce = require('lodash/fp/reduce').convert({ cap: false });

const { searchKvStoreAndAddToResults } = require('./getKvStoreQueryResults');

const EXPECTED_QUERY_STATUS_CODES = [200, 404];
// We might get a 400 status code back if the user put in an invalid query
// In this case we want to display a message to the user in the overlay window
const EXPECTED_DIRECT_SEARCH_STATUS_CODES = [200, 404, 400];

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
    } else {
      const directSearchEntity = containsDirectSearch(entityGroup);
      const requestOptions = {
        method: 'GET',
        uri: `${options.url}/services/search/jobs/export`,
        qs: {
          search: directSearchEntity
            ? buildDirectSearchString(directSearchEntity, options, Logger)
            : buildSearchString(entityGroup, options, Logger),
          output_mode: 'json'
        },
        json: false
      };

      if (directSearchEntity) {
        requestOptions.qs.earliest_time = options.directSearchMaxTimeframe;
        Logger.trace({ requestOptions }, 'Running Direct Search');
        requestWithDefaults(
          requestOptions,
          options,
          handleDirectQueryResponse(
            directSearchEntity, // direct queries only ever search a single query (entity) at a time
            options,
            requestWithDefaults,
            done,
            Logger
          )
        );
      } else {
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
    }
  };

function handleQueryError(error, res, body, expectedStatusCodes, Logger, done) {
  const responseHadUnexpectedStatusCode = !expectedStatusCodes.includes(
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

    Logger.error(formattedError);
    done(formattedError);
    return true;
  }
  return false;
}

/**
 *
 * @param res
 * @param body
 * @param Logger
 * @returns Returns an array of error messages or an empty array if there are no errors
 */
function getDirectSearchSyntaxError(res, body, Logger) {
  if (res.statusCode === 400) {
    try {
      const bodyObj = JSON.parse(body);
      return bodyObj.messages.map((message) => message.text);
    } catch (parseError) {
      Logger.error({ body }, 'Unexpected non-JSON content in body');
      return [body];
    }
  }
  return [];
}

const handleDirectQueryResponse =
  (entity, options, requestWithDefaults, done, Logger) => (error, res, body) => {
    const hadError = handleQueryError(
      error,
      res,
      body,
      EXPECTED_DIRECT_SEARCH_STATUS_CODES,
      Logger,
      done
    );

    if (!hadError) {
      Logger.trace(
        {
          body,
          statusCode: res ? res.statusCode : 'N/A'
        },
        'Building query result from direct search response'
      );

      // Check to see if there was a query syntax issue
      const searchSyntaxErrors = getDirectSearchSyntaxError(res, body, Logger);
      if (searchSyntaxErrors.length > 0) {
        done(null, [
          {
            entity,
            searchResponseBody: [],
            searchQuery: removeSearchKeywordPrefix(entity.value),
            searchSyntaxErrors
          }
        ]);
      } else {
        const taskResult = buildQueryResultFromDirectQueryResponseStatus(
          entity,
          options,
          res,
          body,
          Logger
        );

        done(null, taskResult);
      }
    }
  };

const handleStandardQueryResponse =
  (entityGroup, options, requestWithDefaults, done, Logger) => (error, res, body) => {
    const hadError = handleQueryError(
      error,
      res,
      body,
      EXPECTED_QUERY_STATUS_CODES,
      Logger,
      done
    );

    if (!hadError) {
      Logger.trace(
        {
          body,
          statusCode: res ? res.statusCode : 'N/A'
        },
        'Building query result from standard search response'
      );
      const taskResult = buildQueryResultFromResponseStatus(
        entityGroup,
        options,
        res,
        body,
        Logger
      );

      done(null, taskResult);
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

  return fullMultiEntitySearchString;
};

/**
 * If it exists, this method will return the direct search custom entity.  In this
 * case we don't run searches on any other entities as they are likely contained within
 * the search itself.
 *
 * @param entityGroup
 * @returns {{requestContext}|*}
 */
const containsDirectSearch = (entityGroup) => {
  const entity = entityGroup.find((entity) =>
    Array.isArray(entity.types)
      ? entity.types.indexOf('custom.splunkSearch') >= 0
      : undefined
  );
  if (entity && entity.requestContext && entity.requestContext.isUserInitiated) {
    return entity;
  }
};

const buildDirectSearchString = (entity, options, Logger) => {
  return `${entity.value} | head ${options.directSearchMaxResults}`;
};

/**
 * Used to escape double quotes in entities
 * @param entityValue
 * @returns {*}
 */
const escapeQuotes = flow(get('value'), replace(/(\r\n|\n|\r)/gm, ''), replace(/"/g, ''));

function formatSplunkResponseBody(body) {
  const formattedBody = flow(
    trim,
    replace(/\n/g, ','),
    (commaDelineatedResult) => JSON.parse(`[${commaDelineatedResult}]`),
    map(pick('result')),
    uniqWith(isEqual)
  )(body);

  // TODO: Clean up the above formatted body logic.  Right now if we have no results the return payload
  // is this:
  // ```
  // {"preview":false,"lastrow":true}
  // ```
  // This results in the formattedBody being an array with an empty object (i.e., [ { } ] )
  // We don't want to return an array with an object in it but instead want to return just an empty array
  if (formattedBody.length === 1 && Object.keys(formattedBody[0]).length === 0) {
    return [];
  } else {
    return formattedBody;
  }
}

function removeSearchKeywordPrefix(searchString) {
  return flow(toLower, startsWith('search'))(searchString)
    ? flow(replace(/search/i, ''), trim)(searchString)
    : searchString;
}

function buildQueryResultFromDirectQueryResponseStatus(
  entity,
  options,
  res,
  body,
  Logger
) {
  const statusSuccess = get('statusCode', res) === 200;
  // Splunk returns newline delimited JSON objects.  As a result we need to
  // custom parse the data.  We replace newlines with commas and then wrap the
  // text in an array so the end result is an array of result objects.
  const formattedBody = statusSuccess && formatSplunkResponseBody(body);

  const result = [
    {
      entity,
      searchResponseBody: size(formattedBody) ? formattedBody : [],
      searchQuery: removeSearchKeywordPrefix(entity.value)
    }
  ];

  Logger.trace({ formattedBody, result }, 'Formatted direct query response');

  return result;
}

const buildQueryResultFromResponseStatus = (entityGroup, options, res, body, Logger) => {
  const statusSuccess = get('statusCode', res) === 200;

  // Splunk returns newline delimited JSON objects.  As a result we need to
  // custom parse the data.  We replace newlines with commas and then wrap the
  // text in an array so the end result is an array of result objects.
  const formattedBody = statusSuccess && formatSplunkResponseBody(body);

  const successResult =
    statusSuccess &&
    map((entity) => {
      // TODO: For search string lookups we don't need to do this because whatever comes back
      // is a match for a single search string.
      const bodyResultsForThisEntity = getObjectsContainingString(
        entity.value,
        formattedBody
      );

      Logger.trace({ bodyResultsForThisEntity, formattedBody }, 'FormattedBody');

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
          : [],
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
