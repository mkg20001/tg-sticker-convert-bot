#!/usr/bin/env node

'use strict'

const pino = require('pino')
const log = pino({name: 'tg-sticker-convert-bot'})

const emoji = require('emoji-dictionary')
const URI = require('urijs')
const path = require('path')
const fs = require('fs')

const imageminPngquant = require('imagemin-pngquant')
const imageminOptipng = require('imagemin-optipng')

const imageOptimizers = [
  imageminPngquant({
    quality: [0.6, 0.8],
    strip: true,
    speed: 1
  }),
  imageminOptipng({ })
]

const HELLO = `*This bot turns files into the required format for Telegram Stickers!*

Just send me your files and I'll convert them!
 \\* Transparent images must be sent as files/documents, otherwise they lose transparencey
 \\* Links get downloaded and converted
 \\* Stickers are accepted as well

Oh, and could you please...
 \\* Report bugs when you spot them: https://github.com/mkg20001/tg-sticker-convert-bot/issues
 \\* Donate: https://paypal.me/mkg20001
`

const core = require('teleutils')('sticker-convert-bot', {
  token: process.argv[2],
  helloMessage: HELLO
})

async function doConvert (input, reply, opt) {
  let output = core.tmp('_sticker_converted.png')

  log.info({input: input.path, output: output.path}, 'Converting...')

  await core.exec('convert', [input.path, '-alpha', 'set', '-resize', '512x512', output.path])

  if (fs.lstatSync(output.path).size >= 256 * 1024) {
    const buffer = fs.readFileSync(output.path)

    const optimized = await Promise.all(imageOptimizers.map(optimize => optimize(buffer)))

    const bestOptimized = optimized.sort((a, b) => a.length - b.length)[0]

    fs.writeFileSync(output.path, bestOptimized)
  }

  await reply.file(output.path, opt)

  // clean disk
  input.cleanup()
  output.cleanup()
}
const nameToPng = (name) => {
  name = path.basename(name)
  const parsed = path.parse(name)
  parsed.ext = '.png'
  delete parsed.base
  return path.format(parsed)
}

const handleSticker = async (msg) => {
  const location = await core.fetch.tg(msg.sticker)
  if (msg.sticker.is_animated) {
    await msg.track('convert/animated_sticker')
    let {chat: {id: cid}, message_id: msgId} = await msg.reply.file(location.path, {fileName: (msg.sticker.emoji ? emoji.getName(msg.sticker.emoji) + '_animated_sticker' : 'animated_sticker') + '.TGS', asReply: true})
    await bot.sendMessage(cid, 'You can forward this to @stickers after issuing /newanimated to create a new animated pack with this sticker', {webPreview: false, replyToMessage: msgId})
    location.cleanup()
  } else {
    await msg.track('convert/sticker')
    await doConvert(location, msg.reply, {fileName: (msg.sticker.emoji ? emoji.getName(msg.sticker.emoji) + '_sticker' : 'sticker') + '.png', asReply: true}) // can't send .webp since this gets interpreted as sticker automatically
  }
}
const handleDocument = async (msg) => {
  const doc = msg.document
  if (!doc.mime_type.startsWith('image/')) {
    return msg.reply.text('That doesn\'t look like an image')
  }

  const location = await core.fetch.tg(doc)

  await msg.track('convert/document')
  await doConvert(location, msg.reply, {fileName: nameToPng(doc.file_name), asReply: true})
}
const handlePhoto = async (msg) => {
  const bestPhoto = ( // get first photo that has 512px or bigger in one dimension, otherwise get biggest TODO: check if always size sorted
    msg.photo.filter(ph => ph.width >= 512 || ph.height >= 512)[0] ||
     msg.photo.pop())

  const location = await core.fetch.tg(bestPhoto)

  await msg.track('convert/photo')
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
bot.on('forward', async (msg) => {
  switch (true) {
    case Boolean(msg.sticker):
      return handleSticker(msg)
    case Boolean(msg.document):
      return handleDocument(msg)
    case Boolean(msg.text):
      return handleText(msg)
    case Boolean(msg.photo):
      return handlePhoto(msg)
    default: {} // eslint-disable-line no-empty
  }
})

core.start()
