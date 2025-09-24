/**
 * Functions to extract database structure information
 */

/**
 * Extract the complete database structure
 * @param {Object} client - PostgreSQL client
 * @returns {Promise<Object>} Database structure
 */
async function extractStructure(client) {
  try {
    // Get the current database
    const currentDbQuery = `SELECT current_database() as db_name;`;
    const currentDbResult = await client.query(currentDbQuery);
    const currentDb = currentDbResult.rows[0].db_name;

    console.log(`Connected to database: ${currentDb}`);

    // Extract schema information from the current database only
    const result = {
      databases: [
        {
          name: currentDb,
          schemas: await getSchemas(client, currentDb)
        }
      ]
    };

    return result;
  } catch (error) {
    console.error('Error extracting database structure:', error.message);
    throw error;
  }
}

/**
 * Get a list of all databases
 * @param {Object} client - PostgreSQL client
 * @returns {Promise<Array<string>>} List of database names
 */
async function getDatabases(client) {
  const query = `
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
    AND datname != 'postgres'
    ORDER BY datname;
  `;

  const res = await client.query(query);
  return res.rows.map(row => row.datname);
}

/**
 * Get schemas for a specific database
 * @param {Object} client - PostgreSQL client
 * @param {string} database - Database name
 * @returns {Promise<Array<Object>>} List of schemas with their objects
 */
async function getSchemas(client, database) {
  // Set the search path for the current database
  try {
    await client.query(`SET search_path TO "$user", public;`);
  } catch (err) {
    console.warn(`Warning: Could not set search path: ${err.message}`);
  }

  const query = `
    SELECT nspname AS schema_name
    FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%'
    AND nspname != 'information_schema'
    ORDER BY nspname;
  `;

  const res = await client.query(query);
  const schemas = [];

  for (const row of res.rows) {
    const schemaName = row.schema_name;

    schemas.push({
      name: schemaName,
      tables: await getTables(client, schemaName),
      views: await getViews(client, schemaName),
      functions: await getFunctions(client, schemaName)
    });
  }

  return schemas;
}

/**
 * Get tables for a specific schema
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @returns {Promise<Array<Object>>} List of tables with their details
 */
async function getTables(client, schemaName) {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const res = await client.query(query, [schemaName]);
  const tables = [];

  for (const row of res.rows) {
    const tableName = row.table_name;

    tables.push({
      name: tableName,
      columns: await getColumns(client, schemaName, tableName),
      constraints: await getConstraints(client, schemaName, tableName),
      foreignKeys: await getForeignKeys(client, schemaName, tableName),
      triggers: await getTriggers(client, schemaName, tableName),
      indexes: await getIndexes(client, schemaName, tableName)
    });
  }

  return tables;
}

/**
 * Get columns for a specific table
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @param {string} tableName - Table name
 * @returns {Promise<Array<Object>>} List of columns with their details
 */
async function getColumns(client, schemaName, tableName) {
  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = $1
    AND table_name = $2
    ORDER BY ordinal_position;
  `;

  const res = await client.query(query, [schemaName, tableName]);
  return res.rows;
}

/**
 * Get constraints for a specific table
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @param {string} tableName - Table name
 * @returns {Promise<Array<Object>>} List of constraints with their details
 */
async function getConstraints(client, schemaName, tableName) {
  const query = `
    SELECT
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      CASE
        WHEN con.contype = 'p' THEN 'PRIMARY KEY'
        WHEN con.contype = 'u' THEN 'UNIQUE'
        WHEN con.contype = 'c' THEN 'CHECK'
        WHEN con.contype = 'f' THEN 'FOREIGN KEY'
        ELSE con.contype::text
      END AS constraint_type_desc,
      pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = $1
    AND rel.relname = $2
    ORDER BY con.conname;
  `;

  const res = await client.query(query, [schemaName, tableName]);
  return res.rows;
}

/**
 * Get foreign keys for a specific table
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @param {string} tableName - Table name
 * @returns {Promise<Array<Object>>} List of foreign keys with their details
 */
async function getForeignKeys(client, schemaName, tableName) {
  const query = `
    SELECT
      con.conname AS constraint_name,
      ns1.nspname AS source_schema,
      cl1.relname AS source_table,
      ARRAY(
        SELECT attname
        FROM pg_attribute
        WHERE attrelid = con.conrelid
        AND attnum = ANY(con.conkey)
      ) AS source_columns,
      ns2.nspname AS target_schema,
      cl2.relname AS target_table,
      ARRAY(
        SELECT attname
        FROM pg_attribute
        WHERE attrelid = con.confrelid
        AND attnum = ANY(con.confkey)
      ) AS target_columns,
      CASE con.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE NULL
      END AS update_rule,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE NULL
      END AS delete_rule
    FROM pg_constraint con
    JOIN pg_class cl1 ON con.conrelid = cl1.oid
    JOIN pg_namespace ns1 ON cl1.relnamespace = ns1.oid
    JOIN pg_class cl2 ON con.confrelid = cl2.oid
    JOIN pg_namespace ns2 ON cl2.relnamespace = ns2.oid
    WHERE ns1.nspname = $1
    AND cl1.relname = $2
    AND con.contype = 'f'
    ORDER BY con.conname;
  `;

  const res = await client.query(query, [schemaName, tableName]);
  return res.rows;
}

/**
 * Get triggers for a specific table
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @param {string} tableName - Table name
 * @returns {Promise<Array<Object>>} List of triggers with their details
 */
async function getTriggers(client, schemaName, tableName) {
  const query = `
    SELECT
      trg.tgname AS trigger_name,
      trg.tgenabled AS enabled,
      CASE
        WHEN (trg.tgtype & (1<<0)) > 0 THEN 'ROW'
        ELSE 'STATEMENT'
      END AS level,
      CASE
        WHEN (trg.tgtype & (1<<1)) > 0 THEN 'BEFORE'
        WHEN (trg.tgtype & (1<<6)) > 0 THEN 'INSTEAD OF'
        ELSE 'AFTER'
      END AS timing,
      CASE WHEN (trg.tgtype & (1<<2)) > 0 THEN true ELSE false END AS insert_event,
      CASE WHEN (trg.tgtype & (1<<3)) > 0 THEN true ELSE false END AS delete_event,
      CASE WHEN (trg.tgtype & (1<<4)) > 0 THEN true ELSE false END AS update_event,
      CASE WHEN (trg.tgtype & (1<<5)) > 0 THEN true ELSE false END AS truncate_event,
      p.proname AS function_name,
      ns.nspname AS function_schema,
      pg_get_triggerdef(trg.oid) AS definition
    FROM pg_trigger trg
    JOIN pg_class tbl ON trg.tgrelid = tbl.oid
    JOIN pg_proc p ON trg.tgfoid = p.oid
    JOIN pg_namespace ns ON p.pronamespace = ns.oid
    JOIN pg_namespace nsp ON tbl.relnamespace = nsp.oid
    WHERE NOT trg.tgisinternal
    AND nsp.nspname = $1
    AND tbl.relname = $2
    ORDER BY trigger_name;
  `;

  const res = await client.query(query, [schemaName, tableName]);
  return res.rows;
}

/**
 * Get views for a specific schema
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @returns {Promise<Array<Object>>} List of views with their details
 */
async function getViews(client, schemaName) {
  const query = `
    SELECT
      table_name AS view_name,
      view_definition
    FROM information_schema.views
    WHERE table_schema = $1
    ORDER BY table_name;
  `;

  const res = await client.query(query, [schemaName]);
  return res.rows.map(row => ({
    name: row.view_name,
    definition: row.view_definition
  }));
}

/**
 * Get functions for a specific schema
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @returns {Promise<Array<Object>>} List of functions with their details
 */
async function getFunctions(client, schemaName) {
  const query = `
    SELECT
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS function_arguments,
      t.typname AS return_type,
      p.prosrc AS function_body,
      p.provolatile AS volatility,
      p.proisstrict AS is_strict,
      p.proretset AS returns_set,
      CASE
        WHEN p.prokind = 'f' THEN 'FUNCTION'
        WHEN p.prokind = 'p' THEN 'PROCEDURE'
        WHEN p.prokind = 'a' THEN 'AGGREGATE'
        WHEN p.prokind = 'w' THEN 'WINDOW'
        ELSE p.prokind::text
      END AS function_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_type t ON p.prorettype = t.oid
    LEFT JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = $1
    AND l.lanname NOT IN ('internal', 'c')
    ORDER BY function_name;
  `;

  const res = await client.query(query, [schemaName]);
  return res.rows.map(row => ({
    name: row.function_name,
    arguments: row.function_arguments,
    return_type: row.return_type,
    body: row.function_body,
    type: row.function_type,
    volatility: row.volatility,
    is_strict: row.is_strict,
    returns_set: row.returns_set
  }));
}

/**
 * Get indexes for a specific table
 * @param {Object} client - PostgreSQL client
 * @param {string} schemaName - Schema name
 * @param {string} tableName - Table name
 * @returns {Promise<Array<Object>>} List of indexes with their details
 */
async function getIndexes(client, schemaName, tableName) {
  const query = `
    SELECT
      i.indexname AS index_name,
      i.indexdef AS index_definition,
      (SELECT array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum))
       FROM pg_index ix
       JOIN pg_class ci ON ci.oid = ix.indexrelid
       JOIN pg_class ct ON ct.oid = ix.indrelid
       JOIN pg_attribute a ON a.attrelid = ct.oid AND a.attnum = ANY(ix.indkey)
       JOIN pg_namespace n ON n.oid = ct.relnamespace
       WHERE ci.relname = i.indexname
       AND n.nspname = i.schemaname
       AND ct.relname = i.tablename) AS column_names,
      i.tablespace AS tablespace_name,
      CASE
        WHEN i.indexdef LIKE '%UNIQUE INDEX%' THEN true
        ELSE false
      END AS is_unique,
      CASE
        WHEN pg_index.indisprimary THEN true
        ELSE false
      END AS is_primary,
      CASE
        WHEN pg_index.indisvalid THEN true
        ELSE false
      END AS is_valid
    FROM pg_indexes i
    JOIN pg_class c ON c.relname = i.indexname
    JOIN pg_namespace n ON n.nspname = i.schemaname AND n.oid = c.relnamespace
    JOIN pg_index ON pg_index.indexrelid = c.oid
    WHERE i.schemaname = $1
    AND i.tablename = $2
    ORDER BY i.indexname;
  `;

  const res = await client.query(query, [schemaName, tableName]);
  return res.rows;
}

module.exports = {
  extractStructure
};