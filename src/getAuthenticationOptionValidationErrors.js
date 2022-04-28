const fp = require('lodash/fp');
const reduce = require('lodash/fp/reduce').convert({ cap: false });

const getAuthenticationOptionValidationErrors = (options) => {
  const stringOptionsErrorMessages = {
    url: 'You must provide a valid Splunk URL',
    ...(options.isCloud.value
      ? {
          username:
            'You must provide your Splunk Cloud Username while Splunk Cloud Deployment is Checked',
          password:
            'You must provide your Splunk Cloud Password while Splunk Cloud Deployment is Checked'
        }
      : {
          apiToken:
            'You must provide a valid Splunk Authentication Token while Splunk Cloud Deployment is Unchecked'
        }),
    searchString:
      'Must provide a valid Splunk Search String. Without a Splunk Search String, no results will ever be returned'
  };

  const stringValidationErrors = _validateStringOptions(
    stringOptionsErrorMessages,
    options
  );

  const urlValidationErrors = _validateUrlOption(options.url);

  const isCloudValidationError =
    options.isCloud.value && !(options.username.value && options.password.value)
      ? {
          key: 'isCloud',
          message:
            'If Checked, you are required to enter both a Splunk Cloud Username and a Splunk Cloud Password.'
        }
      : !options.apiToken.value
      ? {
          key: 'isCloud',
          message:
            'If Not Checked, you are required to enter a Splunk Authentication Token.'
        }
      : [];

  return stringValidationErrors.concat(urlValidationErrors).concat(isCloudValidationError)
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
