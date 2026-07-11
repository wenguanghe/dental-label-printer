import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PASSWORD_FILE = path.join(DATA_DIR, 'manage-password.json');

const router = express.Router();

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_PASSWORD = '123456';

function readPassword() {
  try {
    if (fs.existsSync(PASSWORD_FILE)) {
      const data = JSON.parse(fs.readFileSync(PASSWORD_FILE, 'utf-8'));
      return data.password || DEFAULT_PASSWORD;
    }
  } catch (e) { /* ignore */ }
  return DEFAULT_PASSWORD;
}

function writePassword(password) {
  fs.writeFileSync(PASSWORD_FILE, JSON.stringify({ password }, null, 2), 'utf-8');
}

// POST /api/password/check — 验证密码
router.post('/check', (req, res) => {
  const { password } = req.body;
  const current = readPassword();
  if (password === current) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// POST /api/password/change — 修改密码
router.post('/change', (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const current = readPassword();
  if (oldPassword !== current) {
    return res.status(401).json({ error: '原密码错误' });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '新密码不能少于 4 位' });
  }
  writePassword(newPassword);
  res.json({ success: true });
});

export default router;
