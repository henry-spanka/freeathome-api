import { Configuration } from "./Configuration"
import { SystemAccessPoint } from "./SystemAccessPoint"
import ws from "ws"
import express from "express"
import http from "http"

export class Application {
    private configuration: Configuration
    private systemAccessPoint: SystemAccessPoint
    private static debugEnabled: boolean = false
    private wss: ws.Server | undefined
    private webServer: http.Server | undefined

    constructor(configuration: Configuration) {
        this.configuration = configuration

        this.systemAccessPoint = new SystemAccessPoint(configuration, this)

        Application.debugEnabled = configuration.debug
    }

    async run(): Promise<void> {
        Application.log("Starting free@home API")

        await this.systemAccessPoint.connect()

        if (this.configuration.wsPort > 0) {
            this.startWebsocketServer()
        }

        if (this.configuration.httpPort > 0) {
            await this.startWebServer()
        }
    }

    async stop(): Promise<void> {
        this.closeWebsocketServer()
        await this.stopWebServer()

        Application.log("Stopping free@home API")
        await this.systemAccessPoint.disconnect()

        Application.exit(0)
    }

    static log(...messages: string[] | number[] | Object[]) {
        for (let message of messages) {
            console.log(new Date().toLocaleString(), '-', 'INFO' + ":", message)
        }
    }

    static error(...messages: string[] | number[] | Object[]) {
        for (let message of messages) {
            console.log(new Date().toLocaleString(), '-', 'ERR' + ":", message)
        }
    }

    static debug(...messages: string[] | number[] | Object[]) {
        if (Application.debugEnabled) {
            for (let message of messages) {
                console.log(new Date().toLocaleString(), '-', 'DEBUG' + ":", message)
            }
        }
    }

    static exit(code: number) {
        process.exit(code)
    }

    private getDeviceData(serialNo?: string): any {
        let deviceData = this.systemAccessPoint.getDeviceData()

        if (serialNo === undefined) {
            return deviceData
        } else {
            if (deviceData[serialNo] !== undefined) {
                return deviceData[serialNo]
            } else {
                return {}
            }
        }
    }

    private startWebsocketServer() {
        this.wss = new ws.Server({ port: this.configuration.wsPort })

        Application.log("Websocket Server started")

        this.wss.on('connection', (ws, req) => {
            Application.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection established')

            ws.on('message', message => {
                Application.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Websocket message.', message)

                let parts = message.toString().split('/')

                let command = parts[0]

                switch (command) {
                    case 'info':
                        let deviceData = this.getDeviceData(parts[1])

                        ws.send(JSON.stringify({ result: deviceData }))
                        break

                    case 'raw':
                        if (parts.length != 5) {
                            Application.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': unexpected length of command')
                            break
                        }

                        this.systemAccessPoint.setDatapoint(parts[1], parts[2], parts[3], parts[4])
                        break

                    default:
                        Application.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Command not understood')
                }
            })

            ws.on('error', () => {
                Application.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection error')
            })

            ws.on('close', () => {
                Application.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection closed')
            })
        })
    }

    private closeWebsocketServer() {
        if (this.wss !== undefined) {
            this.wss.close()
            Application.log("Websocket Server stopped")
        }
    }

    private async startWebServer() {
        let webServer = express()

        webServer.get('/raw/:serialnumber/:channel/:datapoint/:value', (req, res) => {
            Application.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Webserver message, command raw, params ', req.params.toString())

            this.systemAccessPoint.setDatapoint(req.params.serialnumber, req.params.channel, req.params.datapoint, req.params.value)
            res.send(req.params.serialnumber + '/' + req.params.channel + '/' + req.params.datapoint + ': ' + req.params.value)
        })

        webServer.get('/info/:serialnumber?', (req, res) => {
            Application.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Webserver message, command info, params ', req.params.toString())

            let deviceData = this.getDeviceData(req.params.serialnumber)
            res.json(deviceData)
        })

        return new Promise<void>((resolve) => {
            this.webServer = webServer.listen(this.configuration.httpPort, () => {
                Application.log("Webserver Started")
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
                        Application.log("Webserver Stopped")
                        resolve()
                    }
                })
            } else {
                resolve()
            }
        })
    }

    broadcastMessage(message: string) {
        if (this.wss !== undefined) {
            this.wss.clients.forEach(client => {
                if (client.readyState === ws.OPEN) {
                    client.send(message);
                }
            })
        }
    }

}
