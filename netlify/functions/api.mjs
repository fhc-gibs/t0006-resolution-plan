// Netlify Function: stores form responses in Netlify Blobs (built into Netlify, no outside database).
import { getStore } from '@netlify/blobs';
import { makeHandler } from '../lib/handler.mjs';

const handler = makeHandler(() => getStore({ name: 't0006-feedback', consistency: 'strong' }));

export default async (req) => {
  try { return await handler(req); }
  catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};

export const config = { path: '/api' };
