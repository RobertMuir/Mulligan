import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMulliganerver } from './server.js';

const server = createMulliganerver();
await server.connect(new StdioServerTransport());
