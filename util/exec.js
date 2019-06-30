'use strict'

const {log, warn} = require('./internal')('exec')

const cp = require('child_process')
const bl = require('bl')

module.exports = (cmd, args) => new Promise((resolve, reject) => {
  const p = cp.spawn(cmd, args, {stdio: 'pipe'})
  log('exec %s %o', cmd, args)
  p.stdout = p.stdout.pipe(bl())
  p.stderr = p.stderr.pipe(bl())

  p.debugErr = (e) => {
    e.cmd = args
    e.stderr = String(p.stderr)
    e.stdout = String(p.stdout)
    e.stack += `\n --- EXEC ---\n CMD: ${[cmd].concat(args).map(JSON.stringify).join(' ')}\n STDERR: \n${e.stderr}\n STDOUT: \n${e.stdout}\n --- EXEC ---`
    log('error', e)
    warn('exec error', e.stack)
    return e
  }

  p.once('exit', (code, sig) => {
    if (code || sig) {
      return reject(p.debugErr(new Error('Code/Sig ' + (code || sig))))
    }

    return resolve(p)
  })

  p.once('error', reject)
})
