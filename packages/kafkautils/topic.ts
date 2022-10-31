import { Env, MsgType, CONTEXT_SEPARATOR } from './types'
const SemVer = require('semver/classes/semver')
import * as proto from 'protobufjs';

export class Topic {
    readonly env: Env
    readonly msgType: MsgType
    readonly author: string
    readonly connectorName: string
    readonly version: typeof SemVer
    readonly eventName: string
    pb: proto.Type // create an empty protobuf struct instance, filled upon UnmarshalProto

    public constructor(
        env: Env,
        msgType: MsgType,
        author: string,
        connectorName: string,
        version: typeof SemVer,
        pb: proto.Type) {

        this.env = env
        this.msgType = msgType
        this.author = author
        this.connectorName = connectorName
        this.version = version
        this.eventName = pb.fullName.replace(".", "_")
        this.pb = pb
    }

    // Schema generates the schema string
    public schema(): string {
        return [
            this.author,
            this.connectorName,
            this.version.toString().replace(".", "_"),
            this.eventName].join(CONTEXT_SEPARATOR)
    }

    // String generates the topic string
    public toString(): string {
        return [this.env, this.msgType, this.schema()].join(CONTEXT_SEPARATOR)
    }
}