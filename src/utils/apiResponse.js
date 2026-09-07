export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  /**
   * Shorthand helper for 200 OK responses
   * @param {Object} res - Express Response Object
   * @param {any} data - Response payload
   * @param {string} [message='Success'] - Response message
   * @param {number} [statusCode=200] - Status code
   */
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json(new ApiResponse(statusCode, data, message));
  }

  /**
   * Shorthand helper for 201 Created responses
   * @param {Object} res - Express Response Object
   * @param {any} data - Response payload
   * @param {string} [message='Resource created successfully.'] - Response message
   */
  static created(res, data, message = 'Resource created successfully.') {
    return res.status(201).json(new ApiResponse(201, data, message));
  }
}
