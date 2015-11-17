'use strict'

var leio = {}
  , httpRequest = require('request')

var Spider = require('./lib/spider')

leio.spider = function (options) {
  var that = new Spider(options)

  that.run = function () {
    var logger = that.logger
      , signals = that.signals
      , settings = that.settings
      , queue = that.queue
      , running = 0

    function _getAllFromQueue() {
      var request = null
      while (running < settings.CONCURRENT_REQUESTS && (request = queue.get())) {
        signals.requestScheduled(request, that)
      }
    }

    printSpider(that)

    signals.spiderOpened(that)
    signals.on('request scheduled', function (request, spider) {
      logger.trace('<Queue ' + queue.name + '> running requests ' + (++running))

      httpRequest(spider._requestOptions(request), function (err, response) {
        if (err) {
          signals.spiderError(err, spider)
        } else {
          signals.responseReceived(request, response, spider)
        }
      })
    })
    signals.on('response received', function (request, response, spider) {
      running--
      _getAllFromQueue()
    })

    // start requests
    that.startRequests().forEach(function (request) {
      queue.push(request)
    })
    _getAllFromQueue()

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

leio.pipeline = require('./lib/pipeline')
leio.middleware = require('./lib/middleware')
leio.httpRequest = httpRequest

module.exports = leio
