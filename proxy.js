export const runtime = 'edge';
export const preferredRegion = ['hnd1', 'nrt1', 'kix1', 'sin1', 'icn1', 'hkg1', 'tpe1'];

const WORKER_URL = 'https://proxy-embed.nethriondev.workers.dev';

export default async function handler(request) {
  const url = new URL(request.url);
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL);

  try {
    const fetchOptions = {
      method: request.method,
      headers: request.headers,
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
    return new Response('Bad Gateway: Could not reach upstream', {
      status: 502,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}