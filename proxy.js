export const config = { runtime: 'edge' };

const WORKER_URL = 'https://proxy-embed.nethriondev.workers.dev';

const PROXY_TIMEOUT_MS = 15_000;

export default async function handler(request) {
  const url = new URL(request.url);
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const fetchOptions = {
      method: request.method,
      headers: request.headers,
      signal: controller.signal,
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    const response = await fetch(workerUrl.toString(), fetchOptions);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return new Response('Gateway Timeout: Upstream did not respond in time', {
        status: 504,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('Bad Gateway: Could not reach upstream', {
      status: 502,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
