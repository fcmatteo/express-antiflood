import crypto from 'crypto'
import defaults from './defaults'

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64')
}

export default function (store, options, key) {
  return (req, res, next) => {
    const {
      timeLimit,
      timeBlocked,
      tries,
      prefix,
      failCallback,
    } = { ...defaults, ...options }

    const storeKey = `${prefix}${hash(key || req.ip)}`
    const value = store.get(storeKey)
    if (!value) {
      store.set(storeKey, 1, timeLimit)
      next()
      return
    }
    const nextValidRequestDate = value.nextDate
    const nextCount = value.count + 1

    if (value.count >= tries) {
      failCallback(req, res, next, nextValidRequestDate)
      return
    }

    if (nextCount === tries) {
      store.set(storeKey, nextCount, timeBlocked)
    } else {
      store.set(storeKey, nextCount, timeLimit)
    }
    next()
  }
}

export function MemoryStore() {
  const localStore = {}
  return {
    get(key) {
      // returns a value from the local store
      return localStore[key]
    },
    set(key, count, expire) {
      // adds an element to the local store
      clearTimeout(localStore[key].timeout)
      const timeout = setTimeout(() => { delete localStore[key] }, expire)
      localStore[key] = { count, timeout }
    },
  }
}
