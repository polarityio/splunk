const fp = require('lodash/fp');
const reduce = require('lodash/fp/reduce').convert({ cap: false });
const { getLogger } = require('./logger');

const getAuthenticationOptionValidationErrors = (options) => {
  const stringOptionsErrorMessages = {
    url: 'You must provide a valid Splunk URL',
    ...(options.username.value && options.password.value
      ? {
          username: 'You must provide your Splunk Username if no API token is provided.',
          password: 'You must provide your Splunk Password if no API token is provided.'
        }
      : {
          apiToken:
            'You must provide a valid Splunk api token if both a username and password are not provided.'
        })
    // searchString:
    //   'You must provide a valid Splunk Search String. Without a Splunk Search String, no results will be returned'
  };

  // if both a username or password and a API Token is provided, show validation on all fields so
  // user knows they have to pick one or the other.
  if (
    (options.username.value.length > 0 || options.password.value.length > 0) &&
    options.apiToken.value.length > 0
  ) {
    return [
      {
        key: 'apiToken',
        message:
          'You must provide either a username and password, or an API Token, but not both.'
      },
      {
        key: 'username',
        message:
          'You must provide either a username and password, or an API Token, but not both.'
      },
      {
        key: 'password',
        message:
          'You must provide either a username and password, or an API Token, but not both.'
      }
    ];
  }

  // If a username is provided but not password, show validation on password
  if (options.username.value.length > 0 && !options.password.value.length > 0) {
    return [
      {
        key: 'password',
        message: 'You must provide a password for the given Splunk Username.'
      }
    ];
  }

  // If a password is provided but no username, show validation on username
  if (options.password.value.length > 0 && !options.username.value.length > 0) {
    return [
      {
        key: 'username',
        message: 'You must provide username for the given Splunk Password.'
      }
    ];
  }

  // If the searchType is "Custom SPL Query" then a "Splunk Search String" must be set
  if (
    options.searchType.value.value === 'spl' &&
    options.searchString.value.trim().length === 0
  ) {
    return [
      {
        key: 'searchString',
        message:
          'You must provide a valid Splunk Search String when the "Search Type" is set to "Custom SPL Query"'
      }
    ];
  }

  const stringValidationErrors = _validateStringOptions(
    stringOptionsErrorMessages,
    options
  );

  const urlValidationErrors = _validateUrlOption(options.url);

  return stringValidationErrors.concat(urlValidationErrors);
};

const _validateStringOptions = (stringOptionsErrorMessages, options, otherErrors = []) =>
  reduce((agg, message, optionName) => {
    const isString = typeof options[optionName].value === 'string';
    const isEmptyString = isString && fp.isEmpty(options[optionName].value);

    return !isString || isEmptyString
      ? agg.concat({
          key: optionName,
          message
        })
      : agg;
  }, otherErrors)(stringOptionsErrorMessages);

const _validateUrlOption = ({ value: url }, otherErrors = []) => {
  const endWithError =
    url && url.endsWith('/')
      ? otherErrors.concat({
          key: 'url',
          message: 'The Splunk URL should not end with a forward slash ("/")'
        })
      : otherErrors;
  if (endWithError.length) return endWithError;

  if (url) {
    try {
      new URL(url);
    } catch (_) {
      return otherErrors.concat({
        key: 'url',
        message:
          'What is currently provided is not a valid URL. You must provide a valid Splunk URL.'
      });
    }
  }

  return otherErrors;
};

module.exports = getAuthenticationOptionValidationErrors;
