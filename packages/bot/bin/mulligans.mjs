#!/usr/bin/env node
// Runs the TypeScript sources directly until the Phase 7 installer ships a build.
import { register } from 'tsx/esm/api';

register();
await import('../src/terminal/main.ts');
