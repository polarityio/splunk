const addAuthHeaders = (requestOptions, options, callback) => {
  if (options.username && options.password) {
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
