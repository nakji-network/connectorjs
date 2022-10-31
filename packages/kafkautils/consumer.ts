import { ConsumerOptions } from './types'
import { Kafka, Consumer } from 'kafkajs'

export function newConsumer(brokers: string[] | string, clientId: string, overrideOpts: ConsumerOptions): Consumer {
    if (!Array.isArray(brokers)) {
        brokers = [brokers]
    }

    let kafka = new Kafka({
        clientId: clientId,
        brokers: brokers
    })


    const opts: ConsumerOptions = {
        groupId: clientId + '-consumer'
    }

    Object.keys(overrideOpts).map(a => opts[a] = overrideOpts[a])

    return kafka.consumer(opts)
}


