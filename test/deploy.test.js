import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nginx = readFileSync(new URL('../deploy/nginx/little-crm.conf', import.meta.url), 'utf8');

test('production nginx config serves static assets directly with cache headers', () => {
  assert.match(nginx, /listen 443 ssl http2;/);
  assert.match(nginx, /location \/img\/\s*\{[\s\S]*alias \/opt\/little_crm\/img\//);
  assert.match(nginx, /location \/img\/\s*\{[\s\S]*expires 30d;/);
  assert.match(nginx, /location \/public\/\s*\{[\s\S]*alias \/opt\/little_crm\/public\//);
  assert.match(nginx, /location \/public\/\s*\{[\s\S]*expires 1d;/);
});

test('production nginx config keeps dynamic routes behind the local Node server', () => {
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
  assert.match(nginx, /proxy_connect_timeout 5s;/);
  assert.match(nginx, /proxy_read_timeout 30s;/);
});
