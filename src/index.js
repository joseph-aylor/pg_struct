#!/usr/bin/env node

const { program } = require('commander');
const { connect } = require('./db');
const { extractStructure } = require('./extractor');

program
  .version('1.0.0')
  .description('Extract PostgreSQL database structure as JSON')
  .requiredOption('-c, --connection <string>', 'PostgreSQL connection string')
  .option('-o, --output <file>', 'Output file (defaults to stdout)')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    // Connect to the database
    const client = await connect(options.connection);

    // Extract the structure
    const structure = await extractStructure(client);

    // Output the result
    if (options.output) {
      const fs = require('fs');
      fs.writeFileSync(options.output, JSON.stringify(structure, null, 2));
      console.log(`Structure written to ${options.output}`);
    } else {
      console.log(JSON.stringify(structure, null, 2));
    }

    // Close the connection
    await client.end();
  } catch (error) {
    if (error.message.includes('searchParams')) {
      console.error('Error: Invalid connection string format. Please provide a proper PostgreSQL connection string.');
      console.error('Example: postgresql://username:password@localhost:5432/database');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Error: Could not connect to the PostgreSQL server. Please check if the server is running and the connection details are correct.');
    } else if (error.code === '28P01') {
      console.error('Error: Authentication failed. Please check your username and password.');
    } else if (error.code === '3D000') {
      console.error('Error: Database does not exist. Please check the database name in your connection string.');
    } else {
      console.error('Error:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    process.exit(1);
  }
}

main();