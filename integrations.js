'use strict';

const request = require('request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');

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

  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
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
  let tasks = [];
  const summaryFields = options.summaryFields.split(',');
  Logger.debug({ entities }, 'Entities');

  entities.forEach((entity) => {
    //do the lookup
    let requestOptions = {
      method: 'GET',
      uri: `${options.url}/services/search/jobs/export`,
      headers: {
        Authorization: 'Bearer ' + options.apiToken
      },
      qs: {
        output_mode: 'json',
        search: options.searchString.replace(/{{ENTITY}}/gi, entity.value)
      },
      json: false
    };

    Logger.trace({ requestOptions }, 'Request URI');

    tasks.push(function(done) {
      requestWithDefaults(requestOptions, function(error, res, body) {
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
            search: requestOptions.qs.search
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
            err: body,
            detail: _formatErrorMessages(body)
          });
        }

        done(null, result);
      });
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
          Logger.error({ body: result.body }, 'Error parsing query result body into JSON');
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

function validateOptions(userOptions, cb) {
  let errors = [];
  if (
    typeof userOptions.url.value !== 'string' ||
    (typeof userOptions.url.value === 'string' && userOptions.url.value.length === 0)
  ) {
    errors.push({
      key: 'url',
      message: 'You must provide a valid Splunk URL'
    });
  }

  if (typeof userOptions.url.value === 'string' && userOptions.url.value.endsWith('/')) {
    errors.push({
      key: 'url',
      message: 'The Splunk URL should not end with a forward slash ("/")'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  validateOptions: validateOptions
};
