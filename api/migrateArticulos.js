
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch'; // Necesitamos fetch en el entorno de Node.js

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// URL directa a tu archivo CSV en GitHub
const CSV_URL = 'https://raw.githubusercontent.com/gagegfg/Molderil_ListaEmpaque/main/articulos.csv';

async function connectToDatabase() {
  if (client.topology && client.topology.isConnected()) {
    return client.db("molderil_db");
  }
  await client.connect();
  return client.db("molderil_db");
}

export default async function handler(req, res) {
  try {
    const db = await connectToDatabase();
    const articulosCollection = db.collection('articulos');

    // 1. Opcional pero recomendado: Borrar datos existentes para evitar duplicados
    await articulosCollection.deleteMany({});

    // 2. Obtener el contenido del archivo CSV desde GitHub
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo CSV: ${response.statusText}`);
    }
    const csvText = await response.text();

    // 3. Procesar el CSV
    const rows = csvText.split('\n').slice(1); // Omitir la fila de cabecera
    const articulosParaInsertar = rows.map(row => {
      const [tipo_articulo, codigo_articulo, descripcionLarga, descripcionCorta] = row.split(';');
      
      // Ignorar filas vacías o mal formadas
      if (!codigo_articulo) return null;

      return {
        tipo: tipo_articulo?.trim().toUpperCase() || '',
        sku: codigo_articulo?.trim() || '',
        descripcionLarga: descripcionLarga?.trim() || '',
        descripcionCorta: descripcionCorta?.trim() || ''
      };
    }).filter(Boolean); // Filtrar cualquier entrada nula

    if (articulosParaInsertar.length === 0) {
      return res.status(400).json({ success: false, message: 'No se encontraron artículos para migrar en el CSV.' });
    }

    // 4. Insertar todos los artículos en la base de datos
    const result = await articulosCollection.insertMany(articulosParaInsertar);

    res.status(200).json({ 
      success: true, 
      message: `Migración completada. Se insertaron ${result.insertedCount} artículos.` 
    });

  } catch (error) {
    console.error('Error durante la migración:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}
