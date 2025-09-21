import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const password = req.headers['x-admin-password'];
  if (password !== process.env.SKU_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta.' });
  }

  const { sku, palletNumber, text } = req.body;
  if (!sku || !palletNumber) {
      return res.status(400).json({ success: false, message: 'SKU y Número de Pallet son requeridos.' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('molderil');
    const notesCollection = database.collection('notes');

    if (text && text.trim() !== '') {
      await notesCollection.updateOne(
        { sku: sku, palletNumber: parseInt(palletNumber) },
        { $set: { observation: text.trim() } },
        { upsert: true }
      );
      res.status(200).json({ success: true, message: 'Nota guardada.' });
    } else {
      await notesCollection.deleteOne({ sku: sku, palletNumber: parseInt(palletNumber) });
      res.status(200).json({ success: true, message: 'Nota eliminada.' });
    }
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
