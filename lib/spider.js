'use strict'

var util = require('util')
  , log4js = require('log4js')
  , Q = require('q')
  , Signals = require('./signals')
  , httpRequest = require('request')
  , Stats = require('./stats')
  , baseMiddlewares = require('./middleware').baseMiddlewares
  , baseDownloaders = require('./downloader').baseDownloaders

function _sortDict(dict) {
  var items = Object.keys(dict).map(function (key) {
    return [parseInt(key), dict[key]]
  })
  return items.sort(function (x, y) {
    return x[0] - y[0]
  }).map(function (i) {
    return i[1]
  })
}

var Spider = function (options) {
  var _this = this
    , defSettings = require('./settings')

  // default values
  this.name = 'leio'
  this.allowedDomains = []
  this.startUrls = []
  this.settings = defSettings
  this.baseDownloaders = baseDownloaders
  this.baseMiddlewares = baseMiddlewares

  this.signals = new Signals()
  this.stats = new Stats()
  this.Scheduler = require('./scheduler')

  // override default values
  if (typeof options === 'object') {
    if (typeof options.settings === 'object') {
      options.settings = util._extend(defSettings, options.settings)
    }
    util._extend(this, options)
  }

  this.downloaders = _sortDict(util._extend(
    this.baseDownloaders, this.settings.DOWNLOADERS))

  this.middlewares = _sortDict(util._extend(
    this.baseMiddlewares, this.settings.MIDDLEWARES))

  this.pipelines = _sortDict(this.settings.PIPELINES)

  // initialize
  function _scheduleRequest(request) {
    var logger = _this.logger
      , scheduler = _this.scheduler
      , signals = _this.signals

    logger.trace('<Scheduler ' + scheduler.name + '> running requests ' + scheduler.running)
    signals.requestScheduled(request, _this)
  }

  function _scheduleItem(item) {
    var logger = _this.logger
      , scheduler = _this.itemScheduler
      , signals = _this.signals

    logger.trace('<Scheduler ' + scheduler.name + '> running items ' + scheduler.running)
    signals.itemYield(item, _this)
  }

  this.scheduler = new this.Scheduler({
    name: this.name + '.requests',
    concurrent: this.settings.CONCURRENT_REQUESTS,
    schedule: _scheduleRequest
  })
  this.itemScheduler = new this.Scheduler({
    name: this.name + '.items',
    concurrent: this.settings.CONCURRENT_ITEMS,
    schedule: _scheduleItem
  })
  this.signals.on('spider closed', function (reason, spider) {
    _this.itemScheduler.end()
    _this.scheduler.end()
  })

  this._setLogger()
  this._setSpiderOpenAndClose()
  this._setDownloaders()
  this._setMiddlewares()
  this._setPipelines()
}

Spider.prototype._setLogger = function () {
  var settings = this.settings

  if (settings.LOG_ENABLED) {
    if (settings.LOG_FILE) {
      log4js.configure({
        appenders: [
          // { type: 'console' },
          { type: 'file', filename: settings.LOG_FILE }
        ],
        replaceConsole: settings.LOG_STDOUT
      })
    } else {
      log4js.configure({
        appenders: [
          { type: 'console' }
        ],
        replaceConsole: settings.LOG_STDOUT
      })
    }
  }
  this.logger = log4js.getLogger(this.name)
  this.logger.setLevel(settings.LOG_LEVEL)
}

Spider.prototype._start = function () {
  // start request scheduler
  this.scheduler.start()
  // start item pipeline
  this.itemScheduler.start()
}

Spider.prototype._setSpiderOpenAndClose = function () {
  var signals = this.signals
    , downloaders = this.downloaders
    , middlewares = this.middlewares
    , pipelines = this.pipelines

  var opensAndCloses = downloaders.concat(middlewares).concat(pipelines)

  signals.on('spider opened', function (spider) {
    opensAndCloses.reduce(function (soFar, opened) {
      return soFar.then(function (spider) {
        var r = opened.spiderOpened(spider)
        return r ? r : spider
      })
    }, Q(spider))
    .then(function (spider) {
      spider._start()
    })
    .catch(function (err) {
      err.message += ' at spider open'
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('spider closed', function (reason, spider) {
    opensAndCloses.reduce(function (soFar, closed) {
      return soFar.spread(function (reason, spider) {
        var r = closed.spiderClosed(reason, spider)
        return r ? r : [reason, spider]
      })
    }, Q([reason, spider]))
    .catch(function (err) {
      err.message += ' at spider close'
      signals.spiderError(err, spider)
    })
    .done()
  })
}

Spider.prototype._setDownloaders = function () {
  var signals = this.signals
    , downloaders = this.downloaders
    , logger = this.logger
    , settings = this.settings
    , scheduler = this.scheduler

  function _retry(request) {
    if (settings.RETRY_ENABLED &&
        (!request.meta['retry'] || request.meta['retry'] < settings.RETRY_TIMES)) {
      request.meta['retry'] = (request.meta['retry'] || 0) + 1
      scheduler.push(request)
    }
  }

  signals.on('request scheduled', function (request, spider) {

    downloaders.reduce(function (soFar, downloader) {
      return soFar.spread(function (request, spider) {
        var r = downloader.processRequest(request, spider)
        return r ? r : [request, spider]
      })
    }, Q([request, spider]))
    .spread(function (request, spider) {
      var deferred = Q.defer()
      if (!request.meta['retry']) {
        logger.debug('Requesting from ' + request.url)
      } else {
        logger.debug('Retry site ' + request.url + ' for ' + request.meta['retry'] + ' times')
      }
      httpRequest(spider._requestOptions(request), function (err, response) {
        if (err) {
          deferred.reject(err)
          _retry(request)
        } else if (settings.RETRY_HTTP_CODES.indexOf(response.statusCode) !== -1) {
          deferred.reject(new Error('[HTTP ERROR] ' + response.statusCode))
          _retry(request)
        } else {
          signals.responseDownloaded(request, response, spider)
          deferred.resolve()
        }
      })
      return deferred.promise
    })
    .catch(function (err) {
      if (err.message === 'request dropped') {
        signals.requestDropped(request, spider)
      } else {
        err.message += ' for ' + request.url + ' at request schedule'
        signals.spiderError(err, spider)
      }
    })
    .fin(function () {
      scheduler.next()
    })
    .done()
  })

  signals.on('response downloaded', function (request, response, spider) {
    var promise = Q.fcall(function (request, response, spider) {
      // add yield methods
      response['yieldRequest'] = function (options) {
        signals.requestYield(spider._makeRequest(options), response, spider)
      }
      response['yieldItem'] = function (item) {
        spider.itemScheduler.push(item)
      }
      // add meta attribute
      response['meta'] = request.meta

      return [request, response, spider]
    }, request, response, spider)

    downloaders.reduce(function (soFar, downloader) {
      return soFar.spread(function (request, response, spider) {
        var r = downloader.processResponse(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, promise)
    .spread(function (request, response, spider) {
      signals.responseReceived(request, response, spider)
    })
    .catch(function (err) {
      err.message += ' for ' + request.url + ' at request downloaded'
      signals.spiderError(err, spider)
    })
    .done()
  })
}

Spider.prototype._setMiddlewares = function () {
  var signals = this.signals
    , middlewares = this.middlewares
    , scheduler = this.scheduler

  signals.on('response received', function (request, response, spider) {
    middlewares.reduce(function (soFar, middleware) {
      return soFar.spread(function (request, response, spider) {
        var r = middleware.processInput(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, Q([request, response, spider]))
    .spread(function (request, response, spider) {
      spider[request.callback](response, spider)
    })
    .catch(function (err) {
      err.message += ' for ' + request.url + ' at request response received'
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('request yield', function (request, response, spider) {
    middlewares.reduce(function (soFar, middleware) {
      return soFar.spread(function (request, response, spider) {
        var r = middleware.processOutput(request, response, spider)
        return r ? r : [request, response, spider]
      })
    }, Q([request, response, spider]))
    .spread(function (request, response, spider) {
      var deferred = Q.defer()
      scheduler.push(request, function (err) {
        if (err) {
          deferred.reject(err)
        } else {
          deferred.resolve([request, response, spider])
        }
      })
      return deferred.promise
    })
    .catch(function (err) {
      if (err.message === 'request dropped') {
        signals.requestDropped(request, spider)
      } else {
        err.message += ' for ' + request.url + ' at request yield'
        signals.spiderError(err, spider)
      }
    })
    .done()
  })
}

Spider.prototype._setPipelines = function () {
  var signals = this.signals
    , pipelines = this.pipelines
    , itemScheduler = this.itemScheduler

  signals.on('item yield', function (item, spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.spread(function (item, spider) {
        var r = pipeline.processItem(item, spider)
        return r ? r : [item, spider]
      })
    }, Q([item, spider]))
    .spread(function (item, spider) {
      signals.itemScraped(item, spider)
    })
    .catch(function (err) {
      if (err.message === 'item dropped') {
        signals.itemDropped(item, spider)
      } else {
        err.message += ' for ' + JSON.stringify(item) + ' at item yield'
        signals.spiderError(err, spider)
      }
    })
    .fin(function () {
      itemScheduler.next()
    })
    .done()
  })
}

Spider.prototype.startRequests = function () {
  var requests = []
    , _this = this

  this.startUrls.forEach(function (url) {
    requests.push(_this._makeRequest(url))
  })
  return requests
}

Spider.prototype._makeRequest = function (options) {
  var request = {
    headers: this.settings.DEFAULT_REQUEST_HEADERS,
    encoding: null, // If null, the body is returned as a Buffer
    jar: true,  // enable cookies
    callback: 'parse',
    meta: {}
  }

  if (typeof options === 'string') {
    request['url'] = options
  } else if (typeof options === 'object') {
    util._extend(request, options)
  }
  return request
}

Spider.prototype._requestOptions = function (request) {
  var copy = util._extend({}, request)
  delete copy.callback
  delete copy.meta
  return copy
}

Spider.prototype.dropItem = function () {
  throw new Error('item dropped')
}

Spider.prototype.dropRequest = function () {
  throw new Error('request dropped')
}

module.exports = Spider
