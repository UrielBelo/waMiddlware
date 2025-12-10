"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_1 = __importDefault(require("whatsapp"));
const axios_1 = __importDefault(require("axios"));
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const node_cache_1 = __importDefault(require("node-cache"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const endpointsFilePath = path_1.default.join(__dirname, 'endpoints.json');
const cache = new node_cache_1.default({ stdTTL: 600 }); // Cache por 10 minutos
const client = new whatsapp_1.default(0);
const server = (0, fastify_1.default)({});
async function getReplicationEndpoints(id) {
    const cacheKey = `endpoints_${id}`;
    let endpoints = cache.get(cacheKey);
    if (!endpoints) {
        try {
            const data = await fs_1.promises.readFile(endpointsFilePath, 'utf-8');
            const allEndpoints = JSON.parse(data);
            endpoints = allEndpoints.filter(x => x.id === id);
            cache.set(cacheKey, endpoints);
        }
        catch (error) {
            console.error('Erro ao ler o arquivo de endpoints:', error);
            return []; // Retorna vazio se houver erro na leitura
        }
    }
    return endpoints;
}
async function webHooksCallback(_statusCode, _headers, body, response, _error) {
    if (response && body?.entry?.[0]?.id) {
        const hosts = await getReplicationEndpoints(body.entry[0].id);
        const replicationPromises = hosts.map(host => {
            const headers = { ..._headers };
            delete headers.host;
            delete headers["content-length"];
            delete headers["content-type"];
            return axios_1.default.post(host.host, body, { headers })
                .catch(err => {
                console.error(`Erro ao completar requisição para o host ${host.host}:`, err.message);
            });
        });
        await Promise.all(replicationPromises);
    }
}
// --- API Endpoints ---
server.post('/endpoints', async (request, reply) => {
    const newEndpoint = request.body;
    if (!newEndpoint || !newEndpoint.host || !newEndpoint.id) {
        return reply.status(400).send({ error: 'Payload inválido. Forneça host e id.' });
    }
    const data = await fs_1.promises.readFile(endpointsFilePath, 'utf-8');
    const endpoints = JSON.parse(data);
    endpoints.push(newEndpoint);
    await fs_1.promises.writeFile(endpointsFilePath, JSON.stringify(endpoints, null, 2));
    cache.flushAll(); // Invalida todo o cache para forçar a releitura
    reply.status(201).send(newEndpoint);
});
server.delete('/endpoints', async (request, reply) => {
    const { host } = request.body;
    if (!host) {
        return reply.status(400).send({ error: 'Payload inválido. Forneça o host a ser removido.' });
    }
    const data = await fs_1.promises.readFile(endpointsFilePath, 'utf-8');
    let endpoints = JSON.parse(data);
    const initialLength = endpoints.length;
    endpoints = endpoints.filter(ep => ep.host !== host);
    if (endpoints.length === initialLength) {
        return reply.status(404).send({ message: 'Endpoint não encontrado.' });
    }
    await fs_1.promises.writeFile(endpointsFilePath, JSON.stringify(endpoints, null, 2));
    cache.flushAll(); // Invalida todo o cache para forçar a releitura
    reply.status(200).send({ message: 'Endpoint removido com sucesso.' });
});
const start = async () => {
    try {
        client.webhooks.start(webHooksCallback);
        await server.listen({ port: 3000 });
        console.log('Servidor rodando na porta 3000');
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
