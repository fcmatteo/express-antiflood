import crypto from 'crypto'
import defaults from './defaults'

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64')
}

export default function (store, options, key, extension) {
  return async (req, res, next) => {
    const mergedOptions = { ...defaults, ...options }
    const {
      timeLimit,
      timeBlocked,
      tries,
      prefix,
      failCallback,
    } = mergedOptions

    const storeKey = `${prefix}${hash(key || req.ip)}`
    const value = await store.get(storeKey)

    if (extension) {
      extension(mergedOptions, value)
    }

    if (!value) {
      await store.set(storeKey, 1, timeLimit)
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
      await store.set(storeKey, nextCount, timeBlocked)
    } else {
      await store.set(storeKey, nextCount, timeLimit)
    }
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
