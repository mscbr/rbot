module.exports = class HttpError extends Error {
  code; //?
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}