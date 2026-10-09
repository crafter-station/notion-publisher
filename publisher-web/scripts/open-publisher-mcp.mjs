#!/usr/bin/env node
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {connectionOptions} from './open-publisher-client.mjs';
// Forward the hosted catalog and handlers, avoiding drift between desktop clients
// and the web MCP's authorization, tool descriptions and request schemas.
const {base,headers}=connectionOptions();
const remote=new Client({name:'open-publisher-stdio',version:'0.3.0'});
const server=new Server({name:'open-publisher',version:'0.3.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,request=>remote.listTools(request.params));
server.setRequestHandler(CallToolRequestSchema,request=>remote.callTool(request.params));
try {
 await remote.connect(new StreamableHTTPClientTransport(new URL('/api/v1/mcp',base),{requestInit:{headers,redirect:'error'}}));
 await server.connect(new StdioServerTransport());
 server.onclose=()=>{void remote.close()};
} catch {
 console.error('Could not connect to Open Publisher MCP. Check the URL, application token and, for private Sites, OPEN_PUBLISHER_SITES_TOKEN.');
 await remote.close();
 process.exitCode=1;
}
