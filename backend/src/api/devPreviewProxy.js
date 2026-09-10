import httpProxy from 'http-proxy';
import { getDevServerForSlug } from './devServerRegistry.js';
import { buildDevPreviewPublicPath } from './publicApiBaseUrl.js';

const proxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
    xfwd: true,
});

proxy.on('error', (error, request, response) => {
    if (response && 'writeHead' in response && !response.headersSent) {
        response.writeHead(502, { 'Content-Type': 'text/plain' });
        response.end(`Dev preview proxy error: ${error.message}`);
        return;
    }
    request.socket?.destroy();
});

/**
 * @param {import('http').IncomingMessage} request
 * @param {string} slug
 */
function rewriteDevPreviewRequestUrl(request, slug) {
    const prefix = `${buildDevPreviewPublicPath(slug)}/`;
    const originalUrl = request.url ?? '/';
    if (originalUrl.startsWith(prefix)) {
        const rewritten = originalUrl.slice(prefix.length - 1);
        request.url = rewritten.length > 0 ? rewritten : '/';
        return;
    }
    const exactPrefix = buildDevPreviewPublicPath(slug);
    if (originalUrl === exactPrefix || originalUrl.startsWith(`${exactPrefix}?`)) {
        request.url = '/';
    }
}

/**
 * @param {import('express').Express} app
 * @param {import('http').Server} server
 */
export function attachDevPreviewProxy(app, server) {
    const handleProxy = (request, response) => {
        const slug = request.params.slug;
        const entry = getDevServerForSlug(slug);
        if (!entry) {
            response.status(404).send('No dev preview is running for this project. Click Run dev first.');
            return;
        }
        rewriteDevPreviewRequestUrl(request, slug);
        proxy.web(request, response, { target: entry.internalOrigin }, (error) => {
            if (!response.headersSent) {
                response.status(502).send(error.message);
            }
        });
    };

    app.get('/api/analysis-sessions/:slug/dev-preview', handleProxy);
    app.get('/api/analysis-sessions/:slug/dev-preview/*', handleProxy);
    app.post('/api/analysis-sessions/:slug/dev-preview', handleProxy);
    app.post('/api/analysis-sessions/:slug/dev-preview/*', handleProxy);
    app.put('/api/analysis-sessions/:slug/dev-preview', handleProxy);
    app.put('/api/analysis-sessions/:slug/dev-preview/*', handleProxy);
    app.patch('/api/analysis-sessions/:slug/dev-preview', handleProxy);
    app.patch('/api/analysis-sessions/:slug/dev-preview/*', handleProxy);
    app.delete('/api/analysis-sessions/:slug/dev-preview', handleProxy);
    app.delete('/api/analysis-sessions/:slug/dev-preview/*', handleProxy);

    server.on('upgrade', (request, socket, head) => {
        const match = /^\/api\/analysis-sessions\/([^/]+)\/dev-preview(\/.*)?$/.exec(request.url ?? '');
        if (!match) {
            return;
        }
        const slug = decodeURIComponent(match[1]);
        const entry = getDevServerForSlug(slug);
        if (!entry) {
            socket.destroy();
            return;
        }
        rewriteDevPreviewRequestUrl(request, slug);
        proxy.ws(request, socket, head, { target: entry.internalOrigin });
    });
}
