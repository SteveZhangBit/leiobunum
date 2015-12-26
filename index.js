'use strict'

var leio = {}
  , Q = require('q')

var Spider = require('./lib/spider')

leio.spider = function (options) {
  var spider = new Spider(options)
    , closeReason = 'jobs completed'

  spider.run = function () {
    var logger = spider.logger
      , signals = spider.signals
      , settings = spider.settings
      , scheduler = spider.scheduler
      , itemScheduler = spider.itemScheduler

    printSpider(spider)

    // add start requests
    spider.startRequests().forEach(function (request) {
      scheduler.push(request)
    })
    // start the spider
    signals.spiderOpened(spider)
    // dump
    process.once('beforeExit', function () {
      spider.stats.dump()
    })
    process.on('SIGINT', function () {
      closeReason = 'user interrupt'
      scheduler.stop()
    })

    process.on('uncaughtException', function(err) {
      logger.fatal(err)
    })

    function _isSchedulerEmpty(scheduler) {
      return function () {
        var deferred = Q.defer()
        scheduler.count(function (err, val) {
          if ((err || !val) && !scheduler.running) {
            deferred.resolve()
          } else {
            deferred.reject()
          }
        })
        return deferred.promise
      }
    }
    var heartbeat = 0
    var timer = setInterval(function () {
      Q.fcall(_isSchedulerEmpty(scheduler))
        .then(_isSchedulerEmpty(itemScheduler))
        .then(function () {
          if (++heartbeat === 3) {
            signals.spiderClosed(closeReason, spider)
            clearInterval(timer)
          }
        })
        .fail(function () {
          heartbeat = 0
        })
        .done()
    }, 1000)
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
leio.redisScheduler = require('./lib/redis-scheduler')
leio.defer = Q.defer

module.exports = leio
