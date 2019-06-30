#!/usr/bin/env node

'use strict'

const pino = require('pino')
const log = pino({name: 'tg-sticker-convert-bot'})

const emoji = require('emoji-dictionary')
const URI = require('urijs')
const path = require('path')

const HELLO = `*This bot turns files into the required format for Telegram Stickers!*

Just send me your files and I'll convert them!
 \\* Transparent images must be sent as files/documents, otherwise they lose transparencey
 \\* Links get downloaded and converted
 \\* Stickers are accepted as well

Oh, and could you please...
 \\* Report bugs when you spot them: https://github.com/mkg20001/tg-sticker-convert-bot/issues
 \\* Donate: https://paypal.me/mkg20001
`

const core = require('./util')('sticker-convert-bot', {
  token: process.argv[2],
  helloMessage: HELLO
})

async function doConvert (input, reply, opt) {
  let output = core.tmp('_sticker_converted.png')

  log.info({input: input.path, output: output.path}, 'Converting...')

  await core.exec('convert', [input.path, '-alpha', 'set', '-resize', '512x512', output.path])

  await reply.file(output.path, opt)

  // clean disk
  input.cleanup()
  output.cleanup()
}
const nameToPng = (name) => {
  name = path.basename(name)
  const parsed = path.parse(name)
  parsed.ext = '.png'
  return path.format(parsed)
}

const handleSticker = async (msg) => {
  const location = await core.fetch.tg(msg.sticker)
  await doConvert(location, msg.reply, {fileName: (msg.sticker.emoji ? emoji.getName(msg.sticker.emoji) + '_sticker' : 'sticker') + '.png'}) // can't send .webp since this gets interpreted as sticker automatically
}
const handleDocument = async (msg) => {
  const doc = msg.document
  if (!doc.mime_type.startsWith('image/')) {
    return msg.reply.text('That doesn\'t look like an image')
  }

  const location = await core.fetch.tg(doc)

  await doConvert(location, msg.reply, {fileName: nameToPng(doc.file_name), asReply: true})
}
const handlePhoto = async (msg) => {
  const bestPhoto = ( // get first photo that has 512px or bigger in one dimension, otherwise get biggest TODO: check if always size sorted
    msg.photo.filter(ph => ph.width >= 512 || ph.height >= 512)[0] ||
     msg.photo.pop())

  const location = await core.fetch.tg(bestPhoto)

  await doConvert(location, msg.reply, {fileName: 'sticker.png', asReply: true})
}
const handleText = async (msg) => {
  if (msg.text.trim().startsWith('/')) { // ignore cmds
    return
  }

  let urls = []
  URI.withinString(msg.text, (url) => urls.push(url))
  if (!urls.length) {
    // TODO: friendly error
    return msg.reply.text('Didn\'t find any URLs in your message', {asReply: true})
  }

  if (urls.length > 20) {
    // TODO: friendly error
    return msg.reply.text('Too many URLs!')
  }

  await Promise.all(urls.map(async (url) => {
    try {
      const loc = await core.fetch.web(url)
      await doConvert(loc, msg.reply, {fileName: nameToPng(url), asReply: true})
    } catch (e) {
      // TODO: rewrite
      msg.reply.text('ERROR: Couldn\'t convert ' + url, {webPreview: false, asReply: true})
      log.error(e)
      core.error.captureException(e)
    }
  }))
}

const {bot} = core

bot.on('sticker', handleSticker)
bot.on('document', handleDocument)
bot.on('photo', handlePhoto)
bot.on('text', handleText)
bot.on('forward', (msg) => {
  switch (true) {
    case Boolean(msg.document):
      handleDocument(msg)
      break
    case Boolean(msg.text):
      handleText(msg)
      break
    case Boolean(msg.photo):
      handlePhoto(msg)
      break
    default: {}
  }
})

core.start()
/*
const TeleBot = require('telebot')
const bot = new TeleBot(process.argv[2])
const ERROR_REPLY = 'Boom!\nYou just made this bot go kaboom!\nHave a 🍪️!'
const fetch = require('node-fetch')

const URI = require('urijs')

const TMP = path.join(os.tmpdir(), 'sticker-convert-bot')

const Sentry = require('@sentry/node')
Sentry.init({dsn: process.env.SENTRY_DSN})

const nameToPng = (name) => {
  name = path.basename(name)
  const {ext} = path.parse(name)
  return name.replace(ext, '.png')
}

const tgFetch = async (file, msg) => {
  if (!file) {
    return msg.reply.text(ERROR_REPLY)
  }

  if (file.file_size > MAX_SIZE) {
    return msg.reply.text('Sorry, but we only support files up to 25MB!')
  }

  log.info(file, 'Downloading %s...', file.file_id)

  const f2 = await bot.getFile(file.file_id)

  if (f2.file_size > MAX_SIZE) { // dbl check
    return msg.reply.text('Sorry, but we only support files up to 25MB!')
  }

  return webFetchToTmp(f2.fileLink, path.basename(f2.file_path || ''))
}

const webFetchToTmp = async (url, postname) => {
  const res = await fetch(url)

  let tmp = getTMP(postname)

  log.info({tmp, url}, 'Downloading %s to %s...', url, tmp)

  /* if (res.headers.get('content-type') && !res.headers.get('content-type').startsWith('image/')) {
    throw new Error('Not an image')
  } *

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(tmp)
    res.body.pipe(dest)
    let dlSize = 0
    res.body.on('data', data => {
      dlSize += data.length
      if (dlSize > MAX_SIZE) { // someone is downloading an ISO or stuff
        dest.close()
        res.body.close()
        reject(new Error('Too big!'))
      }
    })
    res.body.on('error', err => {
      reject(err)
    })
    dest.on('finish', () => {
      resolve()
    })
    dest.on('error', err => {
      reject(err)
    })
  })

  return tmp
}

const origOn = bot.on.bind(bot)
let events = {}
bot.on = (ev, fnc, ...a) => {
  let wrapped = async (msg, ...a) => {
    try {
      let res = await fnc(msg, ...a)
      return res
    } catch (e) {
      log.error(e)
      Sentry.captureException(e)
      try {
        msg.reply.text(ERROR_REPLY)
      } catch (e) {
        // ignore
      }
    }
  }
  events[ev] = wrapped
  origOn(ev, wrapped, ...a)
}

bot.on(['/start', '/hello'], (msg) => msg.reply.text(HELLO, {webPreview: false, parseMode: 'markdown'}))

bot.on('forward', (msg) => {
  switch (true) {
    case Boolean(msg.document):
      events.document(msg)
      break
    case Boolean(msg.text):
      events.text(msg)
      break
    case Boolean(msg.photo):
      events.photo(msg)
      break
    default: {}
  }
})

bot.on('sticker', async (msg) => {
  const location = await tgFetch(msg.sticker)
  await doConvert(location, msg.reply, {fileName: (msg.sticker.emoji ? emoji.getName(msg.sticker.emoji) + '_sticker' : 'sticker') + '.png'}) // can't send .webp since this gets interpreted as sticker automatically
  // return msg.reply.text(location)
})

bot.on('document', async (msg) => {
  const doc = msg.document
  if (!doc.mime_type.startsWith('image/')) {
    return msg.reply.text('That doesn\'t look like an image')
  }

  const location = await tgFetch(doc)

  await doConvert(location, msg.reply, {fileName: nameToPng(doc.file_name), asReply: true})
})

bot.on('photo', async (msg) => {
  const bestPhoto = ( // get first photo that has 512px or bigger in one dimension, otherwise get biggest TODO: check if always size sorted
    msg.photo.filter(ph => ph.width >= 512 || ph.height >= 512)[0] ||
     msg.photo.pop())

  const location = await tgFetch(bestPhoto)

  await doConvert(location, msg.reply, {fileName: 'sticker.png', asReply: true})
})

bot.on('text', async (msg) => {
  if (msg.text.trim().startsWith('/')) { // ignore cmds
    return
  }

  let urls = []
  URI.withinString(msg.text, (url) => urls.push(url))
  if (!urls.length) {
    return msg.reply.text('Didn\'t find any URLs in your message', {asReply: true})
  }

  if (urls.length > 20) {
    return msg.reply.text('Too many URLs!')
  }

  await Promise.all(urls.map(async (url) => {
    try {
      const loc = await webFetchToTmp(url)
      await doConvert(loc, msg.reply, {fileName: nameToPng(url), asReply: true})
    } catch (e) {
      msg.reply.text('ERROR: Couldn\'t convert ' + url, {webPreview: false, asReply: true})
      log.error(e)
      Sentry.captureException(e)
    }
  }))
})

async function doConvert (input, reply, opt) {
  let output = getTMP('_sticker_converted.png')

  log.info({input, output}, 'Converting...')

  await exec('convert', [input, '-alpha', 'set', '-resize', '512x512', output])

  await reply.file(output, opt)

  // clean disk
  rimraf(input)
  rimraf(output)
}

bot.start()
 */
