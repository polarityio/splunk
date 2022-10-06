const { flow, includes, get, getOr, keys, find } = require('lodash/fp');


const getQueryStringOptionValidationErrors = async (options, doLookup) =>
  // Checking the Search String Option for Parsing Issues on User Option Splunk Auth Credentials
  new Promise((res, rej) =>
    doLookup(
      [{ value: '8.8.8.8', type: 'IPv4' }],
      options,
      (error) =>
        res(
          getOr(
            () => [],
            get('err.statusCode', error),
            ERROR_CHECK_BY_STATUS_CODE
          )(error, options) || []
        ),
      true
    )
  );



const CHECK_ERROR_BY_ERROR_MESSAGE = {
  'read ECONNRESET': () => [
    {
      key: 'url',
      message: `ECONNRESET - Server could not be reached.`
    }
  ],
  'connect ECONNREFUSED': (error, options) => [
    {
      key: 'url',
      message: `ECONNREFUSED - Server could not be reached.`
    }
  ]
};

const ERROR_CHECK_BY_STATUS_CODE = {
  400: (error) => {
    try {
      const parsedErrorMessage = get(
        'messages.0.text',
        JSON.parse(get('err.body', error))
      );
      return (
        parsedErrorMessage && [
          {
            key: 'searchString',
            message: `Search String Failed when tried with Splunk: ${parsedErrorMessage}`
          }
        ]
      );
    } catch (_) {}
  },
  401: (error, options) => [
    {
      key: options.isCloud ? 'isCloud' : 'apiToken',
      message: `Authentication Failed when tried with Splunk.`
    }
  ],
  403: (error, options) => [
    {
      key: options.isCloud ? 'isCloud' : 'apiToken',
      message: `Authentication Failed when tried with Splunk: Insufficient Permission.`
    }
  ],
  500: () => [
    {
      key: 'isCloud',
      message: `Internal Splunk Error.  Make a change and try again`
    }
  ],
  undefined: (error, options) =>
    flow(
      keys,
      find((key) => includes(key, get('err.message', error))),
      (key) => get(key, CHECK_ERROR_BY_ERROR_MESSAGE),
      (func) =>
        func
          ? func(error, options)
          : [
              // {
              //     key: 'url', // For Logging
              //     message: JSON.stringify(error)
              //   }
            ]
    )(CHECK_ERROR_BY_ERROR_MESSAGE)
};

module.exports = getQueryStringOptionValidationErrors;
