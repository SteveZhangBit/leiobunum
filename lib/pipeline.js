'use strict'

var util = require('util')
  , fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , httpRequest = require('request')
  , Queue = require('./queue')

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
    pathToStore: null,
    concurrent: 16,
    queue: new Queue({ name: 'file.pipeline' })
  }
  var _running = 0

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
        that.queue.push({ url: url, subpath: subpath, filePath: filePath })
      })
    }
  }

  return pipeline({
    spiderOpened: function (spider) {
      if (!fs.existsSync(that.pathToStore)) {
        fs.mkdirSync(that.pathToStore)
      }
      var logger = spider.logger
        , signals = spider.signals
        , queue = that.queue

      function _schedule() {
        queue.get(function (err, task) {
          if (err || !task) {
            return
          }
          // add delay here
          var delay = spider.settings.DOWNLOAD_DELAY * 1000
          if (spider.settings.RANDOMIZE_DOWNLOAD_DELAY) {
            delay *= Math.random() + 0.5
          }
          setTimeout(function () {
            logger.trace('<Queue ' + queue.name + '> running requests ' + (++_running))
            logger.debug('Downloading from ' + task.url)
            httpRequest({ url: task.url, encoding: null, timeout: 30000 }, function (err, response) {
              if (err) {
                signals.spiderError(err, spider)
              } else {
                if (!fs.existsSync(task.subpath)) {
                  fs.mkdirSync(task.subpath)
                }
                fs.writeFile(task.filePath, response.body)
              }
              --_running
              _schedule()
            })
          }, delay)
        })
      }

      for (var i = 0; i < that.concurrent; i++) {
        _schedule()
      }
    },
    spiderClosed: function (reason, spider) {
      spider.logger.debug('Files all be downloaded in ' + that.pathToStore)
    },
    processItem: _processItem
  })
}

pipeline.filesPipeline = filesPipeline
module.exports = pipeline
