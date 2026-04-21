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
      const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
      const products = result.rows.map(row => ({
        ...row,
        price: parseFloat(row.price),
        cost_price: row.cost_price ? parseFloat(row.cost_price) : 0,
        original_price: row.original_price ? parseFloat(row.original_price) : null,
        inventory: parseInt(row.inventory),
      }));
      return { statusCode: 200, headers, body: JSON.stringify(products) };
    }

    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const {
        name,
        description,
        cost_price,
        price,
        original_price,
        inventory,
        collection,
        image_1,
        image_2,
        image_3,
        on_sale,
        available,
        metadata,
      } = data;
      const result = await db.query(
        `INSERT INTO products 
         (name, description, cost_price, price, original_price, inventory, collection,
          image_1, image_2, image_3, on_sale, available, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          name,
          description,
          cost_price,
          price,
          original_price,
          inventory,
          collection,
          image_1,
          image_2,
          image_3,
          on_sale,
          available,
          metadata,
        ]
      );
      const newProduct = result.rows[0];
      newProduct.price = parseFloat(newProduct.price);
      newProduct.cost_price = newProduct.cost_price ? parseFloat(newProduct.cost_price) : 0;
      return { statusCode: 201, headers, body: JSON.stringify(newProduct) };
    }

    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: 'ID required' };
      const data = JSON.parse(event.body);
      const {
        name,
        description,
        cost_price,
        price,
        original_price,
        inventory,
        collection,
        image_1,
        image_2,
        image_3,
        on_sale,
        available,
        metadata,
      } = data;
      await db.query(
        `UPDATE products SET
         name=$1, description=$2, cost_price=$3, price=$4, original_price=$5,
         inventory=$6, collection=$7, image_1=$8, image_2=$9, image_3=$10,
         on_sale=$11, available=$12, metadata=$13
         WHERE id=$14`,
        [
          name,
          description,
          cost_price,
          price,
          original_price,
          inventory,
          collection,
          image_1,
          image_2,
          image_3,
          on_sale,
          available,
          metadata,
          id,
        ]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: 'ID required' };
      await db.query('DELETE FROM products WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Products error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};