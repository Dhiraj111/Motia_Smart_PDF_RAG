import { ApiRouteConfig, Handlers } from 'motia';
import fs from 'fs-extra';
import path from 'path';

export const config: ApiRouteConfig = {
  name: 'ServeFrontend',
  type: 'api',
  path: '/app',
  method: 'GET',
  emits: [],
};

export const handler: Handlers['ServeFrontend'] = async () => {
  const htmlPath = path.join(process.cwd(), 'public', 'index.html');
  const html = await fs.readFile(htmlPath, 'utf-8');
  return {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: html, // Motia handles string body as generic response
  };
};