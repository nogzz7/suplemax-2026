const db = require('./db');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM categories ORDER BY name');
      return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
    }
    // Adicione POST, PUT, DELETE se necessário
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};