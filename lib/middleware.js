'use strict'

var util = require('util')
  , URL = require('url')

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

middleware.baseMiddlewares = [
  httpErrorMiddleware,
  offsiteMiddleware,
  depthMiddleware
]
module.exports = middleware
