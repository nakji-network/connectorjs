import { getConfig, IConfig } from './packages/config/config'
import { loadManifest, Manifest } from './manifest'
import { Env, IMessage, MsgType, ConsumerOptions } from './packages/kafkautils/types'
import { newConsumer } from './packages/kafkautils/consumer'
import { newProducer } from './packages/kafkautils/producer'
import { Topic } from './packages/kafkautils/topic'
import { TopicTypes, registerDynamicTopics } from './packages/protoregistry/src/client'

import { Consumer, Producer, KafkaMessage, ProducerBatch } from 'kafkajs'
import * as proto from 'protobufjs';

export class Connector {
    private config: IConfig
    private env: Env
    private readonly kafkaUrl: string
    private manifest: Manifest
    private readonly rpcs: any
    private consumer?: Consumer
    private producer?: Producer
    private protoRegistryHost: string

    private constructor(config: IConfig, env: Env, kafkaUrl: string, manifest: Manifest, rpcs: any, protoRegistryHost: string) {
        this.config = config
        this.env = env
        this.kafkaUrl = kafkaUrl
        this.manifest = manifest
        this.rpcs = rpcs
    }

    /**
     * create() build a new Connector instance and returns to the caller.
     * @param options functions to apply to connector instance
     * @returns new connector instance
     */
    public static create(...options: ((c: Connector) => void)[]): Connector {
        let conf = getConfig()

        let rpcMap = conf.rpcs

        let c = new Connector(
            conf,
            conf.kafka.env,
            conf.kafka.url,
            loadManifest(),
            rpcMap,
            conf.protoregistry.host
        )

        this.parseOptions(c, ...options)

        if (!c.manifest) {
            throw new Error('missing manifest.yaml')
        }

        // TODO protoregistry

        return c
    }

    /**
     * parseOption() applies custom functions to the connector.
     * @param connector connector instance 
     * @param options functions to apply to the connector instance
     */
    private static parseOptions(connector: Connector, ...options: ((c: Connector) => void)[]): void {
        for (let option of options) {
            option(connector)
        }
    }

    /**
     * withManifest() returns a function that will be applied manually to Connector 
     * @param manifest connector metadata
     * @returns function to be applied to connector
     */
    public static withManifest(manifest: Manifest): (c: Connector) => void {
        return (c: Connector) => {
            c.manifest = manifest
        }
    }

    /**
     * id() returns a unique id for this connector based on the manifest.
     * @returns Connector ID string
     */
    private id(): string {
        return `${this.manifest.author}-${this.manifest.name}-${this.manifest.version}-${this.env}`
    }

    /**
     * generateTopicFromProto generates message queue topic names based on the protobuf message.
     * Event names should be prefixed with contract_ or category_ when appropriate.
     * 
     * @param msgType kafkautils message type
     * @param msg  protobuf message
     * @returns Topic object
     */
    private generateTopicFromProto(msgType: MsgType, msg: proto.Message): Topic {
        return new Topic(
            this.env,
            msgType,
            this.manifest.author,
            this.manifest.name,
            this.manifest.version.Version,
            msg,
        )
    }

    /**
     * startProducer() creates a new kafka producer instance
     */
    private async startProducer() {
        console.log("initializing kafka producer. transactionID: ", this.id())
        this.producer = newProducer(this.kafkaUrl, this.id())
        await this.producer.connect()
    }

    /**
     * 
     * @param msgType kafkautils message type
     * @param messages messages to be pushed to kafka
     */
    public async produceMessages(msgType: MsgType, messages: IMessage[]) {
        if (!this.producer) await this.startProducer()

        let batch = messages.map(msg => {
            return {
                topic: this.generateTopicFromProto(msgType, msg.protoMsg),
                messages: [msg.protoMsg]
            }
        })

        const transaction = await this.producer?.transaction()

        try {
            await transaction?.sendBatch(batch as ProducerBatch)
            await transaction?.commit()
        } catch (e) {
            await transaction?.abort()
        }
    }

    /**
     * startConsumer() creates a new kafka consumer instance
     * 
     * @param overrideOpts a dict to override default kafka consumer options
     */
    private async startConsumer(overrideOpts: ConsumerOptions) {
        console.log("initializing kafka producer. groupID: ", this.id())
        this.consumer = newConsumer(this.kafkaUrl, this.id(), overrideOpts)
    }

    /**
     * subscribe() subscribes the connector to given kafka topics and 
     * applies the provided function to each incoming message.
     * 
     * @param topics kafka topics to subscribe to
     * @param fn a function to apply to each message
     * @param overrideOpts a dict to override default kafka consumer options
     */
    public async subscribe(topics: Topic[], fn: (msg: KafkaMessage) => void, overrideOpts: ConsumerOptions) {
        if (!this.consumer) await this.startConsumer(overrideOpts)

        await this.consumer?.subscribe({ topics: topics.map(a => { return a.toString() }) })
        await this.consumer?.run({
            eachBatchAutoResolve: true,
            eachBatch: async ({
                batch,
                resolveOffset,
                heartbeat,
                commitOffsetsIfNecessary,
                uncommittedOffsets,
                isRunning,
                isStale,
                pause,
            }) => {
                for (let message of batch.messages) {
                    fn(message)
                    resolveOffset(message.offset)
                    await heartbeat()
                }
            },
        })
    }

    get RPCs(): any {
        return this.rpcs
    }

    get Config(): IConfig {
        return this.config
    }

    /**
     * RegisterProtos generates kafka topic and protobuf type mappings from proto.Message and registers them dynamically.
     * @param msgType kafkautils message type
     * @param protos protocol buffer definitions
     * @returns 
     */
    public registerProtos(msgType: MsgType, ...protos: proto.Message[]): void {
        if (this.env == Env.DEV) {
            console.log("protoregistry is disabled in dev mode, set kafka.env to other values (e.g., test, staging) to enable it")
            return
        }

        let tts: TopicTypes = {}
        for (let proto of protos) {
            tts[this.generateTopicFromProto(msgType, proto).schema()] = proto
        }

        try {
            registerDynamicTopics(this.protoRegistryHost, tts, msgType)
        } catch (e) {
            console.log(e)
        }
    }
}