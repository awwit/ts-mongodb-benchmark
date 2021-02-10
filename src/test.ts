import * as http from 'http'
import { performance } from 'perf_hooks'
import * as seedrandom from 'seedrandom'

import config from './config'

function toObject<R>(buffer: Buffer, resolve: (value: R) => void, reject: (error: Error) => void): void {
  try {
    const value = JSON.parse(buffer.toString())
    resolve(value)
  } catch (err) {
    reject(err)
  }
}

function handleResponse<R>(response: http.IncomingMessage, resolve: (value: R) => void, reject: (error: Error) => void): void {
  const chunks: Buffer[] = []

  response.on('error', reject)

  response.on('data', function data(data: Buffer | string) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data)
    }

    chunks.push(data)
  })

  response.on('end', function end() {
    toObject(Buffer.concat(chunks), resolve, reject)
  })
}

function updateLocationData<T, R>(city: string, region: string, data: T): Promise<R> {
  return new Promise<R>(function executor(resolve, reject) {
    const body = JSON.stringify(data)

    const req = http.request({
      host: config.host,
      port: config.port,
      path: encodeURI(`/update/${region}/${city}`),
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': body.length
      },
    }, function response(response) {
      handleResponse(response, resolve, reject)
    })

    req.on('error', reject)

    req.write(body)
    req.end()
  })
}

function getRegionAverageData<R>(region: string): Promise<R> {
  return new Promise<R>(function executor(resolve, reject) {
    const req = http.request({
      host: config.host,
      port: config.port,
      path: encodeURI(`/average/${region}`),
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }, function response(response) {
      handleResponse(response, resolve, reject)
    })

    req.on('error', reject)
    req.end()
  })
}

function getServerMemoryUsage(): Promise<void> {
  return new Promise(function executor(resolve, reject) {
    const req = http.request({
      host: config.host,
      port: config.port,
      path: '/memory',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }, function response(response) {
      handleResponse(response, resolve, reject)
    })

    req.on('error', reject)
    req.end()
  })
}

function getRandomInt(rng: seedrandom.prng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function getRandomRegion(rng: seedrandom.prng): string {
  return String.fromCharCode(getRandomInt(rng, 0, 64))
}

function getRandomCity(rng: seedrandom.prng): string {
  return String.fromCharCode(getRandomInt(rng, 0, 255))
}

function getRandomTemperature(rng: seedrandom.prng): number {
  return getRandomInt(rng, -25, 35)
}

function getRandomHumidity(rng: seedrandom.prng): number {
  return getRandomInt(rng, 0, 100)
}

async function runTest(): Promise<void> {
  const rng = seedrandom(config.seed)

  const count = 5000
  const promises: Promise<unknown>[] = []

  const startTime = performance.now()

  for (let i = 0; i < count; ++i) {
    const region = getRandomRegion(rng)
    const city = getRandomCity(rng)
    const temperature = getRandomTemperature(rng)
    const humidity = getRandomHumidity(rng)

    promises.push(updateLocationData(city, region, { temperature }))
    promises.push(updateLocationData(city, region, { humidity }))

    if (i % 10 === 0) {
      let promise = getRegionAverageData(getRandomRegion(rng))

      if (i % 500 === 0) {
        promise = promise.then(() => getServerMemoryUsage())
      }

      promises.push(promise)
    }
  }

  await Promise.all(promises)

  await getServerMemoryUsage()

  const result = await getRegionAverageData(getRandomRegion(rng))

  const totalTime = performance.now() - startTime

  console.info('test time:', totalTime, 'ms')
  console.info('average request time:', totalTime / count, 'ms')

  // eslint-disable-next-line no-console
  console.info('RESULT', result)
}

runTest()
