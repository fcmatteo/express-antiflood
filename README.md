![Build status](https://travis-ci.org/fcmatteo/express-antiflood.svg?branch=master)
# express-antiflood
An antiflood middleware for Express. For using it in production check out the [Redis store](https://github.com/fcmatteo/express-antiflood-redis).

Keep in mind that I'm doing this in my free time, so be kind 😁.

# Installation
    npm install express-antiflood

# Usage
```javascript
import express from 'express'
import antiflood, { MemoryStore } from 'express-antiflood'

const app = express()
const middleware = antiflood(MemoryStore(), {
    tries: 3,
    timeLimit: 30000,
    timeBlocked: 60000 * 10,
})

app.post('/comment', middleware, function (req, res) {
  res.send('Hello World!')
})

app.listen(3000)
```

# Options
## `Antiflood(store, options, extensions)`
* `store` An store. You can use `MemoryStore` which is included in this repo but it's recommended to use a production-ready store like [RedisStore](https://github.com/fcmatteo/express-antiflood-redis)
* `options`
    * `timeLimit` The time that has to pass since the latest request before the store resets the request count to 0 (default: 60000)
    * `timeBlocked` The time (in miliseconds) the user will have to wait when he reached the limit of requests (default: 300000)
    * `tries` Number of tries **before** getting blocked. If the user makes the request `{tries}` times, the request will success but the user will have to wait `{timeBlocked}ms` before making it again (default: 10)
    * `prefix` Prefix for the key saved in the store (default: `''`)
    * `failCallback` A function that gets called with `(req, res, next, nextValidRequestDate)` when a request is blocked (by default it responds with a `Too many requests` error)
    * `getKey` A function that gets called with `(req)` and returns the key that will be used by the store. For example to save the key based on the username. (by default the middleware will use `req.ip`)
* `extensions` A function or an array of functions. Each function receives a `listener`. More info in the [extensions section](#creating-extensions).

# Creating extensions
An extension is just a function that receives a listener function:
```javascript
function (listener) {
  listener(EVENT, function(data) {
    // Do something!
  })
}
```
Where:
* `data` is an object with the following values:
    * `key` The value the store used in the request

## Events
* `SUCCESS` On each request that has been successful and the user has not been blocked
* `LIMIT_REACHED` The request was successful but the user has reached the limit and has been blocked for the following requests
* `BLOCKED` When the request was rejected because the user is blocked

# TODO:
* Add more tests
