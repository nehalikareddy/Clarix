const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

// authMiddleware reads process.env.JWT_SECRET directly, so we set it
// before requiring/using anything that depends on it.
process.env.JWT_SECRET = 'test-secret-key';

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  test('rejects requests with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a header that does not start with "Bearer "', () => {
    const req = { headers: { authorization: 'Token abc123' } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid/garbled token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an expired token', () => {
    const expiredToken = jwt.sign(
      { id: 'user123' },
      process.env.JWT_SECRET,
      { expiresIn: -10 } // already expired
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a token signed with the wrong secret', () => {
    const badToken = jwt.sign({ id: 'user123' }, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${badToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts a valid token and attaches decoded payload to req.user', () => {
    const validToken = jwt.sign(
      { id: 'user123' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    const res = mockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user.id).toBe('user123');
  });
});
