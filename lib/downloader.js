'use strict'

var util = require('util')
  , cheerio = require('cheerio')
  , iconv = require('iconv-lite')

function downloader(options) {
  var that = {}

  that.processRequest = function (request, spider) {}
  that.processResponse = function (request, response, spider) {}

  util._extend(that, options)

  return that
}

var cssDownloader = downloader({
  processResponse: function (request, response, spider) {
    if (request['json']) {
      // do nothin when 'json' is true
      response.$ = function () {
        spider.logger.warn("response is json typed")
      }
    }
    // add cheerio
    try {
      var charset = response.headers['content-type'].match(/charset=(.*)/i)[1]
      spider.logger.trace('<CSS Middleware> Decoding page using charset ' + charset)
      response.$ = cheerio.load(iconv.decode(response.body, charset), { decodeEntities: false })
    } catch (err) {
      response.$ = cheerio.load(response.body)
    }
  }
})

var uniqueRequestDownloader = (function () {
  var crawledUrls = new Set()
  return downloader({
    processRequest: function (request, spider) {
      if (crawledUrls.has(request.url)) {
        spider.dropRequest()
      }
      crawledUrls.add(request.url)
    }
  })
})()

downloader.baseDownloaders = [
  // uniqueRequestDownloader,
  cssDownloader
]
downloader.uniqueRequestDownloader = uniqueRequestDownloader
module.exports = downloader
