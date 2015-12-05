'use strict'

var util = require('util')
  , fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , httpRequest = require('request')

function pipeline(options) {
  var that = {}

  that.spiderOpened = function (spider) {}
  that.spiderClosed = function (reason, spider) {}
  that.processItem = function (item, spider) {}

  util._extend(that, options)

  return that
}

function filesPipeline(options) {
  var that = {
    pathToStore: null
  }

  if (typeof options === 'string') {
    // path should already exist
    that.pathToStore = options
  } else if (typeof options === 'object') {
    util._extend(that, options)
  }

  function _md5(data) {
    return crypto.createHash('md5').update(data).digest('hex')
  }

  function _processItem(item, spider) {
    if (item['fileUrls']) {
      var subpath = item['fileDir'] ? path.join(that.pathToStore, item['fileDir']) : that.pathToStore
      item['fileUrls'].forEach(function (url) {
        var filePath = path.join(subpath, _md5(url) + url.slice(url.lastIndexOf('.')))
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 512) {
          return
        }
        spider.fileScheduler.push({ url: url, subpath: subpath, filePath: filePath })
      })
    }
  }

  function _init(spider) {
    var logger = spider.logger
      , signals = spider.signals

    var fileScheduler = new spider.Scheduler({
      name: spider.name + '.files.pipeline',
      concurrent: spider.settings.CONCURRENT_ITEMS,
      schedule: _request
    })
    spider.fileScheduler = fileScheduler

    function _request(task) {
      logger.trace('<Scheduler ' + fileScheduler.name + '> running downloading ' + fileScheduler.running)
      // add delay here
      var delay = spider.settings.DOWNLOAD_DELAY * 1000
      if (spider.settings.RANDOMIZE_DOWNLOAD_DELAY) {
        delay *= Math.random() + 0.5
      }
      setTimeout(function () {
        logger.debug('Downloading from ' + task.url)
        httpRequest({ url: task.url, encoding: null, timeout: 30000 }, function (err, response) {
          if (err) {
            logger.error('Download failed for ' + err.message)
          } else {
            if (!fs.existsSync(task.subpath)) {
              fs.mkdirSync(task.subpath)
            }
            fs.writeFile(task.filePath, response.body)
          }
          fileScheduler.next()
        })
      }, delay)
    }
  }

  return pipeline({
    spiderOpened: function (spider) {
      if (!fs.existsSync(that.pathToStore)) {
        fs.mkdirSync(that.pathToStore)
      }
      _init(spider)
      spider.fileScheduler.start()
    },
    spiderClosed: function (reason, spider) {
      spider.logger.debug('Files all be downloaded in ' + that.pathToStore)
      spider.fileScheduler.end()
    },
    processItem: _processItem
  })
}

pipeline.filesPipeline = filesPipeline
module.exports = pipeline
