const fp = require('lodash/fp');
const reduce = require('lodash/fp/reduce').convert({ cap: false });

const getAuthenticationOptionValidationErrors = (options) => {
  const stringOptionsErrorMessages = {
    url: 'You must provide a valid Splunk URL',
    ...(options.username.value && options.password.value
      ? {
          username:
            'You must provide your Splunk Cloud Username if no api token is provided.',
          password:
            'You must provide your Splunk Cloud Password if no api token is provided.'
        }
      : {
          apiToken:
            'You must provide a valid Splunk api token if no username and password are provided.'
        }),
    searchString:
      'Must provide a valid Splunk Search String. Without a Splunk Search String, no results will ever be returned'
  };

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
