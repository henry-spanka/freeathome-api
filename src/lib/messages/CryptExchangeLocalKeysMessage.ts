import { xml } from "@xmpp/client"
import { BaseMessage } from "./BaseMessage"

export class CryptExchangeLocalKeysMessage implements BaseMessage {
    private readonly username: string
    private readonly key: string

    constructor(username: string, key: string) {
        this.username = username
        this.key = key
    }

    build(messageId: number): any {
        return xml('iq', { xmlns: "jabber:client", to: 'mrha@busch-jaeger.de/rpc', type: "set", id: messageId },
            xml('query', { xmlns: "jabber:iq:rpc" }, xml('methodCall', {},
                xml('methodName', {}, 'RemoteInterface.cryptExchangeLocalKeys2'),
                xml('params', {},
                    xml('param', {},
                        xml('value', {},
                            xml('string', {}, this.username + '@' + 'busch-jaeger.de'))),
                    xml('param', {},
                        xml('value', {},
                            xml('base64', {}, this.key))),
                    xml('param', {},
                        xml('value', {},
                            xml('string', {}, 'SCRAM-SHA-256'))),
                    xml('param', {},
                        xml('value', {},
                            xml('int', {}, '0')))))))
    }
}
