import { BasePayload } from "./BasePayload"
import { MessageWriter } from "../../MessageWriter"
import { Message } from "../../constants"

export class RequestMasterDataPayload implements BasePayload {
    build(): Uint8Array {
        let messageWriter = new MessageWriter()

        messageWriter.writeUint8(Message.MSG_ID_RPC_CALL)

        let data = {
            method: 'RemoteInterface.getAll',
            params: [
                { type: 'string', value: 'de' },
                { type: 'int', value: 4 },
                { type: 'int', value: 0 },
                { type: 'int', value: 0 }
            ]
        }

        messageWriter.writeString(JSON.stringify(data))

        return messageWriter.toUint8Array()
    }
}
