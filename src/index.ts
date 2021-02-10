import fastify from 'fastify'
import type { RouteGenericInterface } from 'fastify/types/route'

import config from './config'

import useConnection, { initDatabase, mongoDatabase } from './db-connection'

interface LocationData {
  city: string
  region: string
  temperature?: number
  humidity?: number
}

interface GetAggregationRequest extends RouteGenericInterface {
  Params: {
    region: string
  }
}

interface PostLocationRequest extends RouteGenericInterface {
  Params: {
    city: string
    region: string
  }

  Body: {
    temperature?: number
    humidity?: number
  }
}

async function main(): Promise<void> {
  await initDatabase()

  const app = fastify()

  app.get<GetAggregationRequest>('/average/:region', async function aggregateData(request, reply) {
    const { region } = request.params

    const result = await useConnection(function connection(client) {
      const db = client.db(mongoDatabase)

      const collection = db.collection('regions')

      return collection.aggregate([
        {
          $match: { region },
        },
        {
          $group: {
            _id: '$region',
            temperature: { $avg: '$temperature' },
            humidity: { $avg: '$humidity' },
          }
        }
      ]).toArray()
    })

    reply.send(result)
  })

  app.post<PostLocationRequest>('/update/:region/:city', async function insertData(request, reply) {
    const { region, city } = request.params

    const { temperature, humidity } = request.body

    const update: Pick<LocationData, 'temperature' | 'humidity'> = {}

    if (temperature !== undefined) {
      update.temperature = temperature
    }

    if (humidity !== undefined) {
      update.humidity = humidity
    }

    await useConnection(function connection(client) {
      const db = client.db(mongoDatabase)

      const collection = db.collection('regions')

      return collection.updateOne({ region, city }, { $set: update }, { upsert: true })
    })

    reply.send({ success: true })
  })

  app.get('/memory', function logMemory(request, reply) {
    const { heapUsed } = process.memoryUsage()

    console.info('Memory usage:', heapUsed / 1024 / 1024, 'MB')

    reply.send({ bytes: heapUsed })
  })

  app.listen(config.port, function callback() {
    console.info(`Server listening on http://${config.host}:${config.port}`)
  })
}

main()
