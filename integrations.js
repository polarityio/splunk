'use strict';

const request = require('postman-request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');
const NodeCache = require('node-cache');
const { size, get, flow, reduce, keys, chunk, flatten, map } = require('lodash/fp');

const getAuthenticationOptionValidationErrors = require('./src/getAuthenticationOptionValidationErrors');
const getQueryStringOptionValidationErrors = require('./src/getQueryStringOptionValidationErrors');
const getKvStoreOptionValidationErrors = require('./src/getKvStoreOptionValidationErrors');
const buildMultiEntityQueryTask = require('./src/buildMultiEntityQueryTask');
const addAuthHeaders = require('./src/addAuthHeaders');

const tokenCache = new NodeCache({
  stdTTL: 5 * 60
});

let Logger;
let requestWithDefaults;

const MAX_PARALLEL_LOOKUPS = 10;

/**
 *
 * @param entities
 * @param options
 * @param cb
 */
function startup(logger) {
  let defaults = {};
  Logger = logger;

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    defaults.cert = fs.readFileSync(config.request.cert);
  }

  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    defaults.key = fs.readFileSync(config.request.key);
  }

  if (
    typeof config.request.passphrase === 'string' &&
    config.request.passphrase.length > 0
  ) {
    defaults.passphrase = config.request.passphrase;
  }

  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    defaults.ca = fs.readFileSync(config.request.ca);
  }

  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    defaults.proxy = config.request.proxy;
  }

  if (typeof config.request.rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = config.request.rejectUnauthorized;
  }

  const startingRequestWithDefaults = request.defaults(defaults);

  requestWithDefaults = (requestOptions, options, callback) =>
    addAuthHeaders(
      requestOptions,
      options,
      (err, requestOptionsWithAuth) => {
        if (err) return callback({
          ...JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))),
          isAuthError: true
        });

        startingRequestWithDefaults(requestOptionsWithAuth, callback);
      }
    );
}

const doLookup = (entities, options, cb) => {
  const summaryFields = options.summaryFields.split(',').map((field) => field.trim());
  Logger.debug({ entities }, 'Entities');

  let tasks = flow(
    chunk(10),
    map((entityGroup) =>
      buildMultiEntityQueryTask(entityGroup, options, requestWithDefaults, Logger)
    )
  )(entities);

  async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
    if (err) {
      Logger.error({ err: err }, 'Error');
      cb(err);
      return;
    }

    const lookupResults = flow(
      flatten,
      map((result) => {
        /**
         * A search result body with no results is of the form:
         *     body: [
         *       {
         *         "preview": false,
         *         "lastrow": true
         *       }
         *     ]
         * Search results with data will always have a `result` property.  We check for the result
         * to determine if the search had a hit or not.
         *    body: [
         *       {
         *         "preview": false,
         *         "lastrow": true,
         *         "result": {}
         *       }
         *     ]
         **/
        const searchResponseBody = get('searchResponseBody', result);
        const thereAreNoResults =
          !searchResponseBody ||
          (size(searchResponseBody) > 0 && !get('0.result', searchResponseBody));

        return {
          entity: result.entity,
          data: thereAreNoResults
            ? null
            : {
                summary: [],
                details: {
                  results: searchResponseBody,
                  search: result.searchQuery,
                  searchType: result.searchType,
                  tags: _getSummaryTags(result.searchResponseBody, summaryFields)
                }
              }
        };
      })
    )(results);

    Logger.debug({ lookupResults }, 'Results');
    cb(null, lookupResults);
  });
};

function _getSummaryTags(results, summaryFields) {
  const tags = new Map();

  results.forEach((item) => {
    summaryFields.forEach((field) => {
      const summaryField = item.result[field];
      if (summaryField) {
        tags.set(`${field}${summaryField}`, {
          field: field,
          value: summaryField
        });
      }
    });
  });

  return Array.from(tags.values());
}

const validateOptions = async (options, callback) => {
  if(options.doMetasearch.value === true && options.searchKvStore.value === true){
    return callback(null, [
      {
        key: 'searchKvStore',
        message: 'Cannot enable the "Search KV Store" if the "Run index discovery metasearch" option is also enabled.'
      },
      {
        key: 'doMetasearch',
        message: 'Cannot enable the "Run index discovery metasearch" if the "Search KV Store" option is also enabled.'
      }
    ])
  }

  const authOptionErrors = getAuthenticationOptionValidationErrors(options);
  if (size(authOptionErrors)) return callback(null, authOptionErrors);

  const formattedOptions = reduce(
    (agg, key) => ({ ...agg, [key]: get([key, 'value'], options) }),
    {},
    keys(options)
  );

  const queryStringOptionErrors = await getQueryStringOptionValidationErrors(
    formattedOptions,
    doLookup
  );
  if (size(queryStringOptionErrors)) return callback(null, queryStringOptionErrors);

  const kvStoreOptionErrorsAndInfoMessages = await getKvStoreOptionValidationErrors(
    formattedOptions,
    requestWithDefaults,
    Logger
  );

  callback(null, kvStoreOptionErrorsAndInfoMessages || []);
};

module.exports = {
  doLookup,
  startup,
  validateOptions
};
