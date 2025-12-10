import WhatsApp from "whatsapp";
import { IncomingHttpHeaders, ServerResponse } from 'http';
import { WebhookObject } from 'whatsapp/build/types/webhooks';
import axios from 'axios';
import 'dotenv/config';
import fastify, { FastifyInstance } from 'fastify';
import NodeCache from 'node-cache';
import { promises as fs } from 'fs';
import path from 'path';

interface ReplicationEndpoint {
    host: string;
    id: string;
}

const endpointsFilePath = path.join(__dirname, 'endpoints.json');
const cache = new NodeCache({ stdTTL: 600 }); // Cache por 10 minutos

const client = new WhatsApp(0)
const server: FastifyInstance = fastify({});

async function getReplicationEndpoints(id: string): Promise<ReplicationEndpoint[]> {
    const cacheKey = `endpoints_${id}`;
    let endpoints = cache.get<ReplicationEndpoint[]>(cacheKey);

    if (!endpoints) {
        try {
            const data = await fs.readFile(endpointsFilePath, 'utf-8');
            const allEndpoints: ReplicationEndpoint[] = JSON.parse(data);
            endpoints = allEndpoints.filter(x => x.id === id);
            cache.set(cacheKey, endpoints);
        } catch (error) {
            console.error('Erro ao ler o arquivo de endpoints:', error);
            return []; // Retorna vazio se houver erro na leitura
        }
    }
    return endpoints;
}

async function webHooksCallback(
    _statusCode: number,
    _headers: IncomingHttpHeaders,
    body?: WebhookObject,
    response?: ServerResponse,
    _error?: Error
) {
    if (response && body?.entry?.[0]?.id) {
        const hosts = await getReplicationEndpoints(body.entry[0].id);
        const replicationPromises = hosts.map(host => {
            const headers = { ..._headers };
            delete headers.host;
            delete headers["content-length"];
            delete headers["content-type"];

            return axios.post(host.host, body, { headers })
                .catch(err => {
                    console.error(`Erro ao completar requisição para o host ${host.host}:`, err.message);
                });
        });
        await Promise.all(replicationPromises);
    }
}

// --- API Endpoints ---

server.post<{ Body: ReplicationEndpoint }>('/endpoints', async (request, reply) => {
    const newEndpoint = request.body;
    if (!newEndpoint || !newEndpoint.host || !newEndpoint.id) {
        return reply.status(400).send({ error: 'Payload inválido. Forneça host e id.' });
    }

    const data = await fs.readFile(endpointsFilePath, 'utf-8');
    const endpoints: ReplicationEndpoint[] = JSON.parse(data);

    endpoints.push(newEndpoint);
    await fs.writeFile(endpointsFilePath, JSON.stringify(endpoints, null, 2));

    cache.flushAll(); // Invalida todo o cache para forçar a releitura
    reply.status(201).send(newEndpoint);
});

server.delete<{ Body: { host: string } }>('/endpoints', async (request, reply) => {
    const { host } = request.body;
    if (!host) {
        return reply.status(400).send({ error: 'Payload inválido. Forneça o host a ser removido.' });
    }

    const data = await fs.readFile(endpointsFilePath, 'utf-8');
    let endpoints: ReplicationEndpoint[] = JSON.parse(data);

    const initialLength = endpoints.length;
    endpoints = endpoints.filter(ep => ep.host !== host);

    if (endpoints.length === initialLength) {
        return reply.status(404).send({ message: 'Endpoint não encontrado.' });
    }

    await fs.writeFile(endpointsFilePath, JSON.stringify(endpoints, null, 2));

    cache.flushAll(); // Invalida todo o cache para forçar a releitura
    reply.status(200).send({ message: 'Endpoint removido com sucesso.' });
});

const start = async () => {
    try {
        client.webhooks.start(webHooksCallback);
        await server.listen({ port: 3000 });
        console.log('Servidor rodando na porta 3000');
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
