import { BasePayload } from "./BasePayload"
import { MessageWriter } from "../../MessageWriter"
import { Message } from "../../constants"

export class SetDatapointPayload implements BasePayload {
    private serialNo: string
    private channel: string
    private datapoint: string
    private value: string

    constructor(serialNo: string, channel: string, datapoint: string, value: string) {
        this.serialNo = serialNo
        this.channel = channel
        this.datapoint = datapoint
        this.value = value
    }

    build(): Uint8Array {
        let messageWriter = new MessageWriter()

        messageWriter.writeUint8(Message.MSG_ID_RPC_CALL)

        let data = {
            method: 'RemoteInterface.setDatapoint',
            params: [
                { type: 'string', value: this.serialNo + '/' + this.channel + '/' + this.datapoint },
                { type: 'string', value: this.value }
            ]
        }

        messageWriter.writeString(JSON.stringify(data))

        return messageWriter.toUint8Array()
    }
}
