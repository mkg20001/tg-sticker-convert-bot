'use strict'

const {log} = require('./internal')('core')

const TeleBot = require('telebot')

const _ERROR = require('./error')
const _EXEC = require('./exec')
const _FETCH = require('./fetch')
const _TMP = require('./tmp')

module.exports = (id, {token, helloMessage, TMP, FETCH}) => {
  log('inizializing')

  // base initialization
  const bot = new TeleBot(token)

  if (helloMessage) {
    bot.on(['/start', '/hello', '/help'], (msg) => msg.reply.text(helloMessage, {webPreview: false, parseMode: 'markdown'}))
  }

  // component initialization
  const error = _ERROR(bot)
  const tmp = _TMP(id, TMP || {})
  const fetch = _FETCH(bot, tmp, FETCH || {})

  return {
    start: () => {
      log('starting')
      tmp.start()
      bot.start()
    },
    stop: () => {
      log('stopping')
      bot.stop()
      tmp.stop()
    },

    bot,
    error,
    exec: _EXEC,
    fetch,
    tmp: tmp.getTmpFile
  }
}
