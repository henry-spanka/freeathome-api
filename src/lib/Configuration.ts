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

export class ClientConfiguration {
    readonly hostname: string
    readonly username: string
    readonly password: string

    constructor(hostname: string, username: string, password: string) {
        this.hostname = hostname
        this.username = username
        this.password = password
    }
}

export class Configuration {
    readonly clientConfiguration: ClientConfiguration
    readonly httpApi: ServerConfiguration
    readonly wsApi: ServerConfiguration
    readonly debug: boolean

    constructor(clientConfiguration: ClientConfiguration, httpApi: ServerConfiguration, wsApi: ServerConfiguration, debug: boolean = false) {
        this.clientConfiguration = clientConfiguration
        this.httpApi = httpApi
        this.wsApi = wsApi
        this.debug = debug
    }

    static readFromFile(path: string): Configuration {
        const data: Buffer = fs.readFileSync(path)
        const conf = JSON.parse(data.toString())

        const httpApiConf = conf['httpApi'];
        const httpConfiguration = new ServerConfiguration(httpApiConf['enabled'], httpApiConf['address'], httpApiConf['port'])

        const wsApiConf = conf['wsApi'];
        const wsConfiguration = new ServerConfiguration(wsApiConf['enabled'], wsApiConf['address'], wsApiConf['port'])

        const clientConfiguration = new ClientConfiguration(conf['hostname'], conf['username'], conf['password']);

        return new Configuration(
            clientConfiguration,
            httpConfiguration,
            wsConfiguration,
            conf['debug'] !== undefined && conf['debug'])
    }
}
