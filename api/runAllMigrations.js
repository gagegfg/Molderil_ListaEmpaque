import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log("MIGRATION_LOG: Iniciando ejecución de TODAS las migraciones.");
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('molderil');

    const CWD = process.cwd();
    console.log("MIGRATION_LOG: Current working directory:", CWD);

    // --- MIGRACION DE ARTICULOS ---
    console.log("MIGRATION_LOG: Ejecutando migración de Artículos...");
    const articulosFilePath = path.join(CWD, 'articulos.csv');
    if (!fs.existsSync(articulosFilePath)) {
        console.warn("MIGRATION_LOG: articulos.csv no encontrado. Saltando migración de artículos.");
    } else {
        const articulosFileContent = fs.readFileSync(articulosFilePath, 'utf-8');
        const articulosRows = articulosFileContent.split(/\r?\n/).filter(row => row.trim() !== '').slice(1); // Skip header
        if (articulosRows.length > 0) {
            const articulosCollection = database.collection('articulos');
            await articulosCollection.deleteMany({});
            const articulosToInsert = articulosRows.map(row => {
                const [tipo, sku, desc_larga, desc_corta] = row.split(';');
                return { tipo: tipo?.trim(), sku: sku?.trim(), desc_larga: desc_larga?.trim(), desc_corta: desc_corta?.trim() };
            }).filter(art => art.sku);
            if (articulosToInsert.length > 0) {
                await articulosCollection.insertMany(articulosToInsert);
                console.log(`MIGRATION_LOG: Migrados ${articulosToInsert.length} artículos.`);
            }
        }
    }

    // --- MIGRACION DE CLIENTES ---
    console.log("MIGRATION_LOG: Ejecutando migración de Clientes...");
    const clientesFilePath = path.join(CWD, 'clientes.txt');
    if (!fs.existsSync(clientesFilePath)) {
        console.warn("MIGRATION_LOG: clientes.txt no encontrado. Saltando migración de clientes.");
    } else {
        const clientesFileContent = fs.readFileSync(clientesFilePath, 'utf-8');
        const clientNames = clientesFileContent.split(/\r?\n/).filter(name => name.trim() !== '');
        if (clientNames.length > 0) {
            const clientsCollection = database.collection('clients');
            await clientsCollection.deleteMany({});
            const clientDocuments = clientNames.map(name => ({ name: name.trim() }));
            await clientsCollection.insertMany(clientDocuments);
            console.log(`MIGRATION_LOG: Migrados ${clientDocuments.length} clientes.`);
        }
    }

    // --- MIGRACION DE DETALLELOTES (HISTORIAL DE PALLETS) ---
    console.log("MIGRATION_LOG: Ejecutando migración de DetalleLotes...");
    const detallelotesFilePath = path.join(CWD, 'detallelotes.csv');
    if (!fs.existsSync(detallelotesFilePath)) {
        console.warn("MIGRATION_LOG: detallelotes.csv no encontrado. Saltando migración de detallelotes.");
    } else {
        const detallelotesFileContent = fs.readFileSync(detallelotesFilePath, 'utf-8');
        const rows = detallelotesFileContent.split(/\r?\n/).filter(row => row.trim() !== '');

        if (rows.length > 0) {
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
            if (finalPallets.length > 0) {
                const palletsCollection = database.collection('pallets');
                await palletsCollection.deleteMany({});
                await palletsCollection.insertMany(finalPallets);
                console.log(`MIGRATION_LOG: Migrados ${finalPallets.length} pallets únicos de detallelotes.`);
            }
        }
    }

    res.status(200).json({
      success: true,
      message: 'Todas las migraciones se ejecutaron correctamente.',
    });

  } catch (error) {
    console.error('MIGRATION_LOG: ERROR CRITICO EN MIGRACION CONSOLIDADA:', error);
    res.status(500).json({ success: false, message: `Error del servidor durante la migración: ${error.message}` });
  } finally {
    await client.close();
    console.log("MIGRATION_LOG: Conexión a la base de datos cerrada. Fin de la ejecución consolidada.");
  }
}
