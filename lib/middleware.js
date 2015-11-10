'use strict'

var util = require('util')
  , cheerio = require('cheerio')

function middleware(options) {
  var that = {}

  that.processInput = function (request, response, spider) {
    return [request, response, spider]
  }
  that.processOutput = function (request, spider) {
    return [request, spider]
  }

  util._extend(that, options)

  return that
}

var httpErrorMiddleware = middleware({
  processInput: function (request, response, spider) {
    if (response.statusCode !== 200) {
      throw new Error('Http Error: ' + response.statusCode)
    }
    return [request, response, spider]
  }
})

var cssMiddleware = middleware({
  processInput: function (request, response, spider) {
    if (request['json']) {
      // do nothin when 'json' is true
      response.css = function () {
        spider.warn("response is json typed")
      }
    }
    // add cheerio
    response.css = cheerio.load(response.body)
    return [request, response, spider]
  }
})

var crawledUrls = new Set()
var uniqueRequestMiddleware = middleware({
  processInput: function (request, response, spider) {
    crawledUrls.add(request.url)
    return [request, response, spider]
  },

  processOutput: function (request, spider) {
    if (crawledUrls.has(request.url)) {
      spider.dropRequest()
    }
    crawledUrls.add(request.url)
    return [request, spider]
  }
})

middleware.baseMiddlewares = [httpErrorMiddleware, uniqueRequestMiddleware, cssMiddleware]
module.exports = middleware
