import { BasePayload } from "./BasePayload"
import { MessageWriter } from "../../MessageWriter"
import { Message } from "../../constants"

export class LoginSaslPayload implements BasePayload {
    private readonly scram: string

    constructor(scram: string) {
        this.scram = scram
    }

    build(): Uint8Array {
        let messageWriter = new MessageWriter()
        messageWriter.writeUint8(Message.MSG_ID_LOGIN_SASL)
        messageWriter.writeString('SCRAM-SHA-256')
        messageWriter.writeString(this.scram)

        return messageWriter.toUint8Array()
    }
}
