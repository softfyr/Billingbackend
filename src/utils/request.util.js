/**
 * Utility function to parse JSON body payloads (e.g. from multipart form-data)
 * @param {any} body 
 * @returns {object}
 */
export const parseRequestBody = (body) => {
  let bodyData = body || {};
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch (e) {
      // Return empty or raw string fallback
    }
  }
  return typeof bodyData === 'object' && bodyData !== null ? bodyData : {};
};
