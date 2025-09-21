const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Esta función se asegura de que estemos conectados a la BD
async function connectToDatabase() {
  if (client.topology && client.topology.isConnected()) {
    return client.db("molderil_db");
  }
  await client.connect();
  return client.db("molderil_db");
}

export default async function handler(req, res) {
  // Esta función solo acepta peticiones de tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const session = client.startSession();

  try {
    // Iniciamos una transacción
    await session.withTransaction(async () => {
      const db = await connectToDatabase();
      const palletsCollection = db.collection('pallets');
      const countersCollection = db.collection('counters');

      const palletData = req.body;

      // 1. Validar que el número de pallet no haya sido usado mientras tanto
      const currentCounter = await countersCollection.findOne({ _id: 'pallet_counter' }, { session });
      if (!currentCounter || palletData.palletId <= currentCounter.seq) {
        // Si el pallet ya fue usado, abortamos la transacción
        throw new Error(`Conflicto: El pallet ${palletData.palletId} ya fue procesado. El último número es ${currentCounter.seq}.`);
      }

      // 2. Insertar los datos del nuevo pallet en la colección 'pallets'
      // Esto reemplaza a detallelotes.csv
      await palletsCollection.insertOne({ 
        ...palletData,
        createdAt: new Date()
      }, { session });

      // 3. Actualizar el contador de pallets al nuevo número
      // Esto reemplaza a lotelogistica.txt
      await countersCollection.updateOne(
        { _id: 'pallet_counter' },
        { $set: { seq: palletData.palletId } },
        { session }
      );
    });

    // Si la transacción fue exitosa, enviamos la respuesta
    res.status(200).json({ success: true, message: 'Pallet guardado correctamente' });

  } catch (error) {
    console.error('Error en la transacción:', error);
    res.status(409).json({ success: false, message: error.message }); // 409 Conflict
  } finally {
    // Cerramos la sesión de la transacción
    await session.endSession();
  }
}