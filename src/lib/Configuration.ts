import fs from "fs"

export class ServerConfiguration {
    readonly enabled: boolean
    readonly address: string
    readonly port: number

    constructor(enabled: boolean, address: string, port: number) {
        this.enabled = enabled
        this.address = address
        this.port = port
    }
}

export class Configuration {
    readonly hostname: string
    readonly username: string
    readonly password: string
    readonly httpApi: ServerConfiguration
    readonly wsApi: ServerConfiguration
    readonly debug: boolean

    constructor(hostname: string, username: string, password: string, httpApi: ServerConfiguration, wsApi: ServerConfiguration, debug: boolean = false) {
        this.hostname = hostname
        this.username = username
        this.password = password
        this.httpApi = httpApi
        this.wsApi = wsApi
        this.debug = debug
    }

    static readFromFile(path: string): Configuration {
        let data: Buffer = fs.readFileSync(path)

        let conf = JSON.parse(data.toString())

        let httpConfiguration = new ServerConfiguration(conf['httpApi']['enabled'], conf['httpApi']['address'], conf['httpApi']['port'])
        let wsConfiguration = new ServerConfiguration(conf['wsApi']['enabled'], conf['wsApi']['address'], conf['wsApi']['port'])
        
        return new Configuration(conf['hostname'], conf['username'], conf['password'], httpConfiguration, wsConfiguration, conf['debug'] !== undefined && conf['debug'])
    }
}
