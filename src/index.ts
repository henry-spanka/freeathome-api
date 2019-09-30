import { Configuration, ServerConfiguration } from "./lib/Configuration"
import { Application } from "./lib/Application"

let config: Configuration
try {
    config = Configuration.readFromFile("config.json")
} catch (e) {
    Application.log("Could not read/parse configuration file - Trying to use environment instead")

    if (!('FREEATHOME_HOSTNAME' in process.env) || !('FREEATHOME_USERNAME' in process.env) || !('FREEATHOME_PASSWORD' in process.env)) {
        Application.error("Required environment variables (hostname, username, password not set")
        Application.exit(1)
    }

    let httpConfiguration = new ServerConfiguration(!('FREEATHOME_HTTP_ENABLED' in process.env && process.env.FREEATHOME_HTTP_ENABLED == '0'), '0.0.0.0', 8080)
    let wsConfiguration = new ServerConfiguration(!('FREEATHOME_WS_ENABLED' in process.env && process.env.FREEATHOME_WS_ENABLED == '0'), '0.0.0.0', 8081)

    config = new Configuration(process.env.FREEATHOME_HOSTNAME!, process.env.FREEATHOME_USERNAME!, process.env.FREEATHOME_PASSWORD!,
        httpConfiguration, wsConfiguration, 'FREEATHOME_DEBUG' in process.env && process.env.FREEATHOME_DEBUG == '1')
}

process.on('unhandledRejection', up => { throw up })

let app: Application = new Application(config!)

process.on('SIGINT', () => app.stop())

app.run()
