const request = require('supertest');
const app = require('./index');

describe('API Health Checks', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
