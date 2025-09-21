import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const password = req.headers['x-admin-password'];
  if (password !== process.env.SKU_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta.' });
  }

  const { numeroDePallet, sku } = req.body;
  if (!numeroDePallet || !sku) {
    return res.status(400).json({ success: false, message: 'SKU y Número de Pallet son requeridos.' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      await client.connect();
      const database = client.db('molderil');
      const palletsCollection = database.collection('pallets');
      const notesCollection = database.collection('notes');

      const pallet = await palletsCollection.findOne({ palletNumber: parseInt(numeroDePallet) }, { session });

      if (!pallet) {
        return;
      }

      if (pallet.items && pallet.items.length === 1 && pallet.items[0].sku === sku) {
        await palletsCollection.deleteOne({ _id: pallet._id }, { session });
      } else {
        await palletsCollection.updateOne(
          { _id: pallet._id },
          { $pull: { items: { sku: sku } } },
          { session }
        );
      }

      await notesCollection.deleteMany({ palletNumber: parseInt(numeroDePallet), sku: sku }, { session });
    });

    res.status(200).json({ success: true, message: 'Fila eliminada correctamente.' });

  } catch (error) {
    console.error('Error deleting grilla row:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await session.endSession();
    await client.close();
  }
}
