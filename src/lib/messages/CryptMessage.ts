import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"
import { Crypto } from "../Crypto"

export class CryptMessage implements BaseMessage {
    private readonly payload: Uint8Array

    constructor(payload: Uint8Array) {
        this.payload = payload
    }

    build(messageId: number): any {
        return xml('iq', { xmlns: "jabber:client", to: 'mrha@busch-jaeger.de/rpc', type: "set", id: messageId },
            xml('query', { xmlns: "jabber:iq:rpc" }, xml('methodCall', {},
                xml('methodName', {}, 'RemoteInterface.cryptMessage'),
                xml('params', {},
                    xml('param', {},
                        xml('value', {},
                            xml('base64', {}, Crypto.uint8_to_base64(this.payload))))))))
    }
}
