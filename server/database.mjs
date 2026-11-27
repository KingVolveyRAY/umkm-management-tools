import { Pool, types } from '@neondatabase/serverless';
import { commerceMigration, databaseSchema, initialRows, migrateFirstOutlet, outletIndexes, outletMigrationColumns, verifyMode } from './store.mjs';

function sqliteConnection(raw) {
  return {
    get: (sql, args = []) => raw.prepare(sql).get(...args),
    all: (sql, args = []) => raw.prepare(sql).all(...args),
    run: (sql, args = []) => raw.prepare(sql).run(...args).changes,
  };
}

export function useDatabase(database) {
  if (typeof database.transaction === 'function') return database;

  const connection = sqliteConnection(database);
  let tail = Promise.resolve();
  function enqueue(operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }
  return {
    createdDay: "date(created_at, '+7 hours')",
    get: (...args) => enqueue(() => connection.get(...args)),
    all: (...args) => enqueue(() => connection.all(...args)),
    run: (...args) => enqueue(() => connection.run(...args)),
    transaction: action => enqueue(async () => {
      // SQLite queries on this handle must stay inside the active transaction until it completes.
      database.exec('BEGIN IMMEDIATE');
      try {
        const result = await action(connection);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }),
  };
}

function postgresConnection(client) {
  function query(sql, args) {
    let position = 0;
    return client.query(sql.replaceAll('?', () => '$' + ++position), args);
  }
  return {
    async get(sql, args) { return (await query(sql, args)).rows[0]; },
    async all(sql, args) { return (await query(sql, args)).rows; },
    async run(sql, args) { return (await query(sql, args)).rowCount; },
  };
}

export async function openPostgres(connectionString, options) {
  const pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    types: {
      getTypeParser(oid, format) {
        if (oid !== 20 || (format && format !== 'text')) return types.getTypeParser(oid, format);
        return value => {
          const integer = Number(value);
          if (!Number.isSafeInteger(integer)) throw new RangeError('Nilai laporan melebihi batas presisi.');
          return integer;
        };
      },
    },
  });
  pool.on('error', error => console.error('Koneksi database terputus.', error.code ?? error.name));

  const db = {
    ...postgresConnection(pool),
    createdDay: "to_char(created_at::timestamptz AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD')",
    async transaction(action) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await action(postgresConnection(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };

  try {
    await db.transaction(async tx => {
      await tx.run('SELECT pg_advisory_xact_lock(904700041)');
      await tx.run(databaseSchema(true));
      const existing = await tx.get('SELECT mode FROM store WHERE id = 1');
      verifyMode(existing);
      if (!existing) {
        for (const [sql, args] of initialRows(options)) await tx.run(sql, args);
      }
      if (!await tx.get('SELECT version FROM schema_migrations WHERE version = 1')) {
        await tx.run(migrateFirstOutlet);
        await tx.run("SELECT setval(pg_get_serial_sequence('outlets','id'), (SELECT MAX(id) FROM outlets))");
        for (const [table, column, definition] of outletMigrationColumns) {
          await tx.run('ALTER TABLE ' + table + ' ADD COLUMN IF NOT EXISTS ' + column + ' ' + definition);
        }
        await tx.run(outletIndexes);
        await tx.run('INSERT INTO schema_migrations VALUES (1)');
      }
      if (!await tx.get('SELECT version FROM schema_migrations WHERE version = 2')) {
        await tx.run(commerceMigration(true));
      }
    });
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
