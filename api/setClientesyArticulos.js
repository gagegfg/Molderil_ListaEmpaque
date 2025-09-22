import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

async function connectToDatabase() {
  if (client) {
    return { client, db: client.db('molderil_db') };
  }
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  client = await clientPromise;
  return { client, db: client.db('molderil_db') };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { articulosContent, clientesContent } = req.body;

  if (!articulosContent && !clientesContent) {
    return res.status(400).json({ message: 'Se requiere al menos el contenido de articulos.csv o clientes.txt' });
  }

  try {
    const { db } = await connectToDatabase();

    // --- Procesar Artículos ---
    if (articulosContent) {
      const articulosCollection = db.collection('articulos');
      // Opcional: Eliminar colección existente para una carga limpia
      await articulosCollection.drop().catch(err => {
        if (err.code !== 26) console.warn("Colección 'articulos' no existía para eliminar."); // 26 = NamespaceNotFound
        else console.error("Error al eliminar colección 'articulos':", err);
      });

      const rows = articulosContent.split('\n').filter(row => row.trim() !== '');
      const parsedArticulos = rows.slice(1).map(row => { // Asumiendo que la primera fila es el encabezado
        const [tipo_articulo, codigo_articulo, descripcionLarga, descripcionCorta] = row.split(';');
        return {
          tipo: tipo_articulo?.trim().toUpperCase(),
          sku: codigo_articulo?.trim(),
          descripcionLarga: descripcionLarga?.trim(),
          descripcionCorta: descripcionCorta?.trim()
        };
      }).filter(art => art.sku && art.descripcionLarga);

      if (parsedArticulos.length > 0) {
        await articulosCollection.insertMany(parsedArticulos);
        console.log(`Insertados ${parsedArticulos.length} artículos en MongoDB.`);
      }
    }

    // --- Procesar Clientes ---
    if (clientesContent) {
      const clientesCollection = db.collection('clientes');
      // Opcional: Eliminar colección existente para una carga limpia
      await clientesCollection.drop().catch(err => {
        if (err.code !== 26) console.warn("Colección 'clientes' no existía para eliminar.");
        else console.error("Error al eliminar colección 'clientes':", err);
      });

      const rows = clientesContent.split('\n').filter(row => row.trim() !== '');
      const parsedClientes = rows.map(name => ({ name: name.trim() }));

      if (parsedClientes.length > 0) {
        await clientesCollection.insertMany(parsedClientes);
        console.log(`Insertados ${parsedClientes.length} clientes en MongoDB.`);
      }
    }

    res.status(200).json({ message: 'Datos de artículos y clientes cargados/actualizados en MongoDB.' });

  } catch (error) {
    console.error('Error al cargar datos a MongoDB:', error);
    res.status(500).json({ message: 'Error al cargar datos a MongoDB.', error: error.message });
  }
}