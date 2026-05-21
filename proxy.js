export const config = {
  runtime: 'edge'
};

const WORKER_URL = 'https://proxy-embed.nethriondev.workers.dev';

export default async function handler(request) {
  const url = new URL(request.url);
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL);
  
  const clonedRequest = request.clone();
  
  const workerResponse = await fetch(workerUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? clonedRequest.body : undefined
  });
  
  const mirroredHeaders = new Headers(workerResponse.headers);
  
  return new Response(workerResponse.body, {
    status: workerResponse.status,
    statusText: workerResponse.statusText,
    headers: mirroredHeaders
  });
}