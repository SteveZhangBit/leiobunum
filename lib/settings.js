'use strict'

var projectSettings = require(process.cwd() + '/settings.js')
  , util = require('util')

var settings = {
  BOT_NAME: 'leiobunum',
  DEFAULT_REQUEST_HEADERS: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'leiobunum https://github.com/SteveZhangBit/leiobunum'
  },

  DOWNLOADERS: {},
  MIDDLEWARES: {},
  PIPELINES: {},

  CONCURRENT_REQUESTS: 16,
  CONCURRENT_ITEMS: 100,

  RETRY_ENABLED: true,
  RETRY_TIMES: 2,
  RETRY_HTTP_CODES: [500, 502, 503, 504, 400, 408],

  DEPTH_LIMIT: 0,
  DOWNLOAD_DELAY: 0,
  RANDOMIZE_DOWNLOAD_DELAY: true,

  LOG_ENABLED: true,
  LOG_FILE: null,
  LOG_LEVEL: 'DEBUG',
  LOG_STDOUT: false,

  STATS_DUMP: true
}

module.exports = util._extend(settings, projectSettings)
