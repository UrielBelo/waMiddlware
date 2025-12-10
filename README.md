# WhatsApp Webhook Replication Middleware

Este projeto é um middleware Node.js construído com Fastify que atua como um ponto central para receber webhooks do WhatsApp e replicá-los dinamicamente para múltiplos endpoints configuráveis. Ele oferece uma API RESTful para gerenciar esses endpoints de replicação, armazenando-os em um arquivo JSON e utilizando cache para otimizar o desempenho.

## Funcionalidades

-   **Recepção de Webhooks**: Recebe e processa webhooks do WhatsApp.
-   **Replicação Dinâmica**: Encaminha os webhooks recebidos para uma lista de endpoints de replicação configuráveis.
-   **API de Gerenciamento**: Fornece endpoints RESTful (`/endpoints`) para adicionar e remover destinos de replicação.
-   **Persistência**: Os endpoints de replicação são armazenados em um arquivo `endpoints.json`.
-   **Performance Otimizada**: Utiliza `node-cache` para armazenar em cache os endpoints, reduzindo a necessidade de leitura do disco a cada webhook.

## Pré-requisitos

-   Node.js (versão 14 ou superior recomendada)
-   npm ou Yarn

## Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/UrielBelo/waMiddlware.git
    cd wamiddleware
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    ```

## Configuração

1.  **`endpoints.json`**:
    Crie um arquivo `endpoints.json` na raiz do projeto (ou no diretório `dist` após a compilação) com a seguinte estrutura inicial:
    ```json
    []
    ```
    Este arquivo será usado para persistir os endpoints de replicação.

2.  **Variáveis de Ambiente**:
    O projeto utiliza `dotenv/config`, o que sugere que pode haver variáveis de ambiente. Embora não explicitamente configuradas no `main.ts` para este middleware, a biblioteca `whatsapp` pode requerer algumas (ex: tokens, IDs de aplicativo, etc.). Certifique-se de configurar qualquer variável de ambiente necessária em um arquivo `.env` na raiz do projeto.

## Uso

1.  **Iniciar o Servidor**:
    ```bash
    npm start
    # ou
    yarn start
    ```
    O servidor Fastify será iniciado na porta `3000` e o middleware de webhook do WhatsApp começará a escutar.

2.  **Gerenciar Endpoints de Replicação via API**:

    *   **Adicionar um Endpoint**:
        Envie uma requisição `POST` para `http://localhost:3000/endpoints` com o `host` (URL do webhook de destino) e o `id` (ID da entrada do webhook do WhatsApp, e.g., `body.entry[0].id`).

        ```bash
        curl -X POST -H "Content-Type: application/json" \
             -d '{"host": "https://seu-webhook-destino.com/api/webhook", "id": "SEU_ID_DO_WHATSAPP"}' \
             http://localhost:3000/endpoints
        ```

    *   **Remover um Endpoint**:
        Envie uma requisição `DELETE` para `http://localhost:3000/endpoints` com o `host` do endpoint a ser removido.

        ```bash
        curl -X DELETE -H "Content-Type: application/json" \
             -d '{"host": "https://seu-webhook-destino.com/api/webhook"}' \
             http://localhost:3000/endpoints
        ```

3.  **Fluxo de Webhook**:
    Quando um webhook do WhatsApp é recebido pelo middleware, ele:
    1.  Identifica o `id` da entrada do webhook.
    2.  Consulta os endpoints de replicação configurados para aquele `id` (utilizando cache).
    3.  Replicará o webhook original para todos os `hosts` correspondentes encontrados, em paralelo.
    4.  Erros na replicação para hosts individuais serão logados, mas não impedirão a replicação para outros hosts.

## Contribuindo

Sinta-se à vontade para abrir issues ou enviar pull requests.