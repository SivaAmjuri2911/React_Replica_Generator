/**
 * Public URL for this API (no trailing slash). Render sets RENDER_EXTERNAL_URL;
 * override with PUBLIC_API_BASE_URL when using a custom domain or split frontend.
 */
export function getPublicApiBaseUrl() {
    const configured = process.env.PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '');
    if (configured) {
        return configured;
    }
    const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, '');
    if (renderUrl) {
        return renderUrl;
    }
    return undefined;
}

/** True when the API is reachable on a public host (deployed), not just localhost. */
export function isDeployedApi() {
    return getPublicApiBaseUrl() !== undefined;
}

/**
 * @param {string} slug
 */
export function buildDevPreviewPublicPath(slug) {
    return `/api/analysis-sessions/${encodeURIComponent(slug)}/dev-preview`;
}

/**
 * @param {string} slug
 */
export function buildDevPreviewPublicUrl(slug) {
    const base = getPublicApiBaseUrl();
    if (!base) {
        return undefined;
    }
    return `${base}${buildDevPreviewPublicPath(slug)}/`;
}
