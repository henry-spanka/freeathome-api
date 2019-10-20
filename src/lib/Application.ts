import {Configuration} from "./Configuration"
import {Subscriber, SystemAccessPoint} from "./SystemAccessPoint"
import ws from "ws"
import express from "express"
import http from "http"
import {ConsoleLogger, Logger} from "./Logger";

export class Application implements Subscriber{
    private configuration: Configuration
    private systemAccessPoint: SystemAccessPoint
    private wss: ws.Server | undefined
    private webServer: http.Server | undefined
    private logger: Logger;

    constructor(configuration: Configuration, logger: Logger = new ConsoleLogger()) {
        this.configuration = configuration
        this.systemAccessPoint = new SystemAccessPoint(configuration.clientConfiguration, this, logger)

        this.logger = logger
        this.logger.debugEnabled = configuration.debug
    }

    async run(): Promise<void> {
        this.logger.log("Starting free@home API")

        try {
            await this.systemAccessPoint.connect()
        } catch (e) {
            this.logger.debug("Could not connect to free@home API", e)
            throw Error(`Could not connect to free@home API: ${e.message} `)
        }

        if (this.configuration.wsApi.enabled) {
            this.startWebsocketServer()
        }

        if (this.configuration.httpApi.enabled) {
            await this.startWebServer()
        }
    }

    async stop(): Promise<void> {
        this.closeWebsocketServer()
        await this.stopWebServer()

        this.logger.log("Stopping free@home API")
        await this.systemAccessPoint.disconnect()

    }

    static exit(code: number) {
        process.exit(code)
    }

    private getDeviceData(serialNo?: string, channel?: string, dataPoint?: string): any {
        let deviceData = this.systemAccessPoint.getDeviceData()

        if (serialNo !== undefined) {
            deviceData = this.traverse(deviceData, serialNo)
            if (channel !== undefined) {
                deviceData = this.traverse(deviceData, "channels", channel)
                if (dataPoint !== undefined) {
                    deviceData = this.traverse(deviceData, "datapoints", dataPoint)
                }
            }
        }
        return deviceData
    }

    private traverse(data: any, ...path: string[]) {
        let viewpoint = data
        for (const property of path) {
            viewpoint = property === undefined ? viewpoint : viewpoint[property]
            if (viewpoint === undefined) {
                viewpoint = {}
                break;
            }
        }

        return viewpoint
    }

    private startWebsocketServer() {
        this.wss = new ws.Server({ host: this.configuration.wsApi.address, port: this.configuration.wsApi.port })

        this.logger.log("Websocket Server started")

        this.wss.on('connection', (ws, req) => {
            this.logger.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection established')

            ws.on('message', async message => {
                this.logger.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Websocket message.', message)

                let parts = message.toString().split('/')

                let command = parts.shift() // remove command name from args list
                switch (command) {
                    case 'info':
                        let deviceData = this.getDeviceData(...parts)

                        ws.send(JSON.stringify({ result: deviceData }))
                        break

                    case 'raw':
                        if (parts.length != 4) {
                            this.logger.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': unexpected length of command')
                            break
                        }

                        await this.setDeviceData(...parts);
                        break

                    default:
                        this.logger.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Command not understood')
                }
            })

            ws.on('error', () => {
                this.logger.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection error')
            })

            ws.on('close', () => {
                this.logger.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection closed')
            })
        })
    }

    private async setDeviceData(...parts: string[]) {
        return await this.systemAccessPoint.setDatapoint(parts[0], parts[1], parts[2], parts[3])
    }

    private closeWebsocketServer() {
        if (this.wss !== undefined) {
            this.wss.close()
            this.logger.log("Websocket Server stopped")
        }
    }

    private async startWebServer() {
        let webServer = express()

        webServer.get('/raw/:serialnumber/:channel/:datapoint/:value', (req, res) => {
            this.logger.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Webserver message, command raw, params ', req.params.toString())

            this.setDeviceData(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value);
            res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value)
        })

        webServer.get('/info/:serialnumber?/:channel?/:datapoint?', (req, res) => {
            this.logger.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Webserver message, command info, params ', req.params.toString())

            let deviceData = this.getDeviceData(req.params.serialnumber, req.params.channel, req.params.datapoint)
            res.json(deviceData)
        })

        return new Promise<void>((resolve) => {
            this.webServer = webServer.listen(this.configuration.httpApi.port, this.configuration.httpApi.address, () => {
                this.logger.log("Webserver Started")
                resolve()
            })
        })
    }

    private async stopWebServer() {
        return new Promise<void>((resolve, reject) => {
            if (this.webServer !== undefined) {
                this.webServer.close((err) => {
                    if (err) {
                        reject()
                    } else {
                        this.logger.log("Webserver Stopped")
                        resolve()
                    }
                })
            } else {
                resolve()
            }
        })
    }

    broadcastMessage(message: any) {
        if (message.type === 'error'){
            throw Error(`Received error broadcast message, ${message.result}`)
        }

        const msg = JSON.stringify(message)
        if (this.wss !== undefined) {
            this.wss.clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(msg);
                }
            })
        }
    }

}
