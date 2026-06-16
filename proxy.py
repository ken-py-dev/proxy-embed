import requests
from flask import Flask, request, Response
import urllib.parse

app = Flask(__name__)
WORKER_URL = 'https://proxy-embed.nethriondev.workers.dev'

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def handler(path):
    try:
        target_url = urllib.parse.urljoin(WORKER_URL, request.full_path)
        
        headers = dict(request.headers)
        headers.pop('Host', None)
        
        method = request.method
        fetch_options = {
            'method': method,
            'headers': headers,
            'allow_redirects': True
        }
        
        if method not in ['GET', 'HEAD']:
            fetch_options['data'] = request.get_data()
        
        response = requests.request(
            method=method,
            url=target_url,
            headers=headers,
            data=request.get_data() if method not in ['GET', 'HEAD'] else None,
            allow_redirects=True
        )
        
        response_headers = dict(response.headers)
        response_headers['Access-Control-Allow-Origin'] = '*'
        response_headers['Access-Control-Expose-Headers'] = '*'
        
        return Response(
            response.content,
            status=response.status_code,
            headers=response_headers
        )
        
    except Exception as error:
        return Response(
            'Bad Gateway: Could not reach upstream',
            status=502,
            headers={
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
            }
        )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)