'use strict'

var Stats = function () {
  this.startTime = null
  this.endTime = null
  this.pageCrawled = 0
  this.pageError = 0
  this.pageSucceed = 0
}

Stats.prototype.inc = function (name) {
  ++this[name]
}

Stats.prototype.dec = function (name) {
  --this[name]
}

Stats.prototype.get = function (name, defVal) {
  return this[name] || defVal
}

Stats.prototype.set = function (name, val) {
  this[name] = val
}

Stats.prototype.dump = function () {
  console.log('Total time: ' + (this.endTime - this.startTime) + ' ms')
  for (var key in this) {
    if (key === 'startTime' || key === 'endTime') {
      console.log(key + ': ' + this[key].toLocaleString())
    }
    else if (typeof(this[key]) !== 'function') {
      console.log(key + ': ' + this[key])
    }
  }
}

module.exports = Stats
