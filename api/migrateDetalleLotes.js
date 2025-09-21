import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

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

    const filePath = path.join(process.cwd(), 'detallelotes.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rows = fileContent.split(/\r?\n/).filter(row => row.trim() !== '');

    if (rows.length === 0) {
      return res.status(200).json({ success: true, message: 'No hay datos en detallelotes.csv para migrar.' });
    }

    const palletsMap = new Map();

    for (const row of rows) {
        const [sku, descripcion, numeroDePallet, lotesProduccion, fechaProduccion, cantidad, unidadMedida, despachado, cliente] = row.split(';');
        
        if (!numeroDePallet) continue;

        const palletId = parseInt(numeroDePallet.trim());

        if (!palletsMap.has(palletId)) {
            palletsMap.set(palletId, {
                palletNumber: palletId,
                customer: (cliente || '').trim(),
                despachado: (despachado || 'FALSE').trim(),
                fechaProduccion: (fechaProduccion || '').trim(),
                lotes: new Set(),
                items: [],
                // Campos que no están en este CSV se pueden omitir o poner por defecto
                legajo: '',
                transport: '',
                remito: '',
                ordenDeCompra: '',
                bultos: '',
                notes: '',
                isStored: false, // Se migrará por separado
            });
        }

        const pallet = palletsMap.get(palletId);
        
        pallet.items.push({
            sku: (sku || '').trim(),
            description: (descripcion || '').trim(),
            quantity: (cantidad || '').trim(),
            uom: (unidadMedida || '').trim(),
        });

        if (lotesProduccion) {
            lotesProduccion.split('#').forEach(lote => {
                if(lote.trim()) pallet.lotes.add(lote.trim());
            });
        }
    }

    const finalPallets = Array.from(palletsMap.values()).map(p => ({ ...p, lotes: Array.from(p.lotes) }));

    if (finalPallets.length > 0) {
        await palletsCollection.deleteMany({});
        await palletsCollection.insertMany(finalPallets);
    }

    res.status(200).json({
      success: true,
      message: `Migración de detallelotes completada. Se procesaron ${rows.length} filas y se crearon ${finalPallets.length} pallets únicos.`,
    });

  } catch (error) {
    console.error('Error en la migración de detallelotes:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
