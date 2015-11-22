'use strict'

var leio = {}

var Spider = require('./lib/spider')

leio.spider = function (options) {
  var spider = new Spider(options)

  spider.run = function () {
    var logger = spider.logger
      , signals = spider.signals
      , settings = spider.settings
      , queue = spider.queue

    printSpider(spider)

    signals.spiderOpened(spider)
    // start requests
    spider.startRequests().forEach(function (request) {
      queue.push(request)
    })
    for (var i = 0; i < settings.CONCURRENT_REQUESTS; i++) {
      spider._schedule()
    }

    process.once('beforeExit', function () {
      signals.spiderClosed('jobs completed', spider)
    })

    process.on('uncaughtException', function(err) {
      logger.fatal(err)
    })
  }

  return spider
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
leio.redisQueue = require('./lib/redis-queue')

module.exports = leio
