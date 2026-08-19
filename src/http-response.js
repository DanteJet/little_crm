export function canSendResponse(res) {
  return !res.headersSent && !res.writableEnded && !res.destroyed;
}

export function sendResponse(res, status, body, headers = {}) {
  if (!canSendResponse(res)) return false;
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers,
  });
  res.end(body);
  return true;
}
