import fs from "fs"

export class Configuration {
    readonly hostname: string
    readonly username: string
    readonly password: string
    readonly debug: boolean
    constructor(hostname: string, username: string, password: string, debug: boolean) {
        this.hostname = hostname
        this.username = username
        this.password = password
        this.debug = debug
    }
    static readFromFile(path: string): Configuration {
        let data: Buffer = fs.readFileSync(path)

        let conf = JSON.parse(data.toString())
        
        return new Configuration(conf['hostname'], conf['username'], conf['password'], conf['debug'] !== undefined && conf['debug'])
    }
}
