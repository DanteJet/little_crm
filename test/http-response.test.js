import test from 'node:test';
import assert from 'node:assert/strict';
import { canSendResponse, sendResponse } from '../src/http-response.js';

test('sendResponse writes a normal response once', () => {
  const calls = [];
  const res = {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    writeHead(status, headers) {
      calls.push(['writeHead', status, headers]);
      this.headersSent = true;
    },
    end(body) {
      calls.push(['end', body]);
      this.writableEnded = true;
    },
  };

  assert.equal(canSendResponse(res), true);
  assert.equal(sendResponse(res, 500, 'boom'), true);
  assert.equal(calls.length, 2);
});

test('sendResponse does not write headers after a response has started', () => {
  for (const state of [
    { headersSent: true, writableEnded: false, destroyed: false },
    { headersSent: false, writableEnded: true, destroyed: false },
    { headersSent: false, writableEnded: false, destroyed: true },
  ]) {
    let writes = 0;
    const res = {
      ...state,
      writeHead() { writes += 1; },
      end() { writes += 1; },
    };

    assert.equal(canSendResponse(res), false);
    assert.equal(sendResponse(res, 500, 'boom'), false);
    assert.equal(writes, 0);
  }
});
