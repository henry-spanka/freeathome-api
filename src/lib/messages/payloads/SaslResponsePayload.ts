import { BasePayload } from "./BasePayload"
import { MessageWriter } from "../../MessageWriter"
import { Message } from "../../constants"

export class SaslResponsePayload implements BasePayload {
    private readonly clientFinal: string

    constructor(clientFinal: string) {
        this.clientFinal = clientFinal
    }

    build(): Uint8Array {
        let messageWriter = new MessageWriter()

        messageWriter.writeUint8(Message.MSG_ID_SASL_RESPONSE)
        messageWriter.writeString(this.clientFinal)
        
        return messageWriter.toUint8Array()
    }
}
