import { Configuration } from "./Configuration"
import { SystemAccessPoint } from "./SystemAccessPoint"

export class Application {
    private configuration: Configuration
    private systemAccessPoint: SystemAccessPoint
    private static debugEnabled: boolean = false

    constructor(configuration: Configuration) {
        this.configuration = configuration

        this.systemAccessPoint = new SystemAccessPoint(configuration)

        Application.debugEnabled = configuration.debug
    }

    async run(): Promise<void> {
        Application.log("Starting free@home API")

        this.systemAccessPoint.connect()
    }

    async stop(): Promise<void> {
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
}
