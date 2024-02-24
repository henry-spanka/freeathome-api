import Axios from "axios"
import {ClientConfiguration} from "./Configuration"
import {Logger} from "./Logger"
import { SystemAccessPoint, WebSocketMessage} from "freeathome-local-api-client"
import { Subscription } from "rxjs"

export class LocalApiClientWrapper {
    private configuration: ClientConfiguration
    private user: string

    private logger: Logger
    private sysAp: SystemAccessPoint | null = null
    private subscription: Subscription | null = null 
    
    constructor(configuration: ClientConfiguration, user: string, logger: Logger) {
        this.configuration = configuration
        this.user = user
        this.logger = logger
    }

    run(callback: (message: WebSocketMessage) => void) {
        this.sysAp = new SystemAccessPoint(
            this.configuration.hostname,
            this.user,
            this.configuration.password,
            false,
            false
        )

        this.subscription = this.sysAp
        .getWebSocketMessages()
        .subscribe(callback);
        
        this.sysAp.connectWebSocket(false);
    }

    stop() {
        this.sysAp?.disconnectWebSocket()
        this.subscription?.unsubscribe()
    }

    static async isEnabled(configuration: ClientConfiguration, user: string): Promise<boolean> {
        try {
            let response = await Axios.get('http://' + configuration.hostname + '/fhapi/v1/api/rest/configuration', {
                headers: {
                    'Authorization': 'Basic ' + btoa(user + ':' + configuration.password)
                }
            })

            return response.status == 200
        } catch (e: any) {
            return false
        }
    }
}
