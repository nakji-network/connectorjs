import { Kafka, Producer } from 'kafkajs'

export function newProducer(brokers: string[] | string, clientId: string): Producer {
    if (!Array.isArray(brokers)) {
        brokers = [brokers]
    }

    let kafka = new Kafka({
        clientId: clientId,
        brokers: brokers
    })

    return kafka.producer({
        transactionalId: clientId + '-producer',
        maxInFlightRequests: 1,
        idempotent: true
    })
}