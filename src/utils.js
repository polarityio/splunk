/*
 * Copyright (c) 2023, Polarity.io, Inc.
 */
const { get, replace, flow } = require('lodash/fp');

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

module.exports = {
    escapeQuotes
}