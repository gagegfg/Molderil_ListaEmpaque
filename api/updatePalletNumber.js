import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const password = req.headers['x-admin-password'];
  if (password !== process.env.SKU_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta.' });
  }

  const { newPalletNumber } = req.body;
  if (typeof newPalletNumber !== 'number' || newPalletNumber <= 0) {
    return res.status(400).json({ success: false, message: 'Número de pallet inválido.' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('molderil');
    const countersCollection = database.collection('counters');

    await countersCollection.updateOne(
      { _id: 'pallet_counter' },
      { $set: { seq: newPalletNumber } },
      { upsert: true } 
    );

    res.status(200).json({ success: true, message: 'Número de pallet actualizado correctamente.' });

  } catch (error) {
    console.error('Error updating pallet number:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
