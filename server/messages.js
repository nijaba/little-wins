/** Every user-facing string the server sends, in one place. */
module.exports = {
  wrongPin: 'Wrong PIN',
  tooManyPins: (seconds) => `Too many wrong PINs. Try again in ${seconds}s`,
  nameRequired: 'A name is required',
  invalidDay: 'Invalid day',
  viewOnly: 'view only',
  badRequest: 'bad request',
  tooLarge: 'Request too large',
  login: 'login',
  serverError: 'server error',
  refusingToStart: (problems) =>
    `Refusing to start: ${problems.join('; ')}.\nSet real values in docker-compose.override.yml (see docs/admin-guide.md).`,
};
