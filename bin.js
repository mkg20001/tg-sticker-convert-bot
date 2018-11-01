#!/usr/bin/env node

'use strict'

const TeleBot = require('telebot')
const bot = new TeleBot(process.argv[2])
const ERROR_REPLY = 'Boom!\nYou just made this bot go kaboom!\nHave a :cookie:!'
const fetch = require('node-fetch')
const mkdir = require('mkdirp').sync
const rimraf = require('rimraf').sync
const os = require('os')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const getTMP = (postname) => path.join(TMP, crypto.randomBytes(6).toString('hex') + (postname || ''))
const cp = require('child_process')
const bl = require('bl')
const URI = require('urijs')

const TMP = path.join(os.tmpdir(), 'sticker-convert-bot')
rimraf(TMP)
mkdir(TMP)

const pino = require('pino')
const log = pino({name: 'tg-sticker-convert-bot'})

const MAX_SIZE = 25 * 1024 * 1024

const exec = (cmd, args) => new Promise((resolve, reject) => {
  const p = cp.spawn(cmd, args, {stdio: 'pipe'})
  p.stdout = p.stdout.pipe(bl())
  p.stderr = p.stderr.pipe(bl())

  p.once('exit', (code, sig) => {
    if (code || sig) {
      return reject(new Error('Code/Sig ' + (code || sig)))
    }

    return resolve(p)
  })

  p.once('error', reject)
})

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

  // console.log(res) // TODO: check mime & size

  let tmp = getTMP(postname)

  log.info({tmp, url}, 'Downloading %s to %s...', url, tmp)

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(tmp)
    res.body.pipe(dest)
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
bot.on = (ev, fnc, ...a) => {
  origOn(ev, async (msg, ...a) => {
    try {
      let res = await fnc(msg, ...a)
      return res
    } catch (e) {
      log.error(e)
      // TODO: sentry
      try {
        msg.reply.text(ERROR_REPLY)
      } catch (e) {
        // ignore
      }
    }
  }, ...a)
}

bot.on(['/start', '/hello'], (msg) => msg.reply.text('This bot converts photos / documents into the required 512px png format for using them as telegram stickers.\nJust send the files and I\'ll convert them! (I also take links!)'))

bot.on('sticker', (msg) => {
  return msg.reply.text('You know you\'re supposed to send me files, not the completed stickers?!', { asReply: true })
})

bot.on('document', async (msg) => {
  const doc = msg.document
  if (!doc.mime_type.startsWith('image/')) {
    return msg.reply.text('That doesn\'t look like an image')
  }

  const location = await tgFetch(doc)

  await doConvert(location, msg.reply, {fileName: path.basename(doc.file_name).split('.').shift() + '.png', asReply: true})
})

bot.on('photo', async (msg) => {
  const bestPhoto = ( // get first photo that has 512px or bigger in one dimension, otherwise get biggest TODO: check if always size sorted
    msg.photo.filter(ph => ph.width >= 512 || ph.height >= 512)[0] ||
     msg.photo.pop())

  const location = await tgFetch(bestPhoto)

  await doConvert(location, msg.reply, {fileName: 'sticker.png', asReply: true})
})

bot.on('text', async (msg) => {
  if (msg.trim().text.startsWith('/')) { // ignore cmds
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
      await doConvert(loc, msg.reply, {caption: url, asReply: true})
    } catch (e) {
      msg.reply.text('ERROR: Couldn\'t convert ' + url, {webPreview: false, asReply: true})
    }
  }))
})

async function doConvert (input, reply, opt) {
  let output = getTMP('_sticker_converted.png')

  log.info({input, output}, 'Converting...')

  await exec('convert', [input, '-resize', '512x512', output])

  await reply.file(output, opt)

  // clean disk
  rimraf(input)
  rimraf(output)
}

bot.start()
