'use strict';

var request = require('request');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var splunkjs = require('splunk-sdk');
var parse = require('csv-parse');
var log = null;

//variables to assign an icon to a tag
var num = "Number of Results: ";
/*
 Main function of the integration that takes passes in an entity to another function to call the API.
 Then it takes the returned data and passes that to the notification window for the user
 */
function doLookup(entities, options, cb) {
    let lookupResults = [];
    // asynchrous call that passes each entity that is an IPv4 or IPv6 to the lookupEntity Function to call the Splunk rest API

    async.each(entities, function (entityObj, next) {
        if (entityObj.isIPv4 || entityObj.isIPv6) {
            _lookupEntityIP(entityObj, options, function (err, resultObject) {
                // variable that is assigned the url query for Splunk so a user can link directly to that query in Splunk
                let splunkUrl = options.uiHostname + '/en-US/app/search/search?q=' + options.searchStringIP.replace("{{ENTITY}}", entityObj.value);
                if (err) {
                    next(err);
                } else {
                    if (!resultObject || typeof(resultObject) != "object") {
                        log.trace({entity: entityObj.value}, 'No IP Data Found. Caching Miss');

                        lookupResults.push({entity: entityObj, done: null});
                    } else {
                        log.debug({entity: entityObj.value, result: resultObject}, 'Found IP Result');

                        lookupResults.push({
                            entity: entityObj,
                            data: {
                                summary: [num + resultObject],
                                details: {
                                    url: splunkUrl,
                                    num: resultObject
                                }
                            }
                        });
                    }
                    next(null);
                }
            });
        } else if (entityObj.isHash) {
            _lookupEntityHash(entityObj, options, function (err, resultObject) {
                let splunkUrl = options.uiHostname + '/en-US/app/search/search?q=' + options.searchStringHash.replace("{{ENTITY}}", entityObj.value);

                if (err) {
                    next(err);
                } else {
                    if (!resultObject || typeof(resultObject) != "object") {
                        log.trace({entity: entityObj.value}, 'No Hash Data Found. Caching Miss');

                        lookupResults.push({entity: entityObj, data: null});
                    } else {
                        log.debug({entity: entityObj.value, result: resultObject}, 'Found Hash Result');

                        lookupResults.push({
                            entity: entityObj,
                            data: {
                                summary: [num + resultObject],
                                details: {
                                    url: splunkUrl,
                                    num: resultObject
                                }
                            }
                        });
                    }
                    next(null);
                }
            });
        } else if (entityObj.isEmail) {
            _lookupEntityEmail(entityObj, options, function (err, resultObject) {
                let splunkUrl = options.uiHostname + '/en-US/app/search/search?q=' + options.searchStringHash.replace("{{ENTITY}}", entityObj.value);

                if (err) {
                    next(err);
                } else {
                    if (!resultObject || typeof(resultObject) != "object") {
                        log.trace({entity: entityObj.value}, 'No Email Data Found. Caching Miss');

                        lookupResults.push({entity: entityObj, data: null});
                    } else {
                        log.debug({entity: entityObj.value, result: resultObject}, 'Found Email Result');

                        lookupResults.push({
                            entity: entityObj,
                            data: {
                                summary: [num + resultObject],
                                details: {
                                    url: splunkUrl,
                                    num: resultObject
                                }
                            }
                        });
                    }
                    next(null);
                }
            });
        } else {
            lookupResults.push({entity: entityObj, data: null}); //Cache the miss for non ipv4, hash and ipv6 values
            next(null);
        }

    }, function (err) {
        cb(err, lookupResults);
    });
}

//function that checks the parameters of the options a user provides to connect to an integration and lets them know if the options are valid
function validateOptions(userOptions, cb) {
    let errors = [];

    if (typeof userOptions.host.value !== 'string' ||
        (typeof userOptions.host.value === 'string' && userOptions.host.value.length === 0)) {
        errors.push({
            key: 'host',
            message: 'You must provide a valid Splunk host'
        })
    }

    if (typeof userOptions.password.value !== 'string' ||
        (typeof userOptions.password.value === 'string' && userOptions.password.value.length === 0)) {
        errors.push({
            key: 'password',
            message: 'You must provide a valid password'
        })
    }

    if (typeof userOptions.username.value !== 'string' ||
        (typeof userOptions.username.value === 'string' && userOptions.username.value.length === 0)) {
        errors.push({
            key: 'username',
            message: 'You must provide a valid username'
        })
    }

    if (typeof userOptions.port.value !== 'string' ||
        (typeof userOptions.port.value === 'string' && userOptions.port.value.length === 0)) {
        errors.push({
            key: 'port',
            message: 'You must provide the Port used by your installation of Splunk'
        })
    }

    cb(null, errors);
}


// function that takes the error object and makes a payload out of it to be passed to the front end
var _createJsonErrorPayload = function (msg, pointer, httpCode, code, title, meta) {
    return {
        errors: [
            _createJsonErrorObject(msg, pointer, httpCode, code, title, meta)
        ]
    }
};


// function that creates a json error object to allow an error to be passed to the notification window
var _createJsonErrorObject = function (msg, pointer, httpCode, code, title, meta) {
    let error = {
        detail: msg,
        status: httpCode.toString(),
        title: title,
        code: 'Splunk_' + code.toString()
    };

    if (pointer) {
        error.source = {
            pointer: pointer
        };
    }

    if (meta) {
        error.meta = meta;
    }

    return error;
};


/*
 Function that takes in the entity.value that is being passed server. Then passes the option values in as a wuery to the Splunk server and returns those results.
 Once the results are returned it parses them in more of a usable format. Then passes that data back to the DoLookup function.
 */
var _lookupEntityIP = function (entity, options, done) {

    // variable to establish parameters for the connection
    var service = new splunkjs.Service({
        username: options.username,
        password: options.password,
        scheme: options.scheme,
        host: options.host,
        port: options.port,
        version: options.version
    });

    //variable that takes serach string to be executed in Splunk replaces the entity with the entity value
    var searchQuery = options.searchStringIP.replace("{{ENTITY}}", entity.value);

    log.debug({query: searchQuery}, "Running Search Query");

    //sets the serach parameters for splunk
    var searchParams = {
        //exec_mode: "oneshot",
        exec_mode: "normal",
        search_mode: "normal",
        auto_cancel: options.autoCancel
        //earliest_time: "2016-06-20T16:27:43.000-07:00",
        //max_count: "150",
        //auto_cancel: "1000"
    };

    //executes the search by passing in the parameters and the query
    service.search(
        searchQuery,
        searchParams,
        function (err, job) {
            //Checks to see if there is an error in connecting to the server and passes it to the notification window.
            if (err) {
                done(_createJsonErrorPayload("Unable to connect to Splunk server", null, '500', '2A', 'Login Failed', {
                    err: err
                }));
                return;
            }

            // polls to ensure the query is executing
            job.track({period: 1000}, {
                done: function (job) {
                    job.results({}, function (err, results, job) {
                        //if there is an error retrieving results notifies the user in the notification window
                        if (err) {
                            done(_createJsonErrorPayload("Error returning the results from Splunk Server", null,
                                '500', '2B', 'Results failed to return properly', {
                                    err: err
                                }));
                            return;
                        }

                        //variables that are associate with the field and rows in splunk
                        var fields = results.fields;
                        var rows = results.rows;

                        // checks to see if there are hits and if not returns
                        if (rows.length < 1) {
                            done(null, null);
                            return;
                        }

                        log.trace({rows: rows}, 'Raw IP Splunk Result Rows');

                        //variable to take the field and row and map it together in a list
                        var resultObjects = _.map(rows, function (row) {
                            return _.zipObject(fields, row);
                        });

                        // grabs the _raw fields from the list
                        var raws = _.map(resultObjects, '_raw');

                        var numResults = _.size(raws);

                        done(null, numResults);
                    });
                },
                failed: function (job) {
                    log.error({job: job}, 'Splunk IP Query Job Failed');
                    done(_createJsonErrorPayload("Splunk IP Job Failed", null,
                        '500', '2D', 'Splunk Job Failure', {
                            job: job
                        }), null);
                },
                error: function (err) {
                    log.error({err: err, job: job}, 'Splunk IP Query Job had an Error');
                    done(_createJsonErrorPayload("Splunk IP Job Error", null,
                        '500', '2E', 'Splunk Job Error', {
                            err: err,
                            job: job
                        }), null);
                }
            });
        }
    );
};

// function that takes in csv data and parses it
function csvImporter(records, done) {
    async.map(records, function (record, mapdone) {
        parse(record, function (err, parsedrow) {
            if(err){
                mapdone({
                    err: err,
                    record: record
                });
            }else if(!Array.isArray(parsedrow)){
                mapdone({
                    err: 'csvImporter: parsedrow is not an array',
                    record: record
                });
            }else if(parsedrow.length === 0) {
                mapdone({
                    err: 'csvImporter: parsedrow has length 0',
                    record: record
                });
            }else{
                mapdone(null, parsedrow[0]);
            }
        });
    }, done);
}

/*
 Function that looks for Hash data within Splunk
 */
var _lookupEntityHash = function (entity, options, done) {

    // variable to establish parameters for the connection
    var service = new splunkjs.Service({
        username: options.username,
        password: options.password,
        scheme: options.scheme,
        host: options.host,
        port: options.port,
        version: options.version
    });

    //variable that takes serach string to be executed in Splunk replaces the entity with the entity value
    var searchQuery = options.searchStringIP.replace("{{ENTITY}}", entity.value);

    log.debug({query: searchQuery}, "Running Search Query");

    //sets the serach parameters for splunk
    var searchParams = {
        //exec_mode: "oneshot",
        exec_mode: "normal",
        search_mode: "normal",
        auto_cancel: options.autoCancel
        //earliest_time: "2016-06-20T16:27:43.000-07:00",
        //max_count: "150",
        //auto_cancel: "1000"
    };

    //executes the search by passing in the parameters and the query
    service.search(
        searchQuery,
        searchParams,
        function (err, job) {
            //Checks to see if there is an error in connecting to the server and passes it to the notification window.
            if (err) {
                done(_createJsonErrorPayload("Unable to connect to Splunk server", null, '500', '2A', 'Login Failed', {
                    err: err
                }));
                return;
            }

            // polls to ensure the query is executing
            job.track({period: 1000}, {
                done: function (job) {
                    job.results({}, function (err, results, job) {
                        //if there is an error retrieving results notifies the user in the notification window
                        if (err) {
                            done(_createJsonErrorPayload("Error returning the results from Splunk Server", null,
                                '500', '2B', 'Results failed to return properly', {
                                    err: err
                                }));
                            return;
                        }

                        //variables that are associate with the field and rows in splunk
                        var fields = results.fields;
                        var rows = results.rows;

                        // checks to see if there are hits and if not returns
                        if (rows.length < 1) {
                            done(null, null);
                            return;
                        }

                        log.trace({rows: rows}, 'Raw IP Splunk Result Rows');

                        //variable to take the field and row and map it together in a list
                        var resultObjects = _.map(rows, function (row) {
                            return _.zipObject(fields, row);
                        });

                        // grabs the _raw fields from the list
                        var raws = _.map(resultObjects, '_raw');

                        var numResults = _.size(raws);

                        done(null, numResults);
                    });
                },
                failed: function (job) {
                    log.error({job: job}, 'Splunk IP Query Job Failed');
                    done(_createJsonErrorPayload("Splunk IP Job Failed", null,
                        '500', '2D', 'Splunk Job Failure', {
                            job: job
                        }), null);
                },
                error: function (err) {
                    log.error({err: err, job: job}, 'Splunk IP Query Job had an Error');
                    done(_createJsonErrorPayload("Splunk IP Job Error", null,
                        '500', '2E', 'Splunk Job Error', {
                            err: err,
                            job: job
                        }), null);
                }
            });
        }
    );
};

/*
Function that looks for Email data within Splunk
 */
var _lookupEntityEmail = function (entity, options, done) {

    // variable to establish parameters for the connection
    var service = new splunkjs.Service({
        username: options.username,
        password: options.password,
        scheme: options.scheme,
        host: options.host,
        port: options.port,
        version: options.version
    });

    //variable that takes serach string to be executed in Splunk replaces the entity with the entity value
    var searchQuery = options.searchStringIP.replace("{{ENTITY}}", entity.value);

    log.debug({query: searchQuery}, "Running Search Query");

    //sets the serach parameters for splunk
    var searchParams = {
        //exec_mode: "oneshot",
        exec_mode: "normal",
        search_mode: "normal",
        auto_cancel: options.autoCancel
        //earliest_time: "2016-06-20T16:27:43.000-07:00",
        //max_count: "150",
        //auto_cancel: "1000"
    };

    //executes the search by passing in the parameters and the query
    service.search(
        searchQuery,
        searchParams,
        function (err, job) {
            //Checks to see if there is an error in connecting to the server and passes it to the notification window.
            if (err) {
                done(_createJsonErrorPayload("Unable to connect to Splunk server", null, '500', '2A', 'Login Failed', {
                    err: err
                }));
                return;
            }

            // polls to ensure the query is executing
            job.track({period: 1000}, {
                done: function (job) {
                    job.results({}, function (err, results, job) {
                        //if there is an error retrieving results notifies the user in the notification window
                        if (err) {
                            done(_createJsonErrorPayload("Error returning the results from Splunk Server", null,
                                '500', '2B', 'Results failed to return properly', {
                                    err: err
                                }));
                            return;
                        }

                        //variables that are associate with the field and rows in splunk
                        var fields = results.fields;
                        var rows = results.rows;

                        // checks to see if there are hits and if not returns
                        if (rows.length < 1) {
                            done(null, null);
                            return;
                        }

                        log.trace({rows: rows}, 'Raw IP Splunk Result Rows');

                        //variable to take the field and row and map it together in a list
                        var resultObjects = _.map(rows, function (row) {
                            return _.zipObject(fields, row);
                        });

                        // grabs the _raw fields from the list
                        var raws = _.map(resultObjects, '_raw');

                        var numResults = _.size(raws);

                        done(null, numResults);
                    });
                },
                failed: function (job) {
                    log.error({job: job}, 'Splunk IP Query Job Failed');
                    done(_createJsonErrorPayload("Splunk IP Job Failed", null,
                        '500', '2D', 'Splunk Job Failure', {
                            job: job
                        }), null);
                },
                error: function (err) {
                    log.error({err: err, job: job}, 'Splunk IP Query Job had an Error');
                    done(_createJsonErrorPayload("Splunk IP Job Error", null,
                        '500', '2E', 'Splunk Job Error', {
                            err: err,
                            job: job
                        }), null);
                }
            });
        }
    );
};

function startup(logger) {
    log = logger;
}

module.exports = {
    doLookup: doLookup,
    startup: startup,
    validateOptions: validateOptions
};
