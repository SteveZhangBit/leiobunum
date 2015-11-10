'use strict'

var util = require('util')
  , log4js = require('log4js')
  , Q = require('q')
  , defSettings = require('./settings')
  , Signals = require('./signals')
  , baseMiddlewares = require('./middleware').baseMiddlewares

var Spider = function (options) {
  this.name = 'leio'
  this.allowedDomains = []
  this.startUrls = []
  this.settings = defSettings

  this.middlewares = []
  this.pipelines = []

  if (typeof options === 'object') {
    if (typeof options.settings === 'object') {
      options.settings = util._extend(defSettings, options.settings)
    }
    util._extend(this, options)
  }

  this.signals = new Signals()

  this._setLogger()
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
          { type: 'file', filename: settings.LOG_FILE, category: this.name }
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
  this.logger.setLevel(this.LOG_LEVEL)
}

Spider.prototype._setMiddlewares = function () {
  var signals = this.signals
    , middlewares = baseMiddlewares.concat(this.middlewares)

  signals.on('response received', function (request, response, spider) {
    middlewares.reduce(function (soFar, middleware) {
      return soFar.spread(middleware.processInput)
    }, Q([request, response, spider]))
    .spread(function (request, response, spider) {
      request.callback(response, spider)
    })
    .fail(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('request yield', function (request, spider) {
    middlewares.reduce(function (soFar, middleware) {
      return soFar.spread(middleware.processOutput)
    }, Q([request, spider]))
    .spread(function (request, spider) {
      signals.requestScheduled(request, spider)
    })
    .fail(function (err) {
      if (err.message === 'request dropped') {
        signals.requestDropped(request, spider)
      } else {
        signals.spiderError(err, spider)
      }
    })
    .done()
  })
}

Spider.prototype._setPipelines = function () {
  var signals = this.signals
    , pipelines = this.pipelines

  signals.on('spider opened', function (spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.then(pipeline.spiderOpened)
    }, Q(spider))
    .fail(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('spider closed', function (reason, spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.spread(pipeline.spiderClosed)
    }, Q([reason, spider]))
    .fail(function (err) {
      signals.spiderError(err, spider)
    })
    .done()
  })

  signals.on('item yield', function (item, spider) {
    pipelines.reduce(function (soFar, pipeline) {
      return soFar.spread(pipeline.processItem)
    }, Q([item, spider]))
    .spread(function (item, spider) {
      signals.itemScraped(item, spider)
    })
    .fail(function (err) {
      if (err.message === 'item dropped') {
        signals.itemDropped(item, spider)
      } else {
        signals.spiderError(err, spider)
      }
    })
    .done()
  })
}

Spider.prototype.startRequests = function () {
  var requests = []
    , _this = this

  this.startUrls.forEach(function (url) {
    requests.push(_this.makeRequest(url))
  })
  return requests
}

Spider.prototype.makeRequest = function (options) {
  var request = {
    headers: this.settings.DEFAULT_REQUEST_HEADERS,
    callback: this.parse
  }
  if (typeof options === 'string') {
    request['url'] = options
  } else if (typeof options === 'object') {
    util._extend(request, options)
  }
  return request
}

Spider.prototype.parse = function (response, spider) {}

Spider.prototype.yieldItem = function (item) {
  this.signals.itemYield(item, this)
}

Spider.prototype.yieldRequest = function (options) {
  this.signals.requestYield(this.makeRequest(options), this)
}

Spider.prototype.dropItem = function () {
  throw new Error('item dropped')
}

Spider.prototype.dropRequest = function () {
  throw new Error('request dropped')
}

module.exports = Spider
