import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const defaultLevel = process.env.LOG_LEVEL || 'info';

function createDailyRotateTransport({ dirname = logsDir, filename = 'app-%DATE%.log', datePattern = 'YYYY-MM-DD', level = defaultLevel, zippedArchive = false, maxFiles = '30d' } = {}) {
  return new DailyRotateFile({
    dirname,
    filename,
    datePattern,
    level,
    zippedArchive,
    maxFiles,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });
}

const transportConsole = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} ${level}: ${message} ${metaStr}`;
    })
  ),
});

// create initial logger with default daily rotate
const logger = winston.createLogger({
  level: defaultLevel,
  transports: [createDailyRotateTransport()]
});

// By default we do NOT add the Console transport so original console.log output remains
// visible and we avoid duplicate terminal output. Enable console transport only when
// SHOW_LOGGER_CONSOLE env var is set to 'true'.
if (process.env.SHOW_LOGGER_CONSOLE === 'true') {
  logger.add(transportConsole);
}

function configureDailyRotate(options = {}) {
  // remove existing DailyRotateFile transports using logger.remove()
  try {
    // copy array to avoid mutation during iteration
    Array.from(logger.transports).forEach(t => {
      if (t instanceof DailyRotateFile) {
        logger.remove(t);
      }
    });
  } catch (e) {
    // fallback: clear all transports (rare)
    try { logger.clear(); } catch (err) { /* ignore */ }
  }
  // add new transport with options
  const t = createDailyRotateTransport(options);
  logger.add(t);
}

function patchConsole() {
  const origConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
  };

  console.log = (...args) => {
    try { logger.info(formatArgs(args)); } catch (e) { origConsole.error(e); }
    origConsole.log(...args);
  };
  console.info = (...args) => {
    try { logger.info(formatArgs(args)); } catch (e) { origConsole.error(e); }
    origConsole.info(...args);
  };
  console.warn = (...args) => {
    try { logger.warn(formatArgs(args)); } catch (e) { origConsole.error(e); }
    origConsole.warn(...args);
  };
  console.error = (...args) => {
    try { logger.error(formatArgs(args)); } catch (e) { origConsole.error(e); }
    origConsole.error(...args);
  };
  console.debug = (...args) => {
    try { logger.debug(formatArgs(args)); } catch (e) { origConsole.error(e); }
    origConsole.debug(...args);
  };
}

function formatArgs(args) {
  return args.map(a => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }).join(' ');
}

export { logger, patchConsole, configureDailyRotate };