const addAuthHeaders = (requestOptions, tokenCache, options, requestWithDefaults, callback) => {
  if (options.isCloud) {
    const cachedToken = tokenCache.get(`${options.username}${options.password}`);
    if (cachedToken) return callback(null, { ...requestOptions, headers: { Authorization: 'Splunk ' + cachedToken } });

    requestWithDefaults(
      {
        url: `${options.url}/services/auth/login?output_mode=json`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'text/plain'
        },
        body: encodeURIComponent(`username=${options.username}&password=${options.password}`)
      },
      (error, res, body) => {
        const sessionKey = body && body[0] === '{' && JSON.parse(body).sessionKey;
        if (error || !sessionKey)
          return callback({
            statusCode: res.statusCode,
            body,
            detail: 'Failed to get auth token for Splunk Cloud'
          });

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

module.exports = addAuthHeaders;
