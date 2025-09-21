import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log("MIGRATION_LOG: Iniciando migración de detallelotes.");
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    const CWD = process.cwd();
    console.log("MIGRATION_LOG: Current working directory:", CWD);
    
    const filesInCWD = fs.readdirSync(CWD);
    console.log("MIGRATION_LOG: Files in CWD:", filesInCWD.join(', '));

    const filePath = path.join(CWD, 'detallelotes.csv');
    console.log("MIGRATION_LOG: Intentando leer el archivo desde:", filePath);

    if (!fs.existsSync(filePath)) {
        console.error("MIGRATION_LOG: ¡ERROR! El archivo detallelotes.csv no existe en la ruta esperada.");
        return res.status(500).json({ success: false, message: 'El archivo detallelotes.csv no fue encontrado en el servidor.' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log("MIGRATION_LOG: Contenido del archivo leído. Longitud:", fileContent.length);

    if (fileContent.length === 0) {
        console.warn("MIGRATION_LOG: El archivo detallelotes.csv está vacío.");
        return res.status(200).json({ success: true, message: 'El archivo detallelotes.csv está vacío, no hay nada que migrar.' });
    }

    const rows = fileContent.split(/\r?\n/).filter(row => row.trim() !== '');
    console.log(`MIGRATION_LOG: Se encontraron ${rows.length} filas en el CSV.`);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, message: 'No hay filas con datos en detallelotes.csv para migrar.' });
    }

    const palletsMap = new Map();

    for (const row of rows) {
        const [sku, descripcion, numeroDePallet, lotesProduccion, fechaProduccion, cantidad, unidadMedida, despachado, cliente] = row.split(';');
        if (!numeroDePallet || !numeroDePallet.trim()) continue;
        const palletId = parseInt(numeroDePallet.trim());
        if (isNaN(palletId)) continue;

        if (!palletsMap.has(palletId)) {
            palletsMap.set(palletId, {
                palletNumber: palletId,
                customer: (cliente || '').trim(),
                despachado: (despachado || 'FALSE').trim(),
                fechaProduccion: (fechaProduccion || '').trim(),
                lotes: new Set(),
                items: [],
                legajo: '', transport: '', remito: '', ordenDeCompra: '', bultos: '', notes: '', isStored: false,
            });
        }
        const pallet = palletsMap.get(palletId);
        pallet.items.push({ sku: (sku || '').trim(), description: (descripcion || '').trim(), quantity: (cantidad || '').trim(), uom: (unidadMedida || '').trim() });
        if (lotesProduccion) {
            lotesProduccion.split('#').forEach(lote => { if(lote.trim()) pallet.lotes.add(lote.trim()); });
        }
    }

    const finalPallets = Array.from(palletsMap.values()).map(p => ({ ...p, lotes: Array.from(p.lotes) }));
    console.log(`MIGRATION_LOG: Se crearon ${finalPallets.length} pallets únicos en el mapa.`);

    await client.connect();
    const database = client.db('molderil');
    const palletsCollection = database.collection('pallets');
    console.log("MIGRATION_LOG: Conectado a la base de datos.");

    if (finalPallets.length > 0) {
        console.log("MIGRATION_LOG: Borrando la colección 'pallets' existente...");
        await palletsCollection.deleteMany({});
        console.log("MIGRATION_LOG: Insertando nuevos pallets...");
        await palletsCollection.insertMany(finalPallets);
        console.log("MIGRATION_LOG: Inserción completada.");
    } else {
        console.warn("MIGRATION_LOG: No se crearon pallets para insertar. Verifique el contenido del CSV.");
    }

    res.status(200).json({
      success: true,
      message: `Migración de detallelotes completada. Se procesaron ${rows.length} filas y se crearon ${finalPallets.length} pallets únicos.`,
    });

  } catch (error) {
    console.error('MIGRATION_LOG: ERROR CATCH:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
    console.log("MIGRATION_LOG: Conexión a la base de datos cerrada. Fin de la ejecución.");
  }
}