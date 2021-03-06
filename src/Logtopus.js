'use strict'

const superconf = require('superconf')
const superimport = require('superimport')
const logUtils = require('./logUtils')
const util = require('util')

/**
 * Creates a new logtopus instance
 *
 * ## Conf
 * ```js
 * level: <number> // Defines a loglevel
 * ```
 *
 * @example {js}
 * const log = new Logtopus();
 * log.setLevel('debug')
 * log.debug('System is up and running')
 */
class Logtopus {
  constructor (conf) {
    conf = conf || {}
    this.config(conf)

    this.__conf = conf
    this.__logLevel = conf.level || 3

    /**
     * Set debug mode. Tries to read configuration from `process.env.LOGTOPUS_DEBUG`
     *
     * @property debugMode
     * @type {bool}
     * @default false
     */
    this.debugMode = conf.debugMode || !!process.env.LOGTOPUS_DEBUG

    this.__definedLogLevels = {
      error: 1,
      warn: 2,
      sys: 3,
      req: 4,
      res: 5,
      info: 6,
      debug: 7
    }

    this.__environmentDefault =
      process.env.NODE_ENV === 'production' ? 3
        : process.env.NODE_ENV === 'staging' ? 5
          : process.env.NODE_ENV === 'qa' ? 5
            : process.env.NODE_ENV === 'test' ? 1
              : 6

    this.__logger = new Map()
    this.loadLogger()
  }

  /**
   * Load logtopus configuration from logtopus.json file
   * @return {object} Returns a logtopus config object
   */
  loadConfig () {
    return superconf('logtopus') || {}
  }

  config (conf) {
    if (!conf) {
      return this.__conf
    }

    if (!conf.logger) {
      conf.logger = {
        console: {
          colors: true,
          template: 'default',
          timestamp: false
        },
        file: {
          logfile: './logs/app.log'
        }
      }
    }

    this.__conf = conf
    return this.__conf
  }

  /**
   * Set a loglevel
   * @param {String} level Log level to be set
   * @chainable
   * @return {object} Returns this value
   */
  setLevel (level) {
    if (level) {
      let newLevel = this.__definedLogLevels[level]

      if (!newLevel) {
        throw new Error('Invalid log level argument!')
      }
      this.__logLevel = this.__definedLogLevels[level]
    } else {
      this.__logLevel = this.__environmentDefault
    }

    return this
  }

  /**
   * Get current log level
   * @return {string} Returns  current loglevel
   */
  getLevel () {
    for (let key in this.__definedLogLevels) {
      if (this.__definedLogLevels[key] === this.__logLevel) {
        return key
      }
    }
  }

  loadLogger () {
    for (const loggerName of Object.keys(this.__conf.logger)) {
      if (this.debugMode) {
        console.log('[LOGTOPUS]', `Load ${loggerName} logger`); // eslint-disable-line
      }

      try {
        const moduleName = loggerName.replace(/[A-Z]/g, match => '-' + match.toLowerCase())
        const LoggerClass = superimport(`logtopus-${moduleName}-logger`)
        this.addLogger(loggerName, LoggerClass)
      } catch (err) {
        // ignore errors if not debug enabled
        if (this.debugMode) {
          console.log('[LOGTOPUS]', `Could not load logger module: ${err.stack}`); // eslint-disable-line
        }
      }
    }
  }

  /**
   * Add a logger
   *
   * @method addLogger
   * @param {Object} logger Logger Object
   *
   * @chainable
   * @returns {object} Returns this value
   */
  addLogger (name, LoggerClass) {
    if (this.__logger.has(name)) {
      if (this.debugMode) {
        console.log('[LOGTOPUS]', `Logger ${name} already added: ${err.stack}`); // eslint-disable-line
      }
      return this
    }

    const loggerInstance = new LoggerClass(this.__conf.logger[name])
    this.__logger.set(name, loggerInstance)
    return this
  }

  /**
   * Remove a logger
   *
   * @method removeLogger
   * @param {String} loggerName Logger name
   *
   * @chainable
   * @returns {object} Returns this value
   */
  removeLogger (name) {
    this.__logger.delete(name)
    return this
  }

  /**
   * Writes a log message to all logger
   * @param  {string} type Log message type
   * @param  {string} msg  Log message
   * @param  {any} data Log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  writeLog (type, msg, data) {
    let curLevel = this.__definedLogLevels[type]
    if (curLevel && curLevel > this.__logLevel) {
      return this
    }

    if (!msg) {
      msg = 'No message'
    }

    let time = new Date()
    let uptime = process.uptime()

    let msgPlain
    let msgColorfied
    if (typeof msg.colorfy === 'function') {
      msg._text = msg.text.concat()
      msgPlain = msg.colorfy(false)
      msg.text = msg._text
      msgColorfied = msg.colorfy(true)
    } else {
      msgPlain = msg.replace(/\u001b\[(\d+;)*\d*m/g, '')
      msgColorfied = msg
    }

    let args = Array.prototype.slice.call(arguments, 2)
    let timer
    this.__logger.forEach(logger => {
      if (this.debugMode) {
        timer = logUtils.timer()
      }

      logger.log({
        type: type,
        msg: msgPlain,
        cmsg: msgColorfied,
        data: args,
        time: time,
        uptime: uptime
      })

      if (this.debugMode) {
        console.log(`Write ${type} log to ${logger.constructor.name} logger in ${timer.stop()}`)
      }
    })
  }

  /**
   * Write a debug log
   * @param  {string} msg  Debug log message
   * @param  {any} data Debug log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  debug (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('debug')
    this.writeLog.apply(this, args)
    return this
  }

  /**
   * Write a info log
   * @param  {string} msg  Info log message
   * @param  {any} data Info log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  info (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('info')
    this.writeLog.apply(this, args)
    return this
  }

  /**
   * Write a res log
   * @param  {string} msg  Response log message
   * @param  {any} data Response log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  res (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('res')
    this.writeLog.apply(this, args)
    return this
  }

  /**
   * Write a req log
   * @param  {string} msg  Request log message
   * @param  {any} data Request log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  req (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('req')
    this.writeLog.apply(this, args)
    return this
  }

  /**
   * Write a sys log
   * @param  {string} msg  System log message
   * @param  {any} data System log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  sys (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('sys')
    this.writeLog.apply(this, args)
    return this
  }

  /**
   * Write a warn log
   * @param  {string} msg  Warning log message
   * @param  {any} data Warning log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  warn (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('warn')
    this.writeLog.apply(this, args)
    return this
  }

  /**
   * Write a error log
   * @param  {string} msg  Error log message
   * @param  {any} data Error log data
   *
   * @chainable
   * @return {object}      Returns this value
   */
  error (msg, data) {
    let args = Array.prototype.slice.call(arguments)
    args.unshift('error')
    this.writeLog.apply(this, args)
    return this
  }

  /**
  * Calls flush in all loggers. Should be called before service terminates to avoid losing log data
   *
   * @method  flush
   * @returns {object} Returns a promise
   */
  flush () {
    const flushArr = []
    this.__logger.forEach(logger => {
      if (typeof logger.flush === 'function') {
        flushArr.push(logger.flush())
      }
    })

    return Promise.all(flushArr)
  }

  /**
   * Starts a logtopus timer
   * @return {Object} Returns a LogtopusTimer object
   */
  timer (message) {
    if (!message) {
      return logUtils.timer()
    }

    let timer = logUtils.timer()
    return {
      stop: () => {
        this.writeLog('info', util.format(message, timer.stop()))
      },
      log: (msg) => {
        this.writeLog('info', util.format(msg, timer.log()))
      }
    }
  }
}

module.exports = Logtopus
