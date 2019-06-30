'use strict'

const {log, warn} = require('./internal')('tmp')

const mkdir = require('mkdirp').sync
const rimraf = require('rimraf').sync
const os = require('os')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

module.exports = (id, {interval}) => {
  const TMP = path.join(os.tmpdir(), id)
  let TMPFILES = []
  let _interval

  const clean = () => {
    mkdir(TMP)
    log('running tmp clean')

    const FILES = {}

    TMPFILES = TMPFILES.filter(file => { // TODO: source & sentry
      if (file.exists()) {
        if (file.cleaned) {
          warn('file %s should have been cleaned, was reused', file.path)
          file.cleanup()
        } else if (file.expiresAt() < Date.now()) {
          warn('file %s is expired, was overused', file.path)
          file.cleanup()
        } else {
          FILES[path.basename(file.path)] = true
        }

        return true
      } else {
        if (file.cleaned) {
          if (file.expiresAt() < Date.now()) {
            warn('file %s expired, without cleaning', file.path)
          }
        }
      }
    })

    fs.readdirSync(TMP).filter(file => !FILES[file]).forEach(file => {
      warn('file %s shouldn\'t exist', file)
      rimraf(file)
    })
  }

  const getTMP = (postname) => path.join(TMP, crypto.randomBytes(6).toString('hex') + (postname || ''))

  return {
    getTmpFile: (...a) => {
      let name
      while (!name || fs.existsSync(name)) { name = getTMP(...a) }

      const file = {
        cleanup: () => {
          rimraf(name)
          file.cleaned = true
        },
        createdAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000), // 5 mins. date doesn't need to be perfect
        exists: () => fs.existsSync(name),
        path: name,
        toString: () => name
      }

      TMPFILES.push(file)

      return file
    },
    start: () => {
      log('starting tmp')
      _interval = setInterval(clean, interval || 5 * 60 * 1000)
      clean()
    },
    stop: () => {
      log('stopping tmp')
      clearInterval(_interval)
      rimraf(TMP)
    }
  }
}
