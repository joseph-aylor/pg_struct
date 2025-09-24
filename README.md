# PostgreSQL Structure Dump

A CLI tool to extract the complete structure of a PostgreSQL database as JSON. This tool extracts:
- Databases
- Schemas
- Tables with their columns, constraints, foreign keys, and triggers
- Views with their definitions
- Functions with their code

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pg_structure_dump.git
cd pg_structure_dump

# Install dependencies
npm install

# Make the script globally available (optional)
npm link
```

## Usage

```bash
# Using npm script
npm start -- -c "postgresql://username:password@localhost:5432/database"

# Using the command directly
./src/index.js -c "postgresql://username:password@localhost:5432/database"

# If installed globally
pg-structure-dump -c "postgresql://username:password@localhost:5432/database"

# Save output to file
pg-structure-dump -c "postgresql://username:password@localhost:5432/database" -o output.json
```

### Connection String Format

The connection string follows the standard PostgreSQL connection string format:
```
postgresql://[username]:[password]@[host]:[port]/[database]
```

Examples:
```
postgresql://myuser:mypassword@localhost:5432/mydatabase
postgresql://dbuser:pass123@example.com/app_db
postgresql://postgres@localhost/test_db
```

Make sure to properly URL-encode any special characters in your username or password:
```
postgresql://user%40domain.com:pass%23word@localhost/mydb
```

Note: When using npm start, you need to escape special characters in your shell:
```
npm start -- -c "postgresql://myuser:my\$password@localhost/mydatabase"
```

## JSON Structure

The output is a JSON object with the following structure:

```json
{
  "databases": [
    {
      "name": "database_name",
      "schemas": [
        {
          "name": "schema_name",
          "tables": [
            {
              "name": "table_name",
              "columns": [...],
              "constraints": [...],
              "foreignKeys": [...],
              "triggers": [...],
              "indexes": [...]
            }
          ],
          "views": [
            {
              "name": "view_name",
              "definition": "view SQL definition"
            }
          ],
          "functions": [
            {
              "name": "function_name",
              "arguments": "function arguments",
              "return_type": "return type",
              "body": "function body code",
              "type": "FUNCTION|PROCEDURE|AGGREGATE",
              "volatility": "i|s|v",
              "is_strict": true|false,
              "returns_set": true|false
            }
          ]
        }
      ]
    }
  ]
}
```

## License

GPL v3
