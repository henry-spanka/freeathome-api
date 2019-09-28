import fs from "fs"

export class Configuration {
    readonly hostname: string
    readonly username: string
    readonly password: string
    readonly httpPort: number
    readonly wsPort: number
    readonly debug: boolean

    constructor(hostname: string, username: string, password: string, httpPort: number = 8080, wsPort: number = 8081, debug: boolean = false) {
        this.hostname = hostname
        this.username = username
        this.password = password
        this.httpPort = httpPort
        this.wsPort = wsPort
        this.debug = debug
    }

    static readFromFile(path: string): Configuration {
        let data: Buffer = fs.readFileSync(path)

        let conf = JSON.parse(data.toString())
        
        return new Configuration(conf['hostname'], conf['username'], conf['password'], conf['httpPort'], conf['wsPort'], conf['debug'] !== undefined && conf['debug'])
    }
}
