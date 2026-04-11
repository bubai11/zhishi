const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const userService = require('../services/userService');

exports.register = async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const exist = await User.findOne({ where: { username } });
    if (exist) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }

    const hash = await bcrypt.hash(password, 10);
    await User.create({ username, password: hash, email });
    return res.json({ code: 200, message: 'success' });
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message || '注册失败' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(400).json({ code: 400, message: '用户不存在' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ code: 400, message: '密码错误' });

    const secret = process.env.JWT_SECRET || 'secret-key';
    const token = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '7d' });
    return res.json({ code: 200, message: 'success', data: { token, username: user.username } });
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message || '登录失败' });
  }
};

exports.profile = async (req, res) => {
  try {
    const data = await userService.getProfile(req.user.id);
    res.json({ code: 200, message: 'success', data });
  } catch (err) {
    res.status(404).json({ code: 404, message: err.message || '获取失败' });
  }
};

exports.stats = async (req, res) => {
  try {
    const data = await userService.getStats(req.user.id);
    res.json({ code: 200, message: 'success', data });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message || '获取失败' });
  }
};

exports.achievements = async (req, res) => {
  try {
    const data = await userService.getAchievements(req.user.id);
    res.json({ code: 200, message: 'success', data });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message || '获取失败' });
  }
};
