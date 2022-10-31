import { Message, ConsumerConfig } from 'kafkajs'
import * as proto from 'protobufjs';

export const CONTEXT_SEPARATOR = "."
export const CONTRACT_SEPARATOR = "_"
export const AGGREGATE_SEPARATOR = "-"
export const WILDCARD_SUFFIX = "-*"
export const NUM_SEGMENTS = 4

export enum Env {
    PROD = "prod",
    STAGING = "staging",
    DEV = "dev",
    TEST = "test"
}

export enum MsgType {
    FCT = "fct",
    BF = "bf",
    CDC = "cdc",
    CMD = "cmd",
    SYS = "sys"
}

export interface IMessage extends Message {
    readonly msgType: MsgType
    readonly protoMsg: proto.Message<Buffer>
}

export interface ConsumerOptions extends ConsumerConfig {
    [key: string]: any
}