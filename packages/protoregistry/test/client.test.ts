import { TopicTypes } from '../src/client';
import { buildTopicProtoMsgs, generateDescriptorFiles } from '../src/client'
import { MsgType } from '../../kafkautils/types'

import * as path from 'path'
import * as fs from 'fs'
import * as proto from 'protobufjs';

describe('Proto Registry', function () {
    test('checks buildTopicProtoMsgs()', async function () {
        let testFile = await proto.load(path.join(process.cwd(), 'packages', 'protoregistry', 'test', 'test.proto'))
        let mintMsg = testFile.lookupType('test.Mint')
        let redeemMsg = testFile.lookupType('test.Redeem')

        let topicTypes: TopicTypes = {
            'nakji.test.0_0_0.test_Mint': mintMsg,
            'nakji.test.0_0_0.test_Redeem': redeemMsg,
        }

        let tpms = buildTopicProtoMsgs(topicTypes, MsgType.SYS)

        expect(tpms.length).toBe(2)
        expect(tpms[0].topic).toBe('nakji.test.0_0_0.test_Mint')
        expect(tpms[0].proto_msg).toBe('.test.Mint')
        expect(tpms[1].topic).toBe('nakji.test.0_0_0.test_Redeem')
        expect(tpms[1].proto_msg).toBe('.test.Redeem')
    })

    test('checks generateDescriptorFiles()', async function () {
        let testFile = await proto.load(path.join(process.cwd(), 'packages', 'protoregistry', 'test', 'test.proto'))
        let mintMsg = testFile.lookupType('test.Mint')
        let redeemMsg = testFile.lookupType('test.Redeem')

        let topicTypes: TopicTypes = {
            'nakji.test.0_0_0.test_Mint': mintMsg,
            'nakji.test.0_0_0.test_Redeem': redeemMsg,
        }

        let tpms = buildTopicProtoMsgs(topicTypes, MsgType.SYS)

        generateDescriptorFiles(tpms)

        let filePath = path.join(process.cwd(), 'packages', 'protoregistry', 'test', 'test.proto.desc')
        expect(fs.existsSync(filePath)).toBeTruthy()
    })
})
