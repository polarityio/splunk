/*
 * Copyright (c) 2023, Polarity.io, Inc.
 */
const { map, toPairs, get, replace, flow } = require('lodash/fp');

/**
 * Takes as input an entity object and removes any double quotes as well as newlines
 *
 * ```
 * const escapedEntityValue = escapeQuotes(entity);
 * ```
 *
 * @param entity object which should have a value property
 * @returns {string} escaped entity value
 */
const escapeQuotes = flow(get('value'), replace(/(\r\n|\n|\r)/gm, ''), replace(/"/g, ''));

/**
 * Given an object, converts the object into an array of objects where each object
 * has a `key` and `value` property.
 *
 * For example, the object:
 *
 * ```
 * {
 *   key1: 'value',
 *   key2: 'value2'
 * }
 * ```
 * would be converted to:
 *
 * ```
 * [
 *   {
 *       key: 'key1',
 *       value: 'value'
 *   },
 *   {
 *       key: 'key2',
 *       value: 'value2
 *   }
 * ```
 *
 * @type {((object: object) => {value: *, key: *}[]) | *}
 */
const objectToArray = flow(
  toPairs,
  map(([key, value]) => ({ key, value }))
);

module.exports = {
  escapeQuotes,
  objectToArray
};
