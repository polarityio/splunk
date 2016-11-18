'use strict';

var request = require('request');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var splunkjs = require('splunk-sdk');
var parse = require('csv-parse');

var log = null;

var num = "Number of Results: ";

function doLookup(entities, options, cb) {
    let entitiesWithNoData = [];
    let lookupResults = [];

    async.each(entities, function (entityObj, next) {
        if (entityObj.isIPv4 || entityObj.isIPv6) {
            _lookupEntityIP(entityObj, options, function (err, resultObjects) {
                let splunkUrl = options.uiHostname + '/en-US/app/search/search?q=' + options.searchString.replace("{{ENTITY}}", entityObj.value);
                if (err) {
                    next(err);
                } else {
                    if (resultObjects) {
                        log.debug('Found Result for %s: %j', entityObj.value,resultObjects);
                        lookupResults.push({entity: entityObj.value, data: {
                            entity_name: entityObj.value,
                            tags: [num + resultObjects],
                            details: {
                                url: splunkUrl,
                                num: resultObjects
                            }}});
                    }
                    next(null);
                }});
        }else {
            next(null);
        }

    }, function(err) {
        cb(err, entitiesWithNoData, lookupResults);
    });
}


var _lookupEntityIP = function (entity, options, done) {


    var service = new splunkjs.Service({
        username: options.username,
        password: options.password,
        scheme: options.scheme,
        host: options.host,
        port: options.port,
        version: options.version
    });
    log.debug("Print out service request %j", service);

    var searchQuery = options.searchString.replace("{{ENTITY}}", entity.value);

    log.debug("printing out searchQuery %j", searchQuery);

    var searchParams = {
        exec_mode: "normal",
        search_mode: "normal"
    };

    service.search(
        searchQuery,
        searchParams,
        function(err, job) {
            // Display the job's search ID
            if(err) {
                log.debug("Error searching Splunk %j", err);
                done(err);
                return;
            }
            // Poll the status of the search job
            job.track({period: 200}, {
                done: function(job) {
                    //console.log("Done! " + job.sid);


                    //  Get the results
                    job.results({}, function(err, results, job) {
                        if(err) {
                            done(err);
                            return;
                        }
                        var fields = results.fields;
                        var rows = results.rows;
                        if (rows.length < 1) {
                            done(null,null);
                            return;
                        }

                        var resultObjects = _.map(rows, function(row) {
                            return _.zipObject(fields, row);
                        });
                        log.debug("Printing out resultObjects %j", resultObjects);

                        var raws = _.map(resultObjects, '_raw');

                        /**
                         *
                         * raws
                         * Nov  1 18:34:31 epwwp1803a SymantecServer: DTCCA8...usion Payload URL: "'
                         *
                         *
                         */
                        var countTest = _.size(raws);

                        /*var resultData = _.reduce(raws, function(reduced, rows){
                            log.debug("printing out rows %j", rows);
                            if(!rows){
                                return reduced;
                            }
                            reduced.numResults.push(rows.length);
                            return reduced;
                        }, {
                            numResults:[]
                        });*/

                        /*csvImporter(raws, function(err, csvImportResults) {
                            var logs = _.map(csvImportResults, function(row) {
                                return row[2];
                            });

                            csvImporter(logs, function (err, rows) {
                                var result = [];
                                _.each(rows, function (row){
                                    var parsed =  _.map(row, function(value) {
                                        return value.match(/([^:]+):(.+)/);
                                    });
                                    result.push(parsed);
                                });

                                var resultData =  _.reduce(result, function (reduced, rows) {
                                    _.each(rows, function(field){
                                        if (!field || field.length != 3) {
                                            return reduced;
                                        }
                                        switch(field[1]){
                                            case 'User':
                                                reduced.user.push(field[2]);
                                                break;
                                            case 'Begin':
                                                reduced.firstSeen= Math.min(reduced.firstSeen, new Date(field[2]));
                                                break;
                                            case 'End':
                                                reduced.lastSeen = Math.max(reduced.lastSeen, new Date(field[2]));
                                                break;
                                            case 'CIDS Signature ID':
                                                reduced.cids.push(field[2]);
                                                break;
                                            case 'Occurences':
                                                reduced.occurences.push(field[2]);
                                        }
                                    });
                                    return reduced;
                                }, {
                                    user:[],
                                    firstSeen:Date.now(),
                                    lastSeen:0,
                                    cids:[],
                                    occurences:[]
                                });
                                resultData.users = resultData.user.length;
                                resultData.firstSeen = new Date(resultData.firstSeen);
                                resultData.lastSeen = new Date(resultData.lastSeen);
                                resultData.occurences = resultData.occurences.length;
                                done(null,resultData);
                            });
                        });*/done(null,countTest);
                    });

                },
                failed: function(job) {
                    console.log("Job failed")
                }
            });
        }
    );
};


function csvImporter(records, done)  {
    async.map(records, function(record, mapdone) {
        parse(record, function (err, parsedrow) {
            mapdone(null, parsedrow[0]);
        });
    }, done);
}



function startup(logger) {
    log = logger;

}

module.exports = {
    doLookup: doLookup,
    startup:startup
};