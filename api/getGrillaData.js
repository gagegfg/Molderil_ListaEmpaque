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

    const [pallets, notes, articles, clients] = await Promise.all([
      database.collection('pallets').find({}).sort({ palletNumber: -1 }).toArray(),
      database.collection('notes').find({}).toArray(),
      database.collection('articulos').find({}).toArray(),
      database.collection('clients').find({}).toArray(),
    ]);

    const notesMap = new Map(notes.map(note => [`${note.sku};${note.palletNumber}`, note.observation]));
    const articlesMap = new Map(articles.map(art => [art.sku, { larga: art.desc_larga, corta: art.desc_corta }]));
    const clientList = clients.map(c => c.name);

    const grillaData = [];
    let idCounter = 0;

    for (const pallet of pallets) {
      if (pallet.items && Array.isArray(pallet.items)) {
        for (const item of pallet.items) {
          const noteKey = `${item.sku};${pallet.palletNumber}`;
          const articleInfo = articlesMap.get(item.sku) || {};

          grillaData.push({
            id: idCounter++,
            numeroDePallet: pallet.palletNumber,
            lotesProduccion: Array.isArray(pallet.lotes) ? pallet.lotes.join('#') : '',
            cliente: pallet.customer || '',
            despachado: (pallet.customer) ? 'TRUE' : 'FALSE',
            isStored: pallet.isStored || false,
            fechaProduccion: pallet.fechaProduccion,
            sku: item.sku,
            descripcion: articleInfo.larga || item.description,
            cantidad: item.quantity,
            unidadMedida: item.uom,
            hasNote: notesMap.has(noteKey),
            noteText: notesMap.get(noteKey) || '',
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      grillaData: grillaData,
      clientList: clientList,
    });

  } catch (error) {
    console.error('Error fetching grilla data:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
