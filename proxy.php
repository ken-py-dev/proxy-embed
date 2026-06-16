<?php

const WORKER_URL = 'https://proxy-embed.nethriondev.workers.dev';

function handler($request) {
    try {
        $url = parse_url($request->getRequestTarget());
        $path = $url['path'] ?? '/';
        $query = isset($url['query']) ? '?' . $url['query'] : '';
        
        $targetUrl = WORKER_URL . $path . $query;
        
        $headers = [];
        foreach ($request->getHeaders() as $name => $values) {
            $headers[$name] = implode(', ', $values);
        }
        
        $fetchOptions = [
            'method' => $request->getMethod(),
            'headers' => $headers,
        ];
        
        $method = $request->getMethod();
        if ($method !== 'GET' && $method !== 'HEAD') {
            $fetchOptions['body'] = $request->getBody()->getContents();
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $targetUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_map(
            fn($key, $value) => "$key: $value",
            array_keys($headers),
            $headers
        ));
        
        if (isset($fetchOptions['body'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $fetchOptions['body']);
        }
        
        $responseBody = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $responseHeaders = curl_getinfo($ch, CURLINFO_HEADER_OUT);
        curl_close($ch);
        
        $responseHeaders = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Expose-Headers' => '*',
        ];
        
        return new Response($responseBody, $statusCode, $responseHeaders);
        
    } catch (Exception $error) {
        return new Response(
            'Bad Gateway: Could not reach upstream',
            502,
            [
                'Content-Type' => 'text/plain',
                'Access-Control-Allow-Origin' => '*'
            ]
        );
    }
}

class Response {
    private $body;
    private $status;
    private $headers;
    
    public function __construct($body, $status = 200, $headers = []) {
        $this->body = $body;
        $this->status = $status;
        $this->headers = $headers;
    }
    
    public function send() {
        http_response_code($this->status);
        foreach ($this->headers as $key => $value) {
            header("$key: $value");
        }
        echo $this->body;
    }
}

class Request {
    public function getMethod() {
        return $_SERVER['REQUEST_METHOD'];
    }
    
    public function getRequestTarget() {
        return $_SERVER['REQUEST_URI'];
    }
    
    public function getHeaders() {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $name = str_replace('_', '-', substr($key, 5));
                $headers[$name] = $value;
            }
        }
        return $headers;
    }
    
    public function getBody() {
        return file_get_contents('php://input');
    }
}

$request = new Request();
$response = handler($request);
$response->send();

?>