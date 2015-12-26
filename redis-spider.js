'use strict'

var leio = require('./index.js')
  , redisScheduler = require('./lib/redis-scheduler')
  , baseDownloaders = require('./lib/downloader').baseDownloaders

var redisSpider = function (options) {
  options.Scheduler = redisScheduler.scheduler(options)

  baseDownloaders['0'] = redisScheduler.uniqueDownloader(options)
  baseDownloaders['10'] = redisScheduler.cacheDownloader(options)
  options.baseDownloaders = baseDownloaders

  var spider = leio.spider(options)

  return spider
}

module.exports = redisSpider
