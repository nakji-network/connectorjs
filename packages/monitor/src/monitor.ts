import { getPrometheusMetricsPort } from '../../config/config'
import * as client from 'prom-client'
import * as express from 'express'

export class Monitor {
    private kafkaLastWriteTime: client.Gauge
    private connectorName: string

    private constructor(connectorName: string) {
        this.connectorName = connectorName
        this.kafkaLastWriteTime = new client.Gauge({
            name: 'kafka_last_write_time',
            help: 'connectors last time write to kafka',
            labelNames: ['connector']
        })
    }

    public static async startMonitor(name: string): Promise<Monitor> {
        let m = new Monitor(name)
        console.log(`starting monitoring. name: ${name}`)

        let collectDefaultMetrics = client.collectDefaultMetrics
        collectDefaultMetrics({ prefix: name + '_' })
        await client.register.metrics()

        let aggregatorRegistry = new client.AggregatorRegistry()

        let metricsServer = express()
        metricsServer.get('/metrics', async (req, res) => {
            try {
                const metrics = await aggregatorRegistry.clusterMetrics();
                res.set('Content-Type', aggregatorRegistry.contentType);
                res.send(metrics);
            } catch (e) {
                res.statusCode = 500;
                res.send(e.message);
            }
        })

        let port = getPrometheusMetricsPort()
        metricsServer.listen(port)
        return m
    }

    public async setMetricsForKafkaLastWriteTime() {
        this.kafkaLastWriteTime.setToCurrentTime({ 'connector': this.connectorName })
        await client.register.metrics()
    }
}