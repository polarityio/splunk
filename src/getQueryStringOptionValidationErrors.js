const { get, getOr } = require('lodash/fp');


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
  ]
};

module.exports = getQueryStringOptionValidationErrors;
