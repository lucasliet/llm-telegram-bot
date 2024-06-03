class ApiNotFoundError {
  constructor(message: string) {
    Error.apply(this, [message]);
  }
}

ApiNotFoundError.prototype = Object.create(Error.prototype);

export default ApiNotFoundError;