const crypto = require("crypto");

const KEY_LEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN);
  return { passwordSalt: salt.toString("hex"), passwordHash: hash.toString("hex") };
}

function verifyPassword(password, saltHex, hashHex) {
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), KEY_LEN);
  const expected = Buffer.from(hashHex, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function sessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = { hashPassword, verifyPassword, sessionToken, hashToken };
