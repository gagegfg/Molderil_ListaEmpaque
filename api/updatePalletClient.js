import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const password = req.headers['x-admin-password'];
  if (password !== process.env.SKU_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta.' });
  }

  const { palletNumber, action, clientName } = req.body;
  if (!palletNumber || !action || !clientName) {
    return res.status(400).json({ success: false, message: 'Datos incompletos.' });
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('molderil');
    const palletsCollection = database.collection('pallets');

    const pallet = await palletsCollection.findOne({ palletNumber: parseInt(palletNumber) });
    if (!pallet) {
      return res.status(404).json({ success: false, message: 'Pallet no encontrado.' });
    }

    let currentClients = pallet.customer ? pallet.customer.split('#').filter(Boolean) : [];
    
    if (action === 'ADD') {
      if (!currentClients.includes(clientName)) {
        currentClients.push(clientName);
      }
    } else if (action === 'DELETE') {
      currentClients = currentClients.filter(c => c !== clientName);
    } else {
      return res.status(400).json({ success: false, message: 'Acción no válida.' });
    }

    const newCustomerString = currentClients.join('#');
    const newDespachadoStatus = newCustomerString ? 'TRUE' : 'FALSE';

    await palletsCollection.updateOne(
      { _id: pallet._id },
      { $set: { customer: newCustomerString, despachado: newDespachadoStatus } }
    );

    res.status(200).json({ success: true, message: 'Cliente actualizado.' });

  } catch (error) {
    console.error('Error updating pallet client:', error);
    res.status(500).json({ success: false, message: `Error del servidor: ${error.message}` });
  } finally {
    await client.close();
  }
}
