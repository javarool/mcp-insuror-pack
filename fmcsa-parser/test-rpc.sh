#!/bin/bash

# Тестируем MCP сервер через JSON-RPC запросы

echo "=== Test 1: Initialize ==="
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }
}' | node /home/vadim/WORK_DIR/McpServers/mcp-insuror-pack/fmcsa-parser/dist/index.js

echo -e "\n=== Test 2: List Tools ==="
echo '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}' | node /home/vadim/WORK_DIR/McpServers/mcp-insuror-pack/fmcsa-parser/dist/index.js

echo -e "\n=== Test 3: Call getCompany Tool ==="
echo '{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "getCompany",
    "arguments": {
      "number": "1234567"
    }
  }
}' | node /home/vadim/WORK_DIR/McpServers/mcp-insuror-pack/fmcsa-parser/dist/index.js

