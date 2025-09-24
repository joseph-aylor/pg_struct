const { Client } = require('pg');

/**
 * Connect to PostgreSQL database using connection string
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Promise<Object>} PostgreSQL client
 */
async function connect(connectionString) {
  let clientConfig;

  try {
    // Try to use the connection string directly
    clientConfig = { connectionString };

    // Validate connection string format
    if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
      console.warn('Warning: Connection string should start with postgres:// or postgresql://');
      // If it doesn't have the right prefix, try to fix it
      if (connectionString.includes('@') && connectionString.includes('/')) {
        connectionString = 'postgresql://' + connectionString.split('@').join('@');
        clientConfig = { connectionString };
      }
    }
  } catch (err) {
    // If there's a parsing error, try to build the config manually
    console.error('Error parsing connection string, trying alternative method:', err.message);

    try {
      // Parse the connection string manually if needed
      // Example format: postgres://username:password@localhost:5432/database
      const parts = connectionString.match(/^(?:postgres|postgresql):\/\/(?:([^:]+)(?::([^@]+))?@)?([^:\/]+)(?::(\d+))?\/(.+)$/);

      if (parts) {
        const [, user, password, host, port, database] = parts;
        clientConfig = {
          user,
          password,
          host,
          port: port || '5432',
          database,
        };
      } else {
        // If we can't parse it, just use the string and let pg handle it
        clientConfig = { connectionString };
      }
    } catch (err) {
      console.error('Failed to parse connection string manually');
      clientConfig = { connectionString };
    }
  }

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    return client;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL database:', error.message);
    throw error;
  }
}

module.exports = {
  connect,
};