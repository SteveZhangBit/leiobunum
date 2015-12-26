'use strict'

var util = require('util')
  , EventEmitter = require('events').EventEmitter

var Scheduler = function (options) {
  EventEmitter.call(this)

  this.name = 'default'
  this.concurrent = 16
  this.running = 0
  this.status = 'run'

  this._q = []
  this._waiting = 0

  if (typeof options === 'object') {
    util._extend(this, options)
  }
}
util.inherits(Scheduler, EventEmitter)

Scheduler.prototype._push = function (val, callback) {
  this._q.push(val)
  callback()
}

Scheduler.prototype.push = function (val, callback) {
  var _this = this
  if (this.status === 'run') {
    this._push(val, function () {
      if (_this._waiting) { _this.emit('' + _this._waiting--, val) }
      if (callback) { callback(null) }
    })
  }
}

Scheduler.prototype._get = function (callback) {
  callback(null, this._q.shift())
}

Scheduler.prototype.get = function (callback) {
  var _this = this
  this._get(function (err, val) {
    if (!err && val) {
      callback(val)
    } else {
      if (err) { console.error(err.message) }
      _this.once('' + ++_this._waiting, function (val) {
        _this.get(callback)
      })
    }
  })
}

Scheduler.prototype.count = function (callback) {
  callback(null, this._q.length)
}

Scheduler.prototype.start = function () {
  for (var i = 0; i < this.concurrent; i++) {
    this._schedule()
  }
}

Scheduler.prototype._schedule = function () {
  var _this = this
  this.get(function (val) {
    _this.running++
    if (val) {
      _this.schedule(val)
    } else {
      _this.next()
    }
  })
}

Scheduler.prototype.next = function () {
  this.running--
  this._schedule()
}

Scheduler.prototype.stop = function () {
  this._q = []
  this.status = 'stop'
}

Scheduler.prototype.end = function () {}

module.exports = Scheduler
