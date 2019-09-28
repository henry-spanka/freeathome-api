import { BasePayload } from "./BasePayload"
import { MessageWriter } from "../../MessageWriter"
import { Message } from "../../constants"

export class StartNewSessionPayload implements BasePayload {
    private readonly sessionIdentifier: string

    constructor(sessionIdentifier: string) {
        this.sessionIdentifier = sessionIdentifier
    }

    build(): Uint8Array {
        let messageWriter = new MessageWriter()
        messageWriter.writeUint8(Message.MSG_ID_NEW_SESSION)
        messageWriter.writeUint32(Message.PROTOCOL_VERSION)
        messageWriter.writeUint8(Message.AUTH_TYPE_USER)
        messageWriter.writeString(this.sessionIdentifier)

        return messageWriter.toUint8Array()
    }
}
