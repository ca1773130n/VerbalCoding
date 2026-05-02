#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createVerbalCodingMcpTools, toolResultContent } from '../app-node/mcp_tools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { toolDefs, tools } = createVerbalCodingMcpTools({ root: ROOT });

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  let idx;
  while ((idx = input.indexOf('\n')) >= 0) {
    const line = input.slice(0, idx).trim();
    input = input.slice(idx + 1);
    if (line) void handleLine(line);
  }
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (e) {
    sendError(null, -32700, 'Parse error');
    return;
  }
  const { id, method, params = {} } = request;
  try {
    if (method === 'initialize') {
      sendResult(id, {
        protocolVersion: params.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'verbalcoding', version: '0.1.0' },
      });
      return;
    }
    if (method === 'notifications/initialized') return;
    if (method === 'ping') {
      sendResult(id, {});
      return;
    }
    if (method === 'tools/list') {
      sendResult(id, {
        tools: toolDefs.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
      return;
    }
    if (method === 'tools/call') {
      const name = params.name;
      const tool = tools.get(name);
      if (!tool) {
        sendError(id, -32602, `Unknown tool: ${name}`);
        return;
      }
      try {
        const result = await tool.handler(params.arguments || {});
        sendResult(id, { content: toolResultContent(result), isError: false });
      } catch (e) {
        sendResult(id, { content: toolResultContent({ error: String(e?.message || e) }), isError: true });
      }
      return;
    }
    sendError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    sendError(id, -32603, String(e?.message || e));
  }
}
