// Optional standalone Express + Next server for Node/container hosting.
import next from 'next';
import app from './app.mjs';
import { pool } from './db.mjs';
const port = Number(process.env.PORT || 3000);
const web = next({ dev: process.env.NODE_ENV !== 'production', hostname: '0.0.0.0', port });
await web.prepare();
app.use((req, res) => web.getRequestHandler()(req, res));
const server = app.listen(port, '0.0.0.0', () => console.log(`Money tracker ready on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); pool?.end(); process.exit(0); });
