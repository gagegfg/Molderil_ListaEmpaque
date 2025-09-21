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

    const [palletCounter, articles] = await Promise.all([
      database.collection('counters').findOne({ _id: 'pallet_counter' }),
      database.collection('articulos').find({}).toArray(),
    ]);

    const nextPalletNumber = palletCounter ? palletCounter.seq : 253076; // Default initial value

    res.status(200).json({
      success: true,
      palletNumber: nextPalletNumber,
      articles: articles.map(art => ({ sku: art.sku, desc_larga: art.desc_larga, desc_corta: art.desc_corta, tipo: art.tipo })),
    });

  } catch (error) {
    console.error('Error fetching initial data:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
