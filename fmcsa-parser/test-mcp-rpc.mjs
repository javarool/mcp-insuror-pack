import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Запускаем MCP сервер
const serverPath = join(__dirname, 'dist', 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // Попробуем парсить ответы (разделённые переносом строки)
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || ''; // Сохраняем неполную строку
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  });
});

function sendRequest(request) {
  return new Promise((resolve) => {
    console.log('\nSending:', JSON.stringify(request, null, 2));
    server.stdin.write(JSON.stringify(request) + '\n');
    setTimeout(resolve, 1000); // Даём время на ответ
  });
}

async function test() {
  try {
    // 1. Initialize
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true }
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    });

    // 2. Initialized notification
    await sendRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });

    // 3. List tools
    await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    // Даём время на получение всех ответов
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('Error:', error);
    server.kill();
    process.exit(1);
  }
}

test();

