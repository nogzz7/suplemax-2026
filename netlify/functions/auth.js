function isAuthorized(event) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const key = event.headers['x-admin-key'] || event.headers['X-Admin-Key'];
  return key === expected;
}

module.exports = { isAuthorized };
