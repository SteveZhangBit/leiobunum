'use strict'

var redis = require('redis')
  , util = require('util')
  , Q = require('q')
  , downloader = require('./downloader')

function redisQueue(options) {
  var that = {}

  var queue = new RedisQueue(options)
  that.queue = queue

  that.cacheDownloader = downloader({
    processRequest: function (request, spider) {
      var deferred = Q.defer()
      queue._producer.get(request.url, function (err, val) {
        if (!err) {
          if (val) {
            deferred.reject(new Error('request dropped'))

            spider.logger.debug('response cached for ' + request.url)
            var response = JSON.parse(val)
            response.body = new Buffer(response.body.data)
            spider.signals.responseDownloaded(request, response, spider)
          } else {
            deferred.resolve([request, spider])
          }
        } else {
          deferred.reject(err)
        }
      })
      return deferred.promise
    },

    processResponse: function (request, response, spider) {
      queue._producer.exists(request.url, function (err, val) {
        if (!err && !val) {
          queue._producer.set(request.url, JSON.stringify(response))
        }
      })
    }
  })

  that.uniqueDownloader = downloader({
    processRequest: function (request, spider) {
      var deferred = Q.defer()
      queue._producer.sismember(queue.name + '.set', request.url, function (err, val) {
        if (err) {
          deferred.reject(err)
          return
        }
        if (val) {
          deferred.reject(new Error('request dropped'))
        } else {
          queue._producer.sadd(queue.name + '.set', request.url)
          deferred.resolve([request, spider])
        }
      })
      return deferred.promise
    }
  })

  return that
}

var RedisQueue = function (options) {
  var _this = this

  this.name = options.name || 'redis.requests'
  this.timeout = options.timeout || 60

  var _options = util._extend({}, options)
  delete _options.name
  delete _options.timeout
  delete _options.host
  delete _options.port
  this._consumer = redis.createClient(options.port || 6379,
    options.host || '127.0.0.1', _options)
  this._producer = redis.createClient(options.port || 6379,
    options.host || '127.0.0.1', _options)

  this.on('error', function (err) {
    console.log(err.message)
  })
}

RedisQueue.prototype.on = function (e, callback) {
  this._consumer.on(e, callback)
  this._producer.on(e, callback)
}

RedisQueue.prototype.end = function () {
  console.log(this.name + ' will shutdown')
  this._consumer.end()
  this._producer.end()
}

RedisQueue.prototype.push = function (val, callback) {
  this._producer.rpush(this.name, JSON.stringify(val), callback)
}

RedisQueue.prototype.get = function (callback) {
  var _this = this
  this._consumer.blpop(this.name, this.timeout, function (err, val) {
    if (!err && val) {
      try {
        val = JSON.parse(val[1])
      } catch (e) {
        err = e
        val = null
      }
    }
    callback(err, val)
  })
}

RedisQueue.prototype.count = function (callback) {
  this._producer.llen(this.name, callback)
}

module.exports = redisQueue
