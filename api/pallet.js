import { MongoClient } from 'mongodb';

// Asegúrate de configurar esta variable de entorno en Vercel
// con tu cadena de conexión a MongoDB Atlas.
const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

async function connectToDatabase() {
  if (client) {
    return { client, db: client.db('molderil_db') };
  }
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  client = await clientPromise;
  return { client, db: client.db('molderil_db') };
}

export default async function handler(req, res) {
  // --- CORS Headers ---
  res.setHeader('Access-Control-Allow-Origin', 'https://gagegfg.github.io'); // Permite peticiones desde tu dominio de GitHub Pages
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Métodos permitidos
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Cabeceras permitidas

  // Manejar la petición OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- Fin CORS Headers ---

  const { db } = await connectToDatabase();
  const countersCollection = db.collection('counters');

  if (req.method === 'GET') {
    try {
      const palletCounter = await countersCollection.findOne({ _id: 'pallet_counter' });

      if (palletCounter) {
        res.status(200).json({ palletNumber: palletCounter.seq });
      } else {
        // Si el contador no existe, lo creamos con un valor inicial de 0
        await countersCollection.insertOne({ _id: 'pallet_counter', seq: 0 });
        res.status(200).json({ palletNumber: 0 });
      }
    } catch (error) {
      console.error('Error fetching pallet number:', error);
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const result = await countersCollection.findOneAndUpdate(
        { _id: 'pallet_counter' },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true } // 'after' devuelve el documento después de la actualización
      );

      if (result.value) {
        res.status(200).json({ newPalletNumber: result.value.seq });
      } else {
        res.status(500).json({ message: 'Failed to increment pallet number' });
      }
    } catch (error) {
      console.error('Error incrementing pallet number:', error);
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}