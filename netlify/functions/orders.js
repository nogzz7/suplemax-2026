const db = require('./db');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET - listar pedidos
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
      const orders = result.rows.map(row => ({
        ...row,
        total_amount: parseFloat(row.total_amount),
        items: row.items // já é JSONB, mas pode ser array
      }));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(orders)
      };
    }

    // POST - criar pedido
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const { customer_name, customer_phone, items, total_amount, status } = data;
      const result = await db.query(
        `INSERT INTO orders (customer_name, customer_phone, items, total_amount, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [customer_name, customer_phone, JSON.stringify(items), total_amount, status || 'pending']
      );
      const newOrder = result.rows[0];
      newOrder.total_amount = parseFloat(newOrder.total_amount);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newOrder)
      };
    }

    // PUT - atualizar status do pedido
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      const { status } = JSON.parse(event.body);
      await db.query('UPDATE orders SET status=$1 WHERE id=$2', [status, id]);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // DELETE - deletar pedido (opcional)
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      await db.query('DELETE FROM orders WHERE id=$1', [id]);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: 'Método não permitido'
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};