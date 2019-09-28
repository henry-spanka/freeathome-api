import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"

export class KeepAliveMessage implements BaseMessage {
    private readonly id: number

    constructor(id: number) {
        this.id = id
    }

    build(messageId: number): any {
        return xml('iq', { xmlns: 'jabber:client', to: 'mrha@busch-jaeger.de/rpc', type: 'get', id: this.id },
            xml('ping', { xmlns: 'urn:xmpp:ping' }))
    }
}
