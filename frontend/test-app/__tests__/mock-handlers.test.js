/**
 * Tests for EduMap mock app handlers.
 * Run: npm test (from test-app/ directory)
 */
const assert = require('assert');
const { mockHandlers, findMockHandler } = require('../mock-handlers');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('Running EduMap Mock App tests...\n');

runTest('mockHandlers has entries', () => {
  assert.ok(mockHandlers.length > 0, 'Should have at least one mock handler');
});

runTest('findMockHandler finds login handler', () => {
  const h = findMockHandler('POST', '/api/auth/login');
  assert.ok(h, 'Should find login handler');
});

runTest('login handler returns mock user', () => {
  const h = findMockHandler('POST', '/api/auth/login');
  const result = h.handler({ email: 'test@edumap.vn' });
  assert.ok(result.data.access_token, 'Should return mock access token');
});

runTest('map locations handler returns mock schools', () => {
  const h = findMockHandler('GET', '/api/map/locations');
  const result = h.handler({});
  assert.ok(result.data.length > 0, 'Should return mock schools');
});

runTest('AI chat returns contextual response', () => {
  const h = findMockHandler('POST', '/api/ai/chat');
  const result = h.handler({ message: 'Tôi muốn tìm trường học' });
  assert.ok(result.data.content, 'Should return chat response');
});

console.log('\nDone.');
