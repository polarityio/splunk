'use strict';

const request = require('request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');
const NodeCache = require('node-cache');
const getAuthenticationOptionValidationErrors = require('./src/getAuthenticationOptionValidationErrors');
const addAuthHeaders = require('./src/addAuthHeaders');
const {
  size,
  get,
  flow,
  reduce,
  startsWith,
  replace,
  keys,
  trim,
  toLower
} = require('lodash/fp');

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

function doLookup(entities, options, cb) {
  let lookupResults = [];
  let tasks = [];
  const summaryFields = options.summaryFields.split(',').map((field) => field.trim());
  Logger.debug({ entities }, 'Entities');

  entities.forEach((entity) => {
    //do the lookup
    let requestOptions = {
      method: 'GET',
      uri: `${options.url}/services/search/jobs/export`,
      qs: {
        output_mode: 'json',
        search: flow(
          get('searchString'),
          (searchString) =>
            flow(trim, toLower, startsWith('search'))(searchString)
              ? searchString
              : `search ${searchString}`,
          replace(/{{ENTITY}}/gi, escapeQuotes(entity))
        )(options)
      },
      json: false
    };

    tasks.push(function (done) {
      addAuthHeaders(
        requestOptions,
        tokenCache,
        options,
        requestWithDefaults,
        (error, requestOptionsWithAuth) => {
          if (error) {
            return done({
              error,
              detail: 'Error Getting Auth Token'
            });
          }

          requestWithDefaults(requestOptionsWithAuth, function (error, res, body) {
            if (error) {
              return done({
                error,
                detail: 'Error Executing HTTP Request to Splunk REST API'
              });
            }

            let result = {};

            if (res.statusCode === 200) {
              result = {
                entity: entity,
                body: body,
                search: requestOptionsWithAuth.qs.search
              };
            } else if (res.statusCode === 404) {
              // no result found
              result = {
                entity: entity,
                body: null
              };
            } else {
              // unexpected status code
              return done({
                err: { statusCode: res.statusCode, body },
                detail: _formatErrorMessages(body)
              });
            }

            done(null, result);
          });
        }
      );
    });
  });

  async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
    if (err) {
      Logger.error({ err: err }, 'Error');
      cb(err);
      return;
    }

    results.forEach((result) => {
      Logger.trace({ body: result.body });
      if (!result.body) {
        lookupResults.push({
          entity: result.entity,
          data: null
        });
      } else {
        try {
          // Splunk returns newline delimited JSON objects.  As a result we need to
          // custom parse the data.  We replace newlines with commas and then wrap the
          // text in an array so the end result is an array of result objects.
          result.body = JSON.parse(`[${result.body.trim().replace(/\n/g, ',')}]`);
          // A search result with no results is of the form:
          //     body: [
          //       {
          //         "preview": false,
          //         "lastrow": true
          //       }
          //     ]
          // Search results with data will always have a `result` property.  We check for the result
          // to determine if the search had a hit or not.
          //    body: [
          //       {
          //         "preview": false,
          //         "lastrow": true,
          //         "result": {}
          //       }
          //     ]
          if (result.body.length > 0 && !result.body[0].result) {
            lookupResults.push({
              entity: result.entity,
              data: null
            });
          } else {
            lookupResults.push({
              entity: result.entity,
              data: {
                summary: [],
                details: {
                  results: result.body,
                  search: result.search,
                  tags: _getSummaryTags(result.body, summaryFields)
                }
              }
            });
          }
        } catch (parseError) {
          Logger.error(
            { body: result.body },
            'Error parsing query result body into JSON'
          );
        }
      }
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

function _formatErrorMessages(err) {
  let formattedMessage = '';
  if (Array.isArray(err.messages)) {
    err.messages.forEach((message) => {
      formattedMessage += message.text;
    });
  } else if (typeof err === 'string') {
    formattedMessage = err;
  }

  return formattedMessage;
}

const validateOptions = async (options, callback) => {
  const authOptionErrors = getAuthenticationOptionValidationErrors(options);
  if(size(authOptionErrors)) return callback(null, authOptionErrors);
  
  const formattedOptions = reduce(
    (agg, key) => ({ ...agg, [key]: get([key, 'value'], options) }),
    {},
    keys(options)
  );

  // Checking the Search String Option for Parsing Issues on User Option Splunk Credentials
  // If we get a 400 and we have a query Parsing Error show error on Search String Option
  doLookup(
    [{ value: '8.8.8.8', type: 'IPv4' }],
    formattedOptions,
    (error, lookupResults) => {
      if (get('err.statusCode', error) === 400) {
        try {
          const parsedErrorMessage = get(
            'messages.0.text',
            JSON.parse(get('err.body', error))
          );
          if (parsedErrorMessage)
            return callback(null, [
              {
                key: 'searchString',
                message: `Search String Failed: ${parsedErrorMessage}`
              }
            ]);
        } catch (_) {}
      }
      callback(null, []);
    }
  );
};

module.exports = {
  doLookup,
  startup,
  validateOptions
};
