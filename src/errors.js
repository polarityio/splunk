/*
 * Copyright (c) 2023, Polarity.io, Inc.
 */

const parseErrorToReadableJSON = (error) =>
    JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));

module.exports = {
    parseErrorToReadableJSON
}