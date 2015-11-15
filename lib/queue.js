'use strict'

var util = require('util')

var Queue = function (options) {
  this._q = []
  this.name = 'default'
  if (typeof options === 'object') {
    util._extend(this, options)
  }
}

Queue.prototype.push = function (val) {
  this._q.push(val)
}

Queue.prototype.get = function () {
  return this._q.shift()
}

Queue.prototype.count = function () {
  return this._q.length
}

module.exports = Queue
