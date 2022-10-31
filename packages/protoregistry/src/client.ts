import { MsgType, CONTEXT_SEPARATOR } from "../../kafkautils/types"

import { exec } from 'node:child_process'
import * as proto from 'protobufjs'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

export type TopicTypes = { [tt: string]: proto.Type }

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

    req.on('error', (e: Error) => {
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
export function buildTopicProtoMsgs(topicTypes: TopicTypes, msgType: MsgType): TopicProtoMsg[] {
    var tpmList = [] as TopicProtoMsg[]

    for (let [k, v] of Object.entries(topicTypes)) {
        let tpm = {
            msg_type: msgType,
            topic: k,    // nakji.uniswapv2.0_0_0.liquiditypool_Change
            proto_msg: v.fullName // .liquiditypool.Change
        } as TopicProtoMsg

        tpmList.push(tpm)
    }
    return tpmList
}

/**
 * generateDescriptorFiles() scans the local disk looking for proto files and generates proto descriptor files.
 */
export function generateDescriptorFiles(tpmList: TopicProtoMsg[]): void {
    for (let tpm of tpmList) {
        let pkg = tpm.proto_msg.split(CONTEXT_SEPARATOR)[1]
        let filepath = getProtoFilePath(process.cwd(), pkg)

        if (!filepath) throw new Error(`proto file not found. package: ${pkg}`)

        try {
            let descFile = generateDescriptorFile(filepath)
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

    let cmd = `protoc --include_imports --descriptor_set_out=${descFile} -I=${dir} ${file}`
    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.error("could not execute command: " + err)
            return ""
        }
        return descFile
    })

    return descFile
}

/**
 * getProtoFilePath() finds the absolute path to certain .proto file inside project.
 * 
 * @param dir project base directory path
 * @param filename file name with extension
 * @returns path to .proto file
 */
function getProtoFilePath(baseDir: string, pkg: string): string {

    let filepath = ''
    function find(dir: string, filename: string) {
        for (let f of fs.readdirSync(dir)) {
            let dirPath = path.join(dir, f)

            if (fs.statSync(dirPath).isDirectory()) {
                find(dirPath, filename)
            } else if (filename == path.basename(dirPath)) {
                filepath = dirPath
            }
        }
    }
    find(baseDir, pkg + '.proto')
    return filepath
}