'use strict'

var leio = {}

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
      if (running < settings.CONCURRENT_REQUESTS) {
        queue.get(function (err, request) {
          if (err || !request) {
            return
          }
          logger.trace('<Queue ' + queue.name + '> running requests ' + (++running))
          signals.requestScheduled(request, that)
          _getAllFromQueue()
        })
      }
    }

    printSpider(that)

    signals.spiderOpened(that)
    signals.on('response downloaded', function (request, response, spider) {
      --running
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

    process.on('uncaughtException', function(err) {
      logger.fatal(err)
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
leio.downloader = require('./lib/downloader')
leio.middleware = require('./lib/middleware')
leio.defer = require('q').defer

module.exports = leio
