'use strict'

var leio = {}
  , httpRequest = require('request')
  , util = require('util')

var Spider = require('./lib/spider')

leio.spider = function (options) {
  var that = new Spider(options)

  that.run = function () {
    var logger = that.logger
      , signals = that.signals

    printSpider(that)

    signals.spiderOpened(that)
    signals.on('request scheduled', function (request, spider) {
      var requestCopy = util._extend({}, request)
      delete requestCopy.callback

      httpRequest(requestCopy, function (err, response) {
        if (err) {
          logger.info(err.message)
        } else {
          signals.responseReceived(request, response, spider)
        }
      })
    })

    that.startRequests().forEach(function (request) {
      signals.requestScheduled(request, that)
    })

    process.on('beforeExit', function () {
      signals.spiderClosed('jobs completed', that)
    })
  }

  return that
}

function printSpider(spider) {
  console.log('Create spider with following configurations:')
  for (var key in spider.settings) {
    if (key === 'DEFAULT_REQUEST_HEADERS') {
      var headers = spider.settings['DEFAULT_REQUEST_HEADERS']
      console.log('    ' + key + ': ')
      for (var key in headers) {
        console.log('        ' + key + ': ' + headers[key])
      }
    } else {
      console.log('    ' + key + ': ' + spider.settings[key])
    }
  }
  console.log('\n')
}

leio.pipeline = function (options) {
  var that = {}

  that.spiderOpened = function (spider) { return spider }
  that.spiderClosed = function (spider) { return spider }
  that.processItem = function (item, spider) { return [item, spider] }

  util._extend(that, options)

  return that
}

leio.middleware = require('./lib/middleware')

module.exports = leio
