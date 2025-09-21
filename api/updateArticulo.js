
import { MongoClient, ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id, sku, descripcion, cliente, nota, psw } = req.body;

  // --- Validación de Seguridad ---
  const serverPassword = process.env.SKU_PASSWORD;
  if (!serverPassword) {
      return res.status(500).json({ success: false, message: 'Error del servidor: La contraseña no está configurada.' });
  }
  if (psw !== serverPassword) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta.' });
  }
  // --- Fin Validación de Seguridad ---

  if (!id || !sku) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos (ID, SKU).' });
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return res.status(500).json({ success: false, message: 'Error del servidor: La URI de MongoDB no está configurada.' });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('test');
    const articulosCollection = database.collection('articulos');

    // El ID viene como string, hay que convertirlo a ObjectId de MongoDB
    const objectId = new ObjectId(id);

    const result = await articulosCollection.updateOne(
      { _id: objectId },
      {
        $set: {
          sku: sku,
          descripcion: descripcion,
          cliente: cliente,
          nota: nota
        }
      }
    );

    if (result.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'No se encontró ningún artículo con ese ID.' });
    }

    res.status(200).json({ success: true, message: 'Artículo actualizado correctamente.' });

  } catch (error) {
    console.error('Error al actualizar el artículo:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar el artículo.' });
  } finally {
    await client.close();
  }
}
