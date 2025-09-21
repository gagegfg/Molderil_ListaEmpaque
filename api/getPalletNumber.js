
const { MongoClient } = require('mongodb');

// La cadena de conexión se lee desde las Environment Variables de Vercel
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Un manejador para reutilizar la conexión
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  await client.connect();
  const db = client.db("molderil_db"); // Puedes nombrar tu base de datos como quieras
  cachedDb = db;
  return db;
}

// La función serverless principal
export default async function handler(req, res) {
  try {
    const db = await connectToDatabase();
    const countersCollection = db.collection('counters');

    // Buscamos un documento específico para el contador de pallets
    let palletCounter = await countersCollection.findOne({ _id: 'pallet_counter' });

    // Si no existe, lo creamos con un valor inicial.
    // Puedes ajustar este número si necesitas empezar desde otro valor.
    if (!palletCounter) {
      await countersCollection.insertOne({ _id: 'pallet_counter', seq: 253076 });
      palletCounter = { _id: 'pallet_counter', seq: 253076 };
    }

    // Enviamos una respuesta exitosa con el número de pallet
    res.status(200).json({ success: true, palletNumber: palletCounter.seq });

  } catch (error) {
    console.error('Error al conectar o consultar la base de datos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}
