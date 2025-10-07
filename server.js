// server.js - Backend para Gerenciamento de Produtos usando MySQL
// Conecta-se a um banco de dados MySQL para persistir os dados.

import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise'; // Usando a versão com Promises

const app = express();
const PORT = 3001;
const API_URL = '/api/products';

// --- Configuração do Banco de Dados MySQL (Aiven.io) ---
// *** ATENÇÃO: Substitua os placeholders abaixo pelas suas credenciais reais. ***
const dbConfig = {
    host: 'mysql-owmrg-owmrg.c.aivencloud.com',          // Ex: 'gestao-produtos-XXXX.aivencloud.com'
    user: 'avnadmin',            // Ex: 'avnadmin'
    password: 'AVNS_88N7NL6MHgklphHPJe0',
    database: 'defaultdb',  // Ex: 'defaultdb'
    port: 25425,                    // Porta fornecida pelo Aiven
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Cria o pool de conexões. O pool é mais eficiente que conexões diretas.
let pool;
try {
    pool = mysql.createPool(dbConfig);
    console.log('[MySQL] Pool de conexões criado com sucesso.');
} catch (error) {
    console.error('[ERRO MySQL] Falha ao criar o pool de conexões:', error.message);
    process.exit(1); // Encerra o servidor se não puder conectar
}

// --- Configuração Middleware ---
app.use(cors());
app.use(express.json());

// --- Rotas CRUD (Create, Read, Update, Delete) ---

/**
 * ROTA GET /api/products
 * Lista todos os produtos do banco de dados.
 */
app.get(API_URL, async (req, res) => {
    try {
        // [0] contém os resultados da query, [1] contém metadados
        const [rows] = await pool.query('SELECT * FROM products');
        
        // Converte os campos TEXT/JSON de volta para arrays JavaScript antes de enviar ao cliente
        const products = rows.map(product => ({
            ...product,
            st_urlimagemextra: product.st_urlimagemextra ? JSON.parse(product.st_urlimagemextra) : [],
            st_urlvideoextra: product.st_urlvideoextra ? JSON.parse(product.st_urlvideoextra) : []
        }));

        console.log(`GET ${API_URL} chamado. Retornando ${products.length} produtos.`);
        res.json(products);
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar produtos.' });
    }
});

/**
 * ROTA POST /api/products
 * Cria um novo produto no banco de dados.
 */
app.post(API_URL, async (req, res) => {
    const newProduct = req.body;

    if (!newProduct.name || newProduct.price === undefined || newProduct.quantity === undefined) {
        return res.status(400).json({ error: 'Nome, preço e quantidade são obrigatórios.' });
    }

    try {
        // Converte arrays para strings JSON para armazenamento no campo TEXT do MySQL
        const imagesJson = newProduct.st_urlimagemextra ? JSON.stringify(newProduct.st_urlimagemextra) : '[]';
        const videosJson = newProduct.st_urlvideoextra ? JSON.stringify(newProduct.st_urlvideoextra) : '[]';

        const sql = `INSERT INTO products (st_produto, st_descricao, st_colecao, nu_custo, nu_preco, nu_quantidade, st_urlimagem, st_urlimagemextra, st_urlvideoextra) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
            newProduct.st_produto,
            newProduct.st_descricao || null,
            newProduct.st_colecao || null,
            newProduct.nu_custo || null,
            newProduct.nu_preco || null,
            newProduct.nu_quantidade || null,
            newProduct.st_urlimagem || null,
            imagesJson,
            videosJson
        ];

        const [result] = await pool.query(sql, values);
        
        // Retorna o produto criado (incluindo o novo ID gerado pelo DB)
        const productToAdd = { ...newProduct, id: result.insertId, st_urlimagemextra: newProduct.st_urlimagemextra || [], st_urlvideoextra: newProduct.st_urlvideoextra || [] };
        console.log('Produto adicionado com ID:', result.insertId);
        res.status(201).json(productToAdd);
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao criar produto.' });
    }
});

/**
 * ROTA PUT /api/products/:id
 * Atualiza um produto existente no banco de dados.
 */
app.put(`${API_URL}/:id`, async (req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    // Converte arrays para strings JSON para armazenamento seguro
    const imagesJson = updatedData.st_urlimagemextra ? JSON.stringify(updatedData.st_urlimagemextra) : null;
    const videosJson = updatedData.st_urlvideoextra ? JSON.stringify(updatedData.st_urlvideoextra) : null;

    try {
        const sql = `UPDATE products SET st_produto = ?, st_descricao = ?, st_colecao = ?, nu_custo = ?, nu_preco = ?, nu_quantidade = ?, st_urlimagem = ?, st_urlimagemextra = ?, st_urlvideoextra = ?
                     WHERE id = ?`;
        
        const values = [
            updatedData.st_produto,
            updatedData.st_descricao || null,
            updatedData.st_colecao,
            updatedData.nu_custo,
            updatedData.nu_preco,
            updatedData.nu_quantidade || null,
            updatedData.st_urlimagem || null,
            imagesJson,
            videosJson,
            id
        ];

        const [result] = await pool.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        console.log('Produto atualizado:', id);
        // Em um ambiente real, você faria um SELECT para buscar o objeto atualizado completo.
        // Para simplificar, retornamos os dados que vieram na requisição.
        res.json({ ...updatedData, id: parseInt(id) });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao atualizar produto.' });
    }
});

/**
 * ROTA DELETE /api/products/:id
 * Remove um produto do banco de dados.
 */
app.delete(`${API_URL}/:id`, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        console.log('Produto removido:', id);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao deletar produto.' });
    }
});

// --- Inicialização do Servidor ---

// Função para testar a conexão antes de iniciar o Express
async function startServer() {
    try {
        // Tentativa de obter uma conexão para testar o DB
        const connection = await pool.getConnection();
        connection.release(); // Libera a conexão imediatamente
        console.log('[MySQL] Conexão com o banco de dados bem-sucedida!');

        app.listen(PORT, () => {
            console.log(`\n\n[API Server] 🚀 Servidor Express rodando em http://localhost:${PORT}`);
            console.log(`A API está pronta para usar o MySQL: ${API_URL}`);
        });

    } catch (error) {
        console.error('\n\n[ERRO FATAL] Não foi possível conectar ao MySQL. Verifique dbConfig em server.js ou as regras de firewall do Aiven.');
        console.error('Detalhes do erro:', error.message);
        process.exit(1);
    }
}

startServer();
