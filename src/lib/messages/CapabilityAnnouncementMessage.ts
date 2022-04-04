import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"

export class CapabilityAnnouncementMessage implements BaseMessage {
    
    build(messageId: number): any {
        return xml('presence', {xmlns: 'jabber:client'}, xml('c', {'xmlns': 'http://jabber.org/protocol/caps', 'hash': 'sha-1', 'ver': 'fixfCv/LdbraoPYq21aYj8JK6PA=', 'node': 'http://freeathome.com/caps'}))
    }
}
