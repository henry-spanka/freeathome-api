import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"

export class SubscribeMessage implements BaseMessage {
    private readonly username: string

    constructor(username: string) {
        this.username = username
    }
    
    build(messageId: number): any {
        return xml('presence', { type: "subscribe", from: this.username + '@' + 'busch-jaeger.de/freeathome-api', to: 'mrha@busch-jaeger.de/rpc'})
    }
}
