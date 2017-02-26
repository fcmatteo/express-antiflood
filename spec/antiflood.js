import chai from 'chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import antiflood, { MemoryStore } from '../src/main'
import defaults from '../src/defaults'

chai.use(sinonChai)
const should = chai.should(); // eslint-disable-line

const randomInt = () => Math.floor(Math.random() * 100)

const mockReq = () => ({
  ip: `${randomInt()}.${randomInt()}.${randomInt()}.${randomInt()}`,
})

const mockRes = () => ({
  status: sinon.stub(),
  send: sinon.stub(),
  header: sinon.stub(),
})

describe('Antiflood middleware basic tests', () => {
  const middleware = antiflood(MemoryStore())
  let req
  let res
  let next
  beforeEach(() => {
    req = mockReq()
    res = mockRes()
    next = sinon.stub()
    defaults.failCallback = sinon.stub()
  })

  it('should return a middleware', () => {
    middleware.should.be.a('function')
    middleware(req, res, next)
    next.should.have.been.calledOnce
  })

  it(`should block a user that does the request ${defaults.tries} times`, () => {
    defaults.failCallback = sinon.stub()
    for (let i = 0; i < defaults.tries; i += 1) {
      middleware(req, res, next)
    }
    next.callCount.should.be.equal(10)
    middleware(req, res, next)
    middleware(req, res, next)
    next.callCount.should.be.equal(10)
    defaults.failCallback.should.have.been.calledTwice
  })
})

describe('Antiflood middleware times', () => {
  const middleware = antiflood(MemoryStore())
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
  })
  afterEach(() => clock.restore())

  it(`should not block a user that does the request ${defaults.tries} times but ${defaults.timeLimit}ms elapsed`, () => {
    for (let i = 0; i < defaults.tries - 1; i += 1) {
      middleware(req, res, next)
    }
    next.callCount.should.be.equal(9)
    clock.tick(defaults.timeLimit)
    middleware(req, res, next)
    middleware(req, res, next)
    middleware(req, res, next)
    next.callCount.should.be.equal(12)
    defaults.failCallback.should.not.have.been.called
  })

  it(`should block a user for ${defaults.timeBlocked}ms`, () => {
    for (let i = 0; i < defaults.tries; i += 1) {
      middleware(req, res, next)
    }
    next.callCount.should.be.equal(10)
    clock.tick(defaults.timeBlocked - 1)
    middleware(req, res, next)
    next.callCount.should.be.equal(10)
    defaults.failCallback.should.have.been.calledOnce
    clock.tick(1)
    middleware(req, res, next)
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