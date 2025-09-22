import { Octokit } from "@octokit/rest";

// Asegúrate de configurar esta variable de entorno en Vercel
// con tu Personal Access Token de GitHub (con permisos 'repo').
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const USUARIO_GITHUB = 'gagegfg';
const REPO_NOMBRE = 'Molderil_ListaEmpaque';
const RUTA_ARTICULOS_CSV = 'articulos.csv';
const RUTA_CLIENTES_TXT = 'clientes.txt';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ message: 'GitHub Token no configurado en Vercel.' });
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  const { articulosContent, clientesContent, commitMessage = 'Actualización de archivos desde Vercel API' } = req.body;

  if (!articulosContent && !clientesContent) {
    return res.status(400).json({ message: 'Se requiere al menos el contenido de articulos.csv o clientes.txt' });
  }

  try {
    const updateFile = async (filePath, content) => {
      let sha = null;
      try {
        // Intentar obtener el archivo existente para su SHA
        const { data: fileData } = await octokit.repos.getContent({
          owner: USUARIO_GITHUB,
          repo: REPO_NOMBRE,
          path: filePath,
        });
        sha = fileData.sha;
      } catch (error) {
        if (error.status === 404) {
          // El archivo no existe, se creará
          console.log(`${filePath} no encontrado, se creará.`);
        } else {
          throw error; // Otro error al obtener el contenido
        }
      }

      await octokit.repos.createOrUpdateFileContents({
        owner: USUARIO_GITHUB,
        repo: REPO_NOMBRE,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        sha: sha, // Si es null, se creará el archivo; si tiene SHA, se actualizará
      });
      console.log(`Archivo ${filePath} actualizado/creado.`);
    };

    if (articulosContent) {
      await updateFile(RUTA_ARTICULOS_CSV, articulosContent);
    }
    if (clientesContent) {
      await updateFile(RUTA_CLIENTES_TXT, clientesContent);
    }

    res.status(200).json({ message: 'Archivos actualizados correctamente en GitHub.' });

  } catch (error) {
    console.error('Error al actualizar archivos en GitHub:', error);
    res.status(500).json({ message: 'Error al actualizar archivos en GitHub.', error: error.message });
  }
}