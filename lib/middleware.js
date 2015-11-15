'use strict'

var util = require('util')
  , cheerio = require('cheerio')
  , URL = require('url')
  , iconv = require('iconv-lite')

function middleware(options) {
  var that = {}

  that.processInput = function (request, response, spider) {}
  that.processOutput = function (request, response, spider) {}

  util._extend(that, options)

  return that
}

var httpErrorMiddleware = middleware({
  processInput: function (request, response, spider) {
    if (response.statusCode !== 200) {
      throw new Error('Http Error: ' + response.statusCode)
    }
  }
})

var offsiteMiddleware = middleware({
  processOutput: function (request, response, spider) {
    var hostname = URL.parse(request.url).hostname
      , flag = (spider.allowedDomains.length === 0) ? true : false

    for (var i = 0; i < spider.allowedDomains.length; i++) {
      if (hostname.endsWith(spider.allowedDomains[i])) {
        flag = true
        break
      }
    }
    if (!flag) {
      spider.logger.debug("Filtered offsite request to '" + hostname + "'")
      spider.dropRequest()
    }
  }
})

var depthMiddleware = middleware({
  processInput: function (request, response, spider) {
    response.meta['depth'] = request.meta['depth'] || 0
  },

  processOutput: function (request, response, spider) {
    var depthLimit = spider.settings.DEPTH_LIMIT
      , depth = response.meta['depth'] + 1
    request.meta['depth'] = depth
    if (depthLimit && depth > depthLimit) {
      spider.logger.debug("Ignoring link '" + request.url +
                          "' for depth beyond the max depth: " + depthLimit)
      spider.dropRequest()
    }
  }
})

var cssMiddleware = middleware({
  processInput: function (request, response, spider) {
    if (request['json']) {
      // do nothin when 'json' is true
      response.$ = function () {
        spider.warn("response is json typed")
      }
    }
    // add cheerio
    var charset = response.headers['content-type'].match(/charset=(.*)/i)[1]
    spider.logger.trace('<CSS Middleware> Decoding page using charset ' + charset)
    response.$ = cheerio.load(iconv.decode(response.body, charset), { decodeEntities: false })
  }
})

middleware.uniqueRequestMiddleware = function () {
  var crawledUrls = new Set()
  return middleware({
    processInput: function (request, response, spider) {
      crawledUrls.add(request.url)
    },

    processOutput: function (request, response, spider) {
      if (crawledUrls.has(request.url)) {
        spider.dropRequest()
      }
      crawledUrls.add(request.url)
    }
  })
}

middleware.baseMiddlewares = [
  httpErrorMiddleware,
  offsiteMiddleware,
  depthMiddleware,
  cssMiddleware
]
module.exports = middleware
