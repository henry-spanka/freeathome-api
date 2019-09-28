import { Configuration } from "./Configuration"
import { SystemAccessPoint } from "./SystemAccessPoint"
import ws from "ws"

export class Application {
    private configuration: Configuration
    private systemAccessPoint: SystemAccessPoint
    private static debugEnabled: boolean = false
    private wss: ws.Server | undefined

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
            throw new Error("Not Implemented")
        }
    }

    async stop(): Promise<void> {
        this.closeWebsocketServer()

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

    private startWebsocketServer() {
        this.wss = new ws.Server({ port: this.configuration.wsPort })

        Application.log("Websocket Server started")

        this.wss.on('connection', (ws, req) => {
            Application.log('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Websocket connection established')

            ws.on('message', message => {
                Application.debug('[' + req.connection.remoteAddress + ':' + req.connection.remotePort + ']' + ': Received Websocket message.', message)

                let parts = message.toString().split('/')

                let command = parts[0]

                switch(command) {
                    case 'info':
                        ws.send(JSON.stringify({result: this.systemAccessPoint.getDeviceData()}))
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
