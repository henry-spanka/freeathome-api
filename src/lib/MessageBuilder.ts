import { KeepAliveMessage } from "./messages/KeepAliveMessage"
import { SubscribeMessage } from "./messages/SubscribeMessage"
import { CapabilityAnnouncementMessage } from "./messages/CapabilityAnnouncementMessage"
import { RequestMasterDataPayload } from "./messages/payloads/RequestMasterDataPayload"
import { SubscribedMessage } from "./messages/SubscribedMessage"
import { CryptExchangeLocalKeysMessage } from "./messages/CryptExchangeLocalKeysMessage"
import { CryptMessage } from "./messages/CryptMessage"
import { StartNewSessionPayload } from "./messages/payloads/StartNewSessionPayload"
import { LoginSaslPayload } from "./messages/payloads/LoginSaslPayload"
import { SaslResponsePayload } from "./messages/payloads/SaslResponsePayload"
import { Crypto } from "./Crypto"
import { SetDatapointPayload } from "./messages/payloads/SetDatapointPayload"

export class MessageBuilder {
    private username: string
    private usedIds: boolean[] = []
    private crypto: Crypto

    constructor(username: string, crypto: Crypto) {
        this.username = username
        this.crypto = crypto
    }

    private getMessageId(): number {
        let id = new Date().valueOf()

        while (this.usedIds[id]) {
            id++
        }

        this.usedIds[id] = true

        return id
    }

    buildKeepAliveMessage(id: number) {
        return new KeepAliveMessage(id).build(this.getMessageId())
    }

    buildSubscribeMessage(): any {
        return new SubscribeMessage(this.username).build(this.getMessageId())
    }

    buildSubscribedMessage(): any {
        return new SubscribedMessage(this.username).build(this.getMessageId())
    }

    buildCapabilityAnnouncementMessage(): any {
        return new CapabilityAnnouncementMessage().build(this.getMessageId())
    }

    buildRequestMasterDataMessage(): any {
        let payload = this.crypto!.encryptPayload(new RequestMasterDataPayload().build())
        return new CryptMessage(payload).build(this.getMessageId())
    }

    buildCryptExchangeLocalKeysMessage(key: string): any {
        return new CryptExchangeLocalKeysMessage(this.username, key).build(this.getMessageId())
    }

    buildStartNewSessionMessage(sessionIdentifier: string): any {
        let payload = new StartNewSessionPayload(sessionIdentifier).build()

        return new CryptMessage(payload).build(this.getMessageId())
    }

    buildLoginSaslMessage(scram: string) {
        let payload = this.crypto!.encryptPayload(new LoginSaslPayload(scram).build())

        return new CryptMessage(payload).build(this.getMessageId())
    }

    buildSaslResponseMessage(clientFinal: string) {
        let payload = this.crypto!.encryptPayload(new SaslResponsePayload(clientFinal).build())

        return new CryptMessage(payload).build(this.getMessageId())
    }

    buildSetDatapointMessage(serialNo: string, channel: string, datapoint: string, value: string) {
        let payload = this.crypto!.encryptPayload(new SetDatapointPayload(serialNo, channel, datapoint, value).build())

        return new CryptMessage(payload).build(this.getMessageId())
    }
}
