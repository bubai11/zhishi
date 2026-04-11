const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未授权，请先登录'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'secret-key';
    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: 'Token 无效或已过期'
    });
  }
}

module.exports = authMiddleware;
