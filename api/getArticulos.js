
import { MongoClient } from 'mongodb';

// Handler principal de la función serverless
export default async function handler(req, res) {
  // Solo permitir peticiones GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Obtener la URI de conexión desde las variables de entorno
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return res.status(500).json({ success: false, message: 'Error del servidor: La URI de MongoDB no está configurada.' });
  }

  const client = new MongoClient(uri);

  try {
    // Conectar al cliente
    await client.connect();
    const database = client.db('test'); // O el nombre de tu base de datos si es diferente
    const articulosCollection = database.collection('articulos');

    // Buscar todos los artículos y ordenarlos por 'sku'
    const articulos = await articulosCollection.find({}).sort({ sku: 1 }).toArray();

    // Enviar la respuesta con los artículos encontrados
    res.status(200).json({ success: true, articulos: articulos });

  } catch (error) {
    console.error('Error al conectar o consultar la base de datos:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al consultar los artículos.' });
  } finally {
    // Asegurarse de que el cliente se cierre al finalizar
    await client.close();
  }
}
