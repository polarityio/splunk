const addAuthHeaders = (requestOptions, options) => {
  if (options.username && options.password) {
    requestOptions.auth = {
      username: options.username,
      password: options.password
    };
  } else {
    requestOptions.headers = { Authorization: 'Bearer ' + options.apiToken };
  }
  return requestOptions;
};

module.exports = addAuthHeaders;
