import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"

export class CapabilityAnnouncementMessageSub implements BaseMessage {

    build(messageId: number): any {
        return xml('presence', {xmlns: 'jabber:client'}, xml('c', {'xmlns': 'http://jabber.org/protocol/caps', 'hash': 'sha-1', 'ver': 'RBOocXwOQW96MiNwSIyG9ZQd6RY=', 'node': 'http://freeathome.com/caps'}))
    }
}
