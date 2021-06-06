'use strict';

const request = require('request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');
const NodeCache = require('node-cache');

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

/**
 * Used to escape double quotes in entities
 * @param entityValue
 * @returns {*}
 */
function escapeEntityValue(entityValue) {
  return entityValue.replace(/"/g, '"');
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
      qs: {
        output_mode: 'json',
        search: options.searchString.replace(/{{ENTITY}}/gi, escapeEntityValue(entity.value))
      },
      json: false
    };

    tasks.push(function (done) {
      addAuthHeaders(requestOptions, options, (error, requestOptionsWithAuth) => {
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
              err: body,
              detail: _formatErrorMessages(body)
            });
          }

          done(null, result);
        });
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

const addAuthHeaders = (requestOptions, options, callback) => {
  if (options.isCloud) {
    const cachedToken = tokenCache.get(`${options.username}${options.password}`);
    if (cachedToken)
      return callback(null, { ...requestOptions, headers: { Authorization: 'Splunk ' + cachedToken } });

    requestWithDefaults(
      {
        url: `${options.url}/services/auth/login?output_mode=json`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'text/plain'
        },
        body: `username=${options.username}&password=${options.password}`
      },
      (error, res, body) => {
        const sessionKey = body && body[0] === '{' && JSON.parse(body).sessionKey;
        if (error || !sessionKey) return callback({ error, body, detail: 'Failed to get auth token for Splunk Cloud' });

        tokenCache.set(`${options.username}${options.password}`, sessionKey);
        requestOptions.headers = { Authorization: 'Splunk ' + sessionKey };
        callback(null, requestOptions);
      }
    );
  } else {
    requestOptions.headers = { Authorization: 'Bearer ' + options.apiToken };
    callback(null, requestOptions);
  }
};

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
  if (typeof userOptions.isCloud.value === 'boolean' && userOptions.isCloud.value) {
    if (!userOptions.username.value || !userOptions.password.value) {
      errors.push({
        key: 'isCloud',
        message: 'If Checked, you are also required to enter both a Splunk Cloud Username and a Splunk Cloud Password.'
      });
      if (!userOptions.username.value) {
        errors.push({
          key: 'username',
          message: 'You must provide your Splunk Cloud Username'
        });
      }
      if (!userOptions.password.value) {
        errors.push({
          key: 'password',
          message: 'You must provide your Splunk Cloud Password'
        });
      }
    }
  } else if (!typeof userOptions.apiToken.value === 'string' || !userOptions.apiToken.value){
    errors.push({
      key: 'isCloud',
      message: 'If Not Checked, you are also required to enter a Splunk Authentication Token.'
    });
    errors.push({
      key: 'apiToken',
      message: 'You must provide a valid Splunk Authentication Token'
    });
  }

  if (typeof userOptions.summaryFields.value === 'string' && /\s/.test(userOptions.summaryFields.value)) {
    errors.push({
      key: 'summaryFields',
      message: 'Summary Fields should not include spaces.'
    });
  }

  if (
    typeof userOptions.searchString.value === 'string' &&
    !userOptions.searchString.value
      .trim()
      .toLowerCase()
      .startsWith('search')
  ) {
    errors.push({
      key: 'searchString',
      message: 'Splunk Search String must start with the string `search`'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup: doLookup,
  startup: startup,
  validateOptions: validateOptions
};
