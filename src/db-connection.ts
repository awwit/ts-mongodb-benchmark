import { MongoClient } from 'mongodb'

import mongod from './db'

export let mongoDatabase = ''

const connectionOptions = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
}

function useConnection<R>(cb: (client: MongoClient) => R): Promise<R> {
  return mongod.getUri().then(uri => MongoClient.connect(uri, connectionOptions)).then((conn) => {
    return Promise.resolve(conn)
      .then(cb)
      .finally(() => conn.close())
  })
}

export async function initDatabase(): Promise<void> {
  const uri = await mongod.getUri()

  console.info('DB URI:', uri)

  mongoDatabase = await mongod.getDbName()

  return useConnection(async function connection(client) {
    const db = client.db(mongoDatabase)

    const collection = await db.createCollection('regions')

    await collection.createIndex({ region: 1, city: 1 }, { unique: true })
  })
}

export default useConnection
