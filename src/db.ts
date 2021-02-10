import { MongoMemoryServer } from 'mongodb-memory-server'

const mongod = new MongoMemoryServer({
  binary: {
    version: '3.6.22'
  }
});

export default mongod
