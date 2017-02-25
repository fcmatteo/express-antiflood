function failCallbackDefault(req, res, next, nextValidRequestDate) {
  res.status(429);
  res.send({
    error: {
      text: 'Too many requests.',
      nextValidRequestDate,
    },
  })
}

export default {
  timeLimit: 60000,
  timeBlocked: 5 * 60000,
  tries: 10,
  prefix: '',
  failCallback: failCallbackDefault,
}
