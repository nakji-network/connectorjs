import { MsgType, CONTEXT_SEPARATOR } from "../../kafkautils/types"

import * as proto from 'protobufjs';
import { exec } from 'node:child_process'
const fs = require('fs')
const path = require('path')
const http = require('http');

export type TopicTypes = { [tt: string]: proto.Message }

type TopicProtoMsg = {
    msg_type: MsgType
    topic: string
    proto_msg: string
    descriptor: Buffer
}

/**
 * registerDynamicTopics() stores protobuf definitions and creates kafka topics for them.
 * 
 * @param host URL to protoregistry host
 * @param topicTypes topic name to protobuf definition map
 * @param msgType {@link MsgType} kafka message type
 */
export function registerDynamicTopics(host: string, topicTypes: TopicTypes, msgType: MsgType): void {
    let tpmList = buildTopicProtoMsgs(topicTypes, msgType)

    generateDescriptorFiles(tpmList)

    let payload = JSON.stringify(tpmList)
    let req = http.request({
        hostname: host,
        path: '/v1/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    })

    req.on('error', (e) => {
        console.error(`call failed. error: ${e.message}`);
    });

    req.write(payload)
    req.end()
}

/**
 * 
 * @param topicTypes map of kafka topic name to protobuf definition
 * @param msgType {@link MsgType} kafkautils message type
 * @returns array of topic proto messages
 */
function buildTopicProtoMsgs(topicTypes: TopicTypes, msgType: MsgType): TopicProtoMsg[] {
    var tpmList = [] as TopicProtoMsg[]

    for (let [k, v] of Object.entries(topicTypes)) {
        let tpm = {
            msg_type: msgType,
            topic: v.$type.fullName,    // nakji.uniswapv2.0_0_0.liquiditypool_Change
            proto_msg: v.$type.filename // liquiditypool.Change
        } as TopicProtoMsg

        tpmList.push(tpm)
    }
    return tpmList
}

/**
 * generateDescriptorFiles() scans the local disk looking for proto files and generates proto descriptor files.
 */
function generateDescriptorFiles(tpmList: TopicProtoMsg[]): void {
    let cwd = process.cwd()

    for (let tpm of tpmList) {
        try {
            let path = getProtoFilePath(cwd, tpm)
            let descFile = generateDescriptorFile(path)
            let desc = fs.readFileSync(descFile)
            tpm.descriptor = desc
        } catch (err) {
            console.error(err);
        }
    }
}

/**
 * generateDescriptorFile() creates .desc file from .proto file
 * 
 * @param filepath path to .proto file (e.g. //my/path/to/file/myfile.proto)
 * @returns .desc file path
 */
function generateDescriptorFile(filepath: string): string {
    let descFile = filepath + ".desc"
    let file = path.basename(filepath)
    let dir = path.dirname(filepath)

    if (fs.existsSync(descFile)) {
        console.log("proto descriptor already exists, skip")
        return descFile
    }

    let cmd = `protoc --include_imports "--descriptor_set_out=${descFile} -I=${dir} ${file}`
    exec(cmd, (err, output) => {
        if (err) {
            console.error("could not execute command: " + err)
            return ""
        }
        console.debug(output)
    })

    return descFile
}

/**
 * getProtoFilePath() finds the absolute path to certain .proto file inside project.
 * 
 * @param baseDir project base directory path
 * @param tpm {@link TopicProtoMsg} protobuf message object
 * @returns path to .proto file
 */
function getProtoFilePath(baseDir: string, tpm: TopicProtoMsg): string {

    let pkg = tpm.proto_msg.split(CONTEXT_SEPARATOR)[0]

    let filenames = fs.readdirSync(baseDir)
    for (let f of filenames) {
        let filepath = path.join(baseDir, f)
        if (fs.statSync(filepath).isFile() && f == pkg + '.proto') {
            return filepath
        }
    }
    throw new Error('proto file not found')
}

