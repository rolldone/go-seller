import 'dotenv/config';
import { patchConsole } from './src/server/logger.mjs';
// Ensure files created by the process are group-writable so members of the group can edit them
process.umask(0o002);
// initialize logging and patch console so all console.* calls are recorded to daily files
patchConsole();
import express from 'express';
// Prevent the built Astro server from auto-starting its own preview server
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler: ssrHandler } = await import('./dist/server/entry.mjs');
// import RedisData from './helper/RedisData.js';

import fs from "fs"; // Get the current process ID 
const pid = process.pid; // Define the file path 
const filePath = 'pid.txt'; // Write the PID to the file 
fs.writeFile(filePath, pid.toString(), (err) => { if (err) throw err; console.log(`PID ${pid} has been written to ${filePath}`); });

// global.redis_data = RedisData

const app = express();
// Change this based on your astro.config.mjs, `base` option.
// They should match. The default value is "/".
const base = '/';
app.use(base, express.static('dist/client/'));
// app.use(base + "geojson", express.static('public/geojson/'));
// app.use(base + "kml_split_ori", express.static('public/kml_split_ori/'));
// app.use(base + "kml_split_result", express.static('public/kml_split_result/'));
app.use(ssrHandler);

const PORT = process.env.PORT || 4322;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
	console.log(`Server listening on http://${HOST}:${PORT}`);
});