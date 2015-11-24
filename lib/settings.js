'use strict'

var settings = {
  BOT_NAME: 'leiobunum',
  DEFAULT_REQUEST_HEADERS: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1)'+
                  ' AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.80 Safari/537.36'
  },

  CONCURRENT_REQUESTS: 16,

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

module.exports = settings
