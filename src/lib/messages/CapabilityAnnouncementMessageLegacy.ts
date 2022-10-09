/*
 * For firmware < 3.0.1
 */

import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"

export class CapabilityAnnouncementMessageLegacy implements BaseMessage {

    build(messageId: number): any {
        return xml('presence', {xmlns: 'jabber:client'}, xml('c', {'xmlns': 'http://jabber.org/protocol/caps', 'ver': '1.1', 'node': 'http://gonicus.de/caps'}))
    }
}
