// This file connects our app to MongoDB

const mongoose = require('mongoose');

const RECONNECT_INTERVAL_MS = Number(process.env.MONGODB_RECONNECT_INTERVAL_MS || 5000);
let reconnectTimer = null;
let isConnecting = false;

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectDB();
  }, RECONNECT_INTERVAL_MS);

  // Do not keep Node alive only for reconnect timer.
  if (typeof reconnectTimer.unref === 'function') {
    reconnectTimer.unref();
  }
}

async function connectDB() {
  if (isDatabaseConnected() || isConnecting) {
    return isDatabaseConnected();
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Backend will run without database until this is set.');
    scheduleReconnect();
    return false;
  }

  isConnecting = true;
  try {
    // Connect to MongoDB using the URL from our .env file
    await mongoose.connect(process.env.MONGODB_URI);
    return true;
  } catch (error) {
    console.error('Could not connect to MongoDB:', error.message);
    console.warn(`Retrying MongoDB connection in ${RECONNECT_INTERVAL_MS}ms...`);
    scheduleReconnect();
    return false;
  } finally {
    isConnecting = false;
  }
}

mongoose.connection.on('connected', () => {
  const { host, port, name } = mongoose.connection;
  const location = host ? `${host}:${port}/${name}` : name || 'unknown';
  console.log(`MongoDB connected: ${location}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected.');
  scheduleReconnect();
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message);
});

module.exports = { connectDB, isDatabaseConnected };
