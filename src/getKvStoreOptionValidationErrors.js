'use strict';

const {
  flow,
  reduce,
  replace,
  get,
  split,
  trim,
  includes,
  map,
  eq,
  size,
  keys,
  every,
  toArray,
  join,
  uniq,
  flattenDeep
} = require('lodash/fp');

const getKvStoreOptionValidationErrors = async (options, requestWithDefaults, Logger) =>
  options.searchType.value === 'searchKvStore' &&
  ((await checkForDisplayPossibleCollectionsCase(options, requestWithDefaults, Logger)) ||
    checkForBadCollectionFormattingCase(options) ||
    (await checkForDisplayPossibleSearchFieldsCase(options, requestWithDefaults)));

const checkForDisplayPossibleCollectionsCase = async (
  options,
  requestWithDefaults,
  Logger
) =>
  !options.kvStoreAppsAndCollections &&
  new Promise((res, rej) =>
    requestWithDefaults(
      {
        method: 'GET',
        uri: `${options.url}/services/server/introspection/kvstore/collectionstats`,
        qs: {
          output_mode: 'json'
        },
        json: true
      },
      options,
      (error, response, body) => {
        if (error) return rej(error);
        const availableAppsAndCollections = flow(
          get('entry.0.content.data'),
          map(flow(JSON.parse, get('ns'), replace('.', ':'))),
          join(', ')
        )(body);

        res([
          {
            key: 'searchType',
            message:
              'KV Store Search requires the option "KV Store Apps & Collections to Search" to have a valid value.  Please check validation on that option.'
          },
          {
            key: 'kvStoreAppsAndCollections',
            message: `Required if you want to search the KV Store.${
              availableAppsAndCollections
                ? ` Available Apps & Collections to Search: "${availableAppsAndCollections}"`
                : ''
            }`
          }
        ]);
      }
    )
  );

const checkForBadCollectionFormattingCase = flow(
  get('kvStoreAppsAndCollections'),
  split(','),
  (appCollections) => {
    if (!appCollections) return;

    const splitAppCollection = map(flow(split(':'), map(trim)), appCollections);

    const allHaveBothAppAndCollection = every(flow(size, eq(2)), splitAppCollection);
    if (!allHaveBothAppAndCollection)
      return [
        {
          key: 'kvStoreAppsAndCollections',
          message:
            'All Apps require Collections and vice versa.  You might be missing ":" somewhere.'
        }
      ];

    const appOrCollectionNameIncludesQuotes = includes('"', appCollections);
    if (appOrCollectionNameIncludesQuotes)
      return [
        {
          key: 'kvStoreAppsAndCollections',
          message: 'App and Collection names should not include quotes `"`'
        }
      ];
  }
);

const checkForDisplayPossibleSearchFieldsCase = async (options, requestWithDefaults) => {
  if (!options.kvStoreSearchStringFields) {
    const allUniqueFieldsOnEachCollections = await Promise.all(
      flow(
        get('kvStoreAppsAndCollections'),
        split(','),
        map(
          flow(split(':'), map(trim), ([appName, collectionName]) =>
            getUniquePossibleSearchFieldNames(
              appName,
              collectionName,
              options,
              requestWithDefaults
            )
          )
        )
      )(options)
    );

    const allUniquePossibleSearchFields = flow(
      flattenDeep,
      uniq,
      join(', ')
    )(allUniqueFieldsOnEachCollections);

    return [
      {
        key: 'searchType',
        message:
          'KV Store Search requires the option "KV Store Search Fields" to have a valid value.  Please check validation on that option.'
      },
      {
        key: 'kvStoreSearchStringFields',
        message: `Required if you want to search the KV Store.${
          allUniquePossibleSearchFields
            ? ` Available Search Fields: "${allUniquePossibleSearchFields}"`
            : ' No fields available to search.  Please select a different App and Collection pair.'
        }`
      }
    ];
  }
};

const getUniquePossibleSearchFieldNames = (
  appName,
  collectionName,
  options,
  requestWithDefaults
) =>
  new Promise((res, rej) =>
    requestWithDefaults(
      {
        method: 'GET',
        uri: `${options.url}/servicesNS/nobody/${appName}/storage/collections/data/${collectionName}`,
        qs: {
          output_mode: 'json'
        },
        json: true
      },
      options,
      (error, response, body) =>
        res(
          flow(
            reduce((acc, result) => acc.add(keys(result)), new Set()),
            toArray
          )(body)
        )
    )
  );

module.exports = getKvStoreOptionValidationErrors;
