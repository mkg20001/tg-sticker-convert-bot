'use strict'

const {log, warn} = require('./internal')('error')
const ERROR_REPLY = 'Sorry, but something went wrong internally'

const Sentry = require('@sentry/node')

module.exports = (bot) => {
  Sentry.init({dsn: process.env.SENTRY_DSN})

  const origOn = bot.on.bind(bot)
  let events = {}
  bot.on = (ev, fnc, ...a) => {
    let wrapped = async (msg, ...a) => {
      try {
        let res = await fnc(msg, ...a)
        return res
      } catch (err) {
        log(err)

        if (!err.friendly) { // don't catch user generated errors
          warn(err.stack)
          Sentry.captureException(err)
        }

        try {
          msg.reply.text(err.friendly || ERROR_REPLY)
        } catch (err) {
          // ignore
        }
      }
    }
    events[ev] = wrapped
    origOn(ev, wrapped, ...a)
  }

  return Sentry
}
