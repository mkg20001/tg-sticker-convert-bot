'use strict'

const {log, friendlyError} = require('./internal')('fetch')

const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

module.exports = (bot, TMP, {MAX_SIZE}) => {
  if (!MAX_SIZE) { MAX_SIZE = 25 * 1024 * 1024 }
  const webFetchToTmp = async (url, postname) => {
    const res = await fetch(url)

    let tmp = TMP.getTmpFile(postname)

    log('Downloading %s to %s...', url, tmp)

    /* if (res.headers.get('content-type') && !res.headers.get('content-type').startsWith('image/')) {
      throw new Error('Not an image')
    } */

    await new Promise((resolve, reject) => {
      const dest = fs.createWriteStream(tmp.path)
      res.body.pipe(dest)
      let dlSize = 0
      res.body.on('data', data => {
        dlSize += data.length
        if (dlSize > MAX_SIZE) { // someone is downloading an ISO or stuff
          dest.close()
          res.body.close()
          reject(friendlyError(new Error('Too big!'), 'Sorry, but the file is too big'))
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

  const tgFetchViaWeb = async (file) => {
    if (!file) {
      throw new Error('No file supplied')
    }

    if (file.file_size > MAX_SIZE) {
      throw friendlyError(new Error('MAX_SIZE exceeded'), 'Sorry, but we only support files up to 25MB!')
    }

    log('Downloading %s...', file.file_id)

    const f2 = await bot.getFile(file.file_id)

    if (f2.file_size > MAX_SIZE) { // dbl check
      throw friendlyError(new Error('MAX_SIZE exceeded'), 'Sorry, but we only support files up to 25MB!')
    }

    return webFetchToTmp(f2.fileLink, path.basename(f2.file_path || ''))
  }

  return {
    web: webFetchToTmp,
    tg: tgFetchViaWeb
  }
}
