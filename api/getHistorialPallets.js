
import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('molderil');
    const palletsCollection = database.collection('pallets');

    // Find all documents and sort by palletNumber in descending order
    const pallets = await palletsCollection.find({}).sort({ palletNumber: -1 }).toArray();

    res.status(200).json({ success: true, pallets });
  } catch (error) {
    console.error('Error fetching pallet history:', error);
    res.status(500).json({ success: false, message: 'Error del servidor al obtener el historial' });
  } finally {
    await client.close();
  }
}
