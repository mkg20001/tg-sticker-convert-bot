'use strict'

const debug = require('debug')
const pino = require('pino')

module.exports = (id) => {
  const log = debug('teleutils:' + id)
  const pinoLog = pino('teleutils:' + id)
  return {
    log,
    warn: (...a) => {
      // TODO: add sentry reporting
      pinoLog.warn(...a) // eslint-disable-line no-console
      log(...a)
    },
    friendlyError: (e, msg) => {
      e.friendly = msg
      e.component = id
      return e
    }
  }
}
