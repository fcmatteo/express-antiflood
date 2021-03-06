import crypto from 'crypto'
import EventEmitter from 'events'
import defaults from './defaults'
import {
  SUCCESS,
  LIMIT_REACHED,
  BLOCKED,
} from './events'

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64')
}

export default function (store, options, extensions = []) {
  const hub = new EventEmitter()
  if (typeof extensions === 'function') {
    extensions(hub.on.bind(hub))
  } else {
    extensions.forEach(ext => ext(hub.on.bind(hub)))
  }
  const mergedOptions = { ...defaults, ...options }
  const {
    timeLimit,
    timeBlocked,
    tries,
    prefix,
    failCallback,
    getKey,
  } = mergedOptions

  const done = async (key, status, nextCount) => {
    if (status !== BLOCKED) {
      const time = status === SUCCESS ? timeLimit : timeBlocked
      await store.set(key, nextCount, time)
    }
    hub.emit(status, { key })
  }

  return async (req, res, next) => {
    const key = typeof getKey === 'function' ? await getKey(req) : req.ip
    const storeKey = `${prefix}${hash(key)}`
    const value = await store.get(storeKey)

    if (!value) {
      await done(storeKey, SUCCESS, 1)
      next()
      return
    }
    const nextValidRequestDate = value.nextDate
    const nextCount = value.count + 1

    if (value.count >= tries) {
      done(storeKey, BLOCKED)
      failCallback(req, res, next, nextValidRequestDate)
      return
    }

    if (nextCount === tries) {
      await done(storeKey, LIMIT_REACHED, nextCount)
      next()
      return
    }
    await done(storeKey, SUCCESS, nextCount)
    next()
  }
}

export function MemoryStore() {
  const localStore = {}
  return {
    get(key) {
      // returns a value from the store
      const elem = localStore[key]
      return elem && {
        count: elem.count,
        nextDate: elem.nextDate,
      }
    },
    set(key, count, expire) {
      // adds an element to the store
      if (localStore[key]) {
        clearTimeout(localStore[key].timeout)
      }
      const nextDate = (new Date()).getTime() + expire
      const timeout = setTimeout(() => { delete localStore[key] }, expire)
      localStore[key] = { count, timeout, nextDate }
    },
  }
}
