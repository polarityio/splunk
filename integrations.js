'use strict';

const request = require('request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');
const NodeCache = require('node-cache');
const {
  size,
  get,
  flow,
  reduce,
  keys,
  getOr,
  chunk,
  flatten,
  map
} = require('lodash/fp');

const {
  getAuthenticationOptionValidationErrors,
  ERROR_CHECK_BY_STATUS_CODE
} = require('./src/getAuthenticationOptionValidationErrors');
const buildMultiEntityQueryTask = require('./src/buildMultiEntityQueryTask');

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

  requestWithDefaults = request.defaults(defaults);
}


function doLookup(entities, options, cb) {
  let lookupResults = [];
  const summaryFields = options.summaryFields.split(',').map((field) => field.trim());
  Logger.debug({ entities }, 'Entities');

  let tasks = flow(
    chunk(10),
    map((entityGroup) =>
      buildMultiEntityQueryTask(entityGroup, tokenCache, options, requestWithDefaults)
    )
  )(entities);

  async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
    if (err) {
      Logger.error({ err: err }, 'Error');
      cb(err);
      return;
    }

    flatten(results).forEach((result) => {
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
      const body = get('body', result);
      const thereAreNoResults = !body || (size(body) > 0 && !get('0.result', body));

      lookupResults.push({
        entity: result.entity,
        data: thereAreNoResults
          ? null
          : {
              summary: [],
              details: {
                results: result.body,
                search: result.search,
                tags: _getSummaryTags(result.body, summaryFields)
              }
            }
      });
    });

    Logger.debug({ lookupResults }, 'Results');
    cb(null, lookupResults);
  });
}

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
  const authOptionErrors = getAuthenticationOptionValidationErrors(options);
  if (size(authOptionErrors)) return callback(null, authOptionErrors);

  const formattedOptions = reduce(
    (agg, key) => ({ ...agg, [key]: get([key, 'value'], options) }),
    {},
    keys(options)
  );

  // Checking the Search String Option for Parsing Issues on User Option Splunk Credentials
  doLookup(
    [{ value: '8.8.8.8', type: 'IPv4' }],
    formattedOptions,
    (error, lookupResults) =>
      callback(
        null,
        getOr(
          () => [],
          get('err.statusCode', error),
          ERROR_CHECK_BY_STATUS_CODE
        )(error, options) || []
      )
  );
};

module.exports = {
  doLookup,
  startup,
  validateOptions
};
