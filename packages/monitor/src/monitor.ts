import { GetPrometheusMetricsPort } from '../../config/config'
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

    public async startMonitor(name: string) {
        let m = new Monitor(name)
        console.log(`starting monitoring. name: ${this.connectorName}`)

        let collectDefaultMetrics = client.collectDefaultMetrics
        collectDefaultMetrics({ prefix: this.connectorName + '_' })
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
        });

        let port = GetPrometheusMetricsPort()
        metricsServer.listen(port)
    }

    public async SetMetricsForKafkaLastWriteTime() {
        this.kafkaLastWriteTime.setToCurrentTime({ 'connector': this.connectorName })
        await client.register.metrics()
    }
}