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
        failCallback: globalFailCallback,
      } = { ...globalDefaults, ...globalOptions }
      const globalKey = `${globalPrefix}${hash(req.ip)}`
      const blocks = store.getElements(globalKey).length
      if (blocks >= blocksLimit) {
        globalFailCallback(req, res, next, nextValidRequestDate)
      }
      if (nextCount === tries) {
        if (blocks + 1 >= blocksLimit) {
          store.add(globalKey, storeKey, globalTimeBlocked)
        } else {
          store.add(globalKey, storeKey, globalTimeLimit)
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
  const globalStore = {}
  return {
    get(key) {
      // returns a value from the local store
    },
    set(key, count, expire) {
      clearTimeout(localStore[key].timeout)
      const timeout = setTimeout(() => { delete localStore[key] }, expire)
      localStore[key] = { count, timeout }
    },
    add(key, localKey, expire) {
      // add an element to an array of keys (from the local store) in the global store
    },
    getElements(key) {
      // returns an array from the global store which has keys from the local store
    },
  }
}
