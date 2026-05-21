export const config = {
  runtime: 'edge'
};

const WORKER_URL = 'https://proxy-embed.nethriondev.workers.dev';

export default async function handler(request) {
  const url = new URL(request.url);
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL);
  
  const response = await fetch(workerUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  return response;
}