'use strict';

const {
  flow,
  replace,
  get,
  toLower,
  trim,
  includes,
  filter,
  map,
  negate,
  flatten,
  flatMap,
  concat,
  split,
  eq,
  compact,
  orderBy,
  size,
  find,
  __
} = require('lodash/fp');
const { objectToArray } = require('./utils');
const async = require('async');

const MAX_PARALLEL_LOOKUPS = 10;

const searchKvStoreAndAddToResults = (
  entityGroup,
  options,
  requestWithDefaults,
  done,
  Logger
) => {
  const kvStoreSearchStringFields = flow(
    get('kvStoreSearchStringFields'),
    split(','),
    map(trim)
  )(options);

  const kvStoreQueryTasks = flow(
    get('kvStoreAppsAndCollections'),
    split(','),
    flatMap(
      flow(
        split(':'),
        map(trim),
        ([appName, collectionName]) =>
          (done) =>
            getKvStoreQueryResultForAllCollections(
              entityGroup,
              appName,
              collectionName,
              kvStoreSearchStringFields,
              options,
              requestWithDefaults,
              done,
              Logger
            )
      )
    )
  )(options);

  async.parallelLimit(kvStoreQueryTasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
    if (err) return done(err);

    const kvStoreResults = flow(
      flatten,
      compact,
      map((result) => ({ result }))
    )(results);

    // To ensure that we preserve the order of fields when rendering them in the client, we convert
    // the object to an array of objects containing `key`, `value` properties.
    const kvStoreResultsAsArray = kvStoreResults.map((row) => {
      return {
        result: objectToArray(row.result)
      };
    });

    const kvStoreResultsByEntity = compact(
      map((entity) => {
        const kvStoreResultsForThisEntity = getObjectsContainingString(
          entity.value,
          kvStoreResultsAsArray
        );
        return (
          size(kvStoreResultsForThisEntity) && {
            entity,
            searchResponseBody: kvStoreResultsForThisEntity,
            searchType: 'kv'
          }
        );
      }, entityGroup)
    );

    return done(null, kvStoreResultsByEntity);
  });
};

const getKvStoreQueryResultForAllCollections = (
  entityGroup,
  appName,
  collectionName,
  kvStoreSearchStringFields,
  options,
  requestWithDefaults,
  done,
  Logger
) =>
  requestWithDefaults(
    {
      method: 'GET',
      uri: `${options.url}/servicesNS/nobody/${appName}/storage/collections/data/${collectionName}`,
      qs: {
        query: buildKvStoreQuery(entityGroup, kvStoreSearchStringFields)
      },
      json: true
    },
    options,
    (err, res, body) => {
      const statusCodeNot200 = flow(get('statusCode'), negate(eq(200)))(res);

      if (err || statusCodeNot200) {
        return done({
          err: { statusCode: get('statusCode', res), body },
          detail: 'KV Store Query Request Failed'
        });
      }

      const formattedBody = map(
        flow((record) => ({
          KV_Store_App_Name: appName,
          KV_Store_Collection_Name: collectionName,
          ...record
        })),
        body
      );
      done(null, formattedBody);
    }
  );

const buildKvStoreQuery = (entityGroup, searchFields) => ({
  $or: flatMap(
    (searchField) => map(({ value }) => ({ [searchField]: value }), entityGroup),
    searchFields
  )
});

const getObjectsContainingString = (string, objs) =>
  filter(
    flow(
      JSON.stringify,
      replace(/[^\w]/g, ''),
      toLower,
      includes(flow(replace(/[^\w]/g, ''), toLower)(string))
    ),
    objs
  );

module.exports = {
  searchKvStoreAndAddToResults
};
