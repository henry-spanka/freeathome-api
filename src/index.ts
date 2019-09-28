import { Configuration } from "./lib/Configuration"
import { Application } from "./lib/Application"

let config: Configuration
try {
    config = Configuration.readFromFile("config.json")
} catch (e) {
    Application.log("Could not read/parse configuration file", e.message)
    process.exit(1)
}

process.on('unhandledRejection', up => { throw up })

let app: Application = new Application(config!)

process.on('SIGINT', () => app.stop())

app.run()
