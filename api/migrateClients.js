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
    const clientsCollection = database.collection('clients');

    const filePath = path.join(process.cwd(), 'clientes.txt');
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const clientNames = fileContent.split(/\r?\n/).filter(name => name.trim() !== '');

    if (clientNames.length === 0) {
      return res.status(200).json({ success: true, message: 'No hay clientes para migrar.' });
    }

    await clientsCollection.deleteMany({});

    const clientDocuments = clientNames.map(name => ({ name: name.trim() }));

    const result = await clientsCollection.insertMany(clientDocuments);

    res.status(200).json({
      success: true,
      message: `Migración de clientes completada. Se insertaron ${result.insertedCount} clientes.`,
    });
  } catch (error) {
    console.error('Error en la migración de clientes:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
