import 'babel-polyfill'
import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

const libDir = process.env.PROD ? 'dist' : 'src'

const main = require(`../${libDir}/main`)
const antiflood = main.default
const MemoryStore = main.MemoryStore
const defaults = require(`../${libDir}/defaults`).default
const {
  SUCCESS,
  LIMIT_REACHED,
  BLOCKED,
} = require(`../${libDir}/events`)

if (process.env.PROD) {
  console.log('Running tests with production files')
} else {
  console.log('Running tests with development files')
}

chai.use(sinonChai)
const should = chai.should()

const randomInt = () => Math.floor(Math.random() * 100)

const mockReq = () => ({
  ip: `${randomInt()}.${randomInt()}.${randomInt()}.${randomInt()}`,
})

const mockRes = () => ({
  status: sinon.stub(),
  send: sinon.stub(),
  header: sinon.stub(),
})

const generateExtension = (success, limit, blocked) =>
  (listener) => {
    listener(SUCCESS, success)
    listener(LIMIT_REACHED, limit)
    listener(BLOCKED, blocked)
  }

describe('Antiflood middleware basic tests', () => {
  let middleware
  let req
  let res
  let next
  beforeEach(() => {
    req = mockReq()
    res = mockRes()
    next = sinon.stub()
    defaults.failCallback = sinon.stub()
    middleware = antiflood(MemoryStore())
  })

  it('should return a middleware', async () => {
    middleware.should.be.a('function')
    await middleware(req, res, next)
    next.should.have.been.calledOnce
  })

  it(`should block a user that does the request ${defaults.tries} times`, async () => {
    for (let i = 0; i < defaults.tries; i += 1) {
      await middleware(req, res, next)
    }
    next.callCount.should.be.equal(10)
    await middleware(req, res, next)
    await middleware(req, res, next)
    next.callCount.should.be.equal(10)
    defaults.failCallback.should.have.been.calledTwice
  })
})

describe('Antiflood middleware times', () => {
  let middleware
  let req
  let res
  let next
  let clock
  beforeEach(() => {
    req = mockReq()
    res = mockRes()
    next = sinon.stub()
    clock = sinon.useFakeTimers()
    defaults.failCallback = sinon.stub()
    middleware = antiflood(MemoryStore())
  })
  afterEach(() => clock.restore())

  it(`should not block a user that does the request ${defaults.tries} times but ${defaults.timeLimit}ms elapsed`, async () => {
    for (let i = 0; i < defaults.tries - 1; i += 1) {
      await middleware(req, res, next)
    }
    next.callCount.should.be.equal(9)
    clock.tick(defaults.timeLimit)
    await middleware(req, res, next)
    await middleware(req, res, next)
    await middleware(req, res, next)
    next.callCount.should.be.equal(12)
    defaults.failCallback.should.not.have.been.called
  })

  it(`should block a user for ${defaults.timeBlocked}ms`, async () => {
    for (let i = 0; i < defaults.tries; i += 1) {
      await middleware(req, res, next)
    }
    next.callCount.should.be.equal(10)
    clock.tick(defaults.timeBlocked - 1)
    await middleware(req, res, next)
    next.callCount.should.be.equal(10)
    defaults.failCallback.should.have.been.calledOnce
    clock.tick(1)
    await middleware(req, res, next)
    next.callCount.should.be.equal(11)
    defaults.failCallback.should.have.been.calledOnce
  })
})

describe('MemoryStore', () => {
  const store = MemoryStore()
  let clock
  before(() => { clock = sinon.useFakeTimers() })
  after(() => clock.restore())

  it('should exist and expose a store API', () => {
    store.should.be.an('object')
    store.get.should.be.a('function')
    store.set.should.be.a('function')
  })

  it('should not exist the element if the key is not in the store', () => {
    const obj = store.get('username')
    should.not.exist(obj)
  })

  it('should return the count of the key saved and later be deleted', () => {
    const expireTime = 1000
    const nextDate = (new Date()).getTime() + expireTime
    store.set('username', 1, expireTime)
    clock.tick(999)
    const obj = store.get('username')
    obj.should.be.an('object')
    obj.count.should.be.a('number')
    obj.count.should.be.equal(1)
    obj.nextDate.should.be.a('number')
    obj.nextDate.should.be.equal(nextDate)
    clock.tick(1)
    const deleted = store.get('username')
    should.not.exist(deleted)
  })
})

describe('Extensions', () => {
  let extension1
  let extension2
  let successFn1
  let successFn2
  let limitFn1
  let limitFn2
  let blockedFn1
  let blockedFn2
  let req
  let res
  let next
  beforeEach(() => {
    req = mockReq()
    res = mockRes()
    next = sinon.stub()
    defaults.failCallback = sinon.stub()
    successFn1 = sinon.stub()
    successFn2 = sinon.stub()
    limitFn1 = sinon.stub()
    limitFn2 = sinon.stub()
    blockedFn1 = sinon.stub()
    blockedFn2 = sinon.stub()
    extension1 = generateExtension(successFn1, limitFn1, blockedFn1)
    extension2 = generateExtension(successFn2, limitFn2, blockedFn2)
  })

  it('should emit success event', async () => {
    const middleware = antiflood(MemoryStore(), {}, extension1)
    await middleware(req, res, next)
    successFn1.should.have.been.calledOnce
    limitFn1.should.have.not.been.called
    blockedFn1.should.have.not.been.called
  })

  it('should receive an array of extensions', async () => {
    const extensions = [extension1, extension2]
    const middleware = antiflood(MemoryStore(), {}, extensions)
    await middleware(req, res, next)
    successFn1.should.have.been.calledOnce
    successFn2.should.have.been.calledOnce
    limitFn1.should.have.not.been.called
    limitFn2.should.have.not.been.called
    blockedFn1.should.have.not.been.called
    blockedFn2.should.have.not.been.called
  })

  it('should be listened by each extension for all the events', async () => {
    const extensions = [extension1, extension2]
    const middleware = antiflood(MemoryStore(), {}, extensions)
    for (let i = 0; i < defaults.tries; i += 1) {
      await middleware(req, res, next)
    }
    successFn1.should.have.callCount(9)
    successFn2.should.have.callCount(9)
    limitFn1.should.have.been.calledOnce
    limitFn2.should.have.been.calledOnce
    blockedFn1.should.have.not.been.called
    blockedFn2.should.have.not.been.called
    await middleware(req, res, next)
    successFn1.should.have.callCount(9)
    successFn2.should.have.callCount(9)
    limitFn1.should.have.been.calledOnce
    limitFn2.should.have.been.calledOnce
    blockedFn1.should.have.calledOnce
    blockedFn2.should.have.calledOnce
    await middleware(req, res, next)
    successFn1.should.have.callCount(9)
    successFn2.should.have.callCount(9)
    limitFn1.should.have.been.calledOnce
    limitFn2.should.have.been.calledOnce
    blockedFn1.should.have.calledTwice
    blockedFn2.should.have.calledTwice
  })
})
