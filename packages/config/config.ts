import { Env } from '../kafkautils/types'
const yaml = require('js-yaml')
const fs = require('fs')

interface IKafka {
    env: Env
    url: string
}

export interface IConfig {
    kafka: IKafka
    [key: string]: any
}

var config: IConfig
var configFileName: string

export function getConfig() {
    if (!config) {
        _init()
    }
    return config
}

function setConfigDefaults() {
    config = {
        "debug": false,
        "kafka": {
            "env": Env.DEV,
            "url": ""
        },
        "prometheus": {
            "metrics": {
                "port": 9999
            }
        },
        "protoregistry": {
            "host": "localhost:9191"
        }
    }
}

function setupExternalConfig(dir?: string) {
    if (!dir) return
    try {
        config = yaml.load(fs.readFileSync(dir, 'utf8'));
    } catch (e) {
        console.log(e);
    }
}

// ValidateConfig validates a Viper instance.
function validateConfig(config: IConfig) {
    if (!config.kafka || !config.kafka.url) {
        throw new Error('invalid config: "kafka.url" configuration parameter must be defined')
    }
}

function _init(): void {
    setConfigDefaults()

    if (process.env.EXTERNAL_CONFIG) {
        setupExternalConfig(process.env.EXTERNAL_CONFIG)
    }

    // Check if we're running as container on k8s
    configFileName = (process.env.KUBERNETES_SERVICE_HOST) ? "config" : (process.env.ENV) ? process.env.ENV : "local"

    // Override config with environment variables
    Object.keys(process.env).map(a => config[a] = process.env[a])

    // env vars cannot contain .
    Object.keys(config).map(a => a.replace(".", "_"))

    // Find config.yaml in ./, $CONFIGPATH/nakji/, ~/.config/nakji/, and /etc/nakji/

    let configPath = process.env.CONFIGPATH || "$HOME/.config"

    let paths = [
        ".",
        configPath,
        configPath + "/nakji",
        "/etc/nakji",
    ]

    for (let f of paths) {
        let filepath = f + "/" + configFileName + ".yaml"
        if (fs.existsSync(filepath)) {
            setupExternalConfig(filepath)
            try {
                validateConfig(config)
            } catch (err) {
                console.log("error:", err)
            }
        }
    }

    // TODO 
    // InitLogging(config)

}
