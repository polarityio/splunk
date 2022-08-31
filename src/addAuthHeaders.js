const addAuthHeaders = (
  requestOptions,
  options,
  callback
) => {
  if (options.isCloud) {
    requestOptions.auth = {
      username: options.username,
      password: options.password
    };
  } else {
    requestOptions.headers = { Authorization: 'Bearer ' + options.apiToken };
  }
  callback(null, requestOptions);
};

module.exports = addAuthHeaders;
