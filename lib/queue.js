'use strict'

var util = require('util')

var Queue = function (options) {
  this._q = []
  this.name = 'default'
  if (typeof options === 'object') {
    util._extend(this, options)
  }
}

Queue.prototype.push = function (val, callback) {
  this._q.push(val)
  if (callback) callback(null)
}

Queue.prototype.get = function (callback) {
  callback(null, this._q.shift())
}

Queue.prototype.count = function (callback) {
  callback(null, this._q.length)
}

module.exports = Queue
