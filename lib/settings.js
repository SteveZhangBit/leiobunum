'use strict'

var settings = {
  BOT_NAME: 'leiobunum',
  DEFAULT_REQUEST_HEADERS: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1)'+
                  ' AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.80 Safari/537.36'
  },

  LOG_ENABLED: true,
  LOG_FILE: null,
  LOG_LEVEL: 'DEBUG',
  LOG_STDOUT: false,

  STATS_DUMP: true
}

module.exports = settings
