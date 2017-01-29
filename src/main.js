import crypto from 'crypto'

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64')
}

function failCallbackDefault(req, res, next, nextValidRequestDate) {
  res.status(429);
  res.send({
    error: {
      text: 'Too many requests.',
      nextValidRequestDate,
    },
  })
}

const defaults = {
  timeLimit: 60000,
  timeBlocked: 5 * 60000,
  tries: 10,
  prefix: '',
  failCallback: failCallbackDefault,
}
const globalDefaults = {
  prefix: 'global',
  blocksLimit: 10,
  timeLimit: 30 * 60000,
  timeBlocked: 60 * 60000,
  resetTimeOnRetry: false, // If true, each retry will cause block time to start counting from zero
  failCallback: failCallbackDefault,
}

export default function (store, options, key, globalOptions) {
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
    const nextValidRequestDate = value.nextDate
    const nextCount = value.count + 1 || 1

    if (globalOptions) {
      const {
        timeLimit: globalTimeLimit,
        timeBlocked: globalTimeBlocked,
        blocksLimit,
        prefix: globalPrefix,
        resetTimeOnRetry,
        failCallback: globalFailCallback,
      } = { ...globalDefaults, ...globalOptions }

      const globalKey = `${globalPrefix}${hash(req.ip)}`
      const blocks = store.countElementsGlobal(globalKey)

      if (blocks >= blocksLimit) {
        globalFailCallback(req, res, next, nextValidRequestDate)
      }
      if (nextCount === tries) {
        if (blocks + 1 >= blocksLimit) {
          store.addToGlobal(globalKey, storeKey, globalTimeBlocked, resetTimeOnRetry)
        } else {
          store.addToGlobal(globalKey, storeKey, globalTimeLimit, resetTimeOnRetry)
        }
      }
    }

    if (value.count >= tries) {
      failCallback(req, res, next, nextValidRequestDate)
    }

    if (nextCount === tries) {
      store.set(storeKey, nextCount, timeBlocked)
    } else {
      store.set(storeKey, nextCount, timeLimit)
    }
    next()
  }
}

export const MemoryStore = function () {
  const localStore = {}
  const globalStore = {} // globalStore[key] = { timeout: Number, blocked: Set }
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
    addToGlobal(key, localKey, expire, resetIfExists) {
      // adds an element to a set of keys (from the local store) in the global store
      if (!globalStore[key]) {
        globalStore[key] = { blocked: new Set() }
      }
      if (!globalStore[key].blocked.has(key) || resetIfExists) {
        clearTimeout(globalStore[key].timeout)
        globalStore[key].timeout = setTimeout(() => { delete globalStore[key] }, expire)
      }
      globalStore[key].blocked.add(key)
    },
    countElementsGlobal(key) {
      // returns the number of blocks for that key
      return globalStore[key].blocked.size
    },
  }
}
