import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const password = req.headers['x-admin-password'];
  if (password !== process.env.SKU_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta.' });
  }

  const { palletNumbers } = req.body;
  if (!palletNumbers || !Array.isArray(palletNumbers) || palletNumbers.length === 0) {
    return res.status(400).json({ success: false, message: 'Se requiere una lista de números de pallet.' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('molderil');
    const palletsCollection = database.collection('pallets');

    const intPalletNumbers = palletNumbers.map(num => parseInt(num));

    const result = await palletsCollection.updateMany(
      { palletNumber: { $in: intPalletNumbers } },
      { $set: { isStored: true } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} pallet(s) marcados como transferidos.`,
    });

  } catch (error) {
    console.error('Error transferring pallets:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
