process.env.TS_NODE_TRANSPILE_ONLY = 'true';
require('ts-node/register');
require('./api/server.ts');
