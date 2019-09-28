import { client as Client } from "@xmpp/client"
import { Application } from "./Application"
import { MessageBuilder } from "./MessageBuilder"
import Axios from "axios"
import { SystemAccessPointSettings, SystemAccessPointUser } from "./SystemAccessPointSettings"
import compareVersions from "compare-versions"
import { Configuration } from "./Configuration"
import { Crypto } from "./Crypto"
import { MessageReader } from "./MessageReader"
import { Message, Result, General } from "./constants"
import pako from "pako"
import { XmlParser } from "./XmlParser"

export class SystemAccessPoint {
    private configuration: Configuration
    private application: Application
    private client: Client | undefined
    private messageBuilder: MessageBuilder | undefined
    private crypto: Crypto | undefined
    private online: boolean = false
    private settings: SystemAccessPointSettings | undefined
    private connectedAs: string | undefined
    private user: SystemAccessPointUser | undefined
    private keepAliveMessageId: number = 1
    private keepAliveTimer: NodeJS.Timeout | null = null
    private deviceData: any = {}
    private subscribed: boolean = false

    constructor(configuration: Configuration, application: Application) {
        this.configuration = configuration
        this.application = application
    }

    private async createClient() {
        this.settings = await this.getSettings()

        let user: SystemAccessPointUser | undefined

        for (let tempUser of this.settings.users) {
            if (tempUser.name == this.configuration.username) {
                user = tempUser
                break
            }
        }

        if (user === undefined) {
            Application.error('The user does not exist in the System Access Point\'s configuration')
            Application.exit(1)
        }

        this.user = user

        let username = user!.jid.split('@')[0]

        this.client = new Client({
            service: 'ws://' + this.configuration.hostname + ':5280/xmpp-websocket',
            domain: 'busch-jaeger.de',
            resource: 'freeathome-api',
            username: username,
            password: this.configuration.password
        })

        this.crypto = new Crypto(user!, this.configuration.password)

        this.messageBuilder = new MessageBuilder(username, this.crypto)

        this.registerHandlers()
    }

    private async getSettings(): Promise<SystemAccessPointSettings> {
        return <SystemAccessPointSettings>(await Axios.get('http://' + this.configuration.hostname + '/settings.json')).data
    }

    private registerHandlers() {
        if (this.client === undefined) {
            throw new Error("Unknown error occurred! this.client undefined.")
        }

        this.client.on('error', err => {
            Application.error(err.toString())
            Application.exit(1)
        })

        this.client.on('offline', () => {
            Application.log('Access Point has gone offline')
            this.online = false
            this.subscribed = false
            this.disableKeepAliveMessages()
        })

        this.client.on('stanza', async stanza => {
            Application.debug('Received stanza:', stanza)

            if (stanza.attrs.from == 'mrha@busch-jaeger.de/rpc' && stanza.attrs.to == this.connectedAs) {
                if (stanza.name == 'iq') {
                    if (stanza.attrs.type == 'result') {
                        if (stanza.children.length > 0) {
                            let data = Crypto.base64_to_uint8(stanza.getChild('query').getChild('methodResponse').getChild('params').getChild('param').getChild('value').getChildText('base64'))

                            if (!this.online) {
                                Application.log("Received Local Key")

                                let sessionIdentifier = this.crypto!.completeKeyExchange(data)
                                this.online = true

                                await this.sendMessage(this.messageBuilder!.buildStartNewSessionMessage(sessionIdentifier))
                                Application.log("Sent New Session Request")
                            } else {
                                await this.handleIQMessage(data)
                            }
                        }
                    }
                }
            } else if (stanza.name == 'presence') {
                if (stanza.attrs.type == 'subscribed') {

                    await this.sendMessage(this.messageBuilder!.buildSubscribedMessage())
                    this.subscribed = true
                    Application.log("Sent Subscription Confirmation")
                }
            } else if (stanza.name == 'message' && stanza.attrs.type == 'headline') {
                this.parseEncryptedUpdates(stanza)
            }
        })

        this.client.on('online', async address => {
            Application.log("Connected as " + address.toString())
            this.connectedAs = address.toString()

            let key = this.crypto!.generateLocalKey()

            await this.sendMessage(this.messageBuilder!.buildCryptExchangeLocalKeysMessage(Crypto.uint8_to_base64(key)))
            Application.log("Sent Authenticator")
        })

        // Debug
        this.client.on('status', status => {
            Application.debug('Received new status:', status)
        })
        this.client.on('input', input => {
            Application.debug('Received new input data:', input)
        })
        this.client.on('output', output => {
            Application.debug('Received new output data:', output)
        })

    }

    private parseEncryptedUpdates(stanza: any) {
        let items = stanza.getChild('event').getChild('items').getChildren('item').filter((item: any) => item.getChild('update').attrs.xmlns == 'http://abb.com/protocol/update_encrypted')

        for (let item of items) {
            let data = item.getChild('update').getChildText('data')
            let update = this.parseDecryptedData(new MessageReader(this.crypto!.decryptPubSub(data)))

            this.applyIncrementalUpdate(XmlParser.parseUpdate(update))
        }
    }

    private parseDecryptedData(messageReader: MessageReader): string {
        let length = messageReader.readUint32BE()

        let bytes: Uint8Array

        try {
            bytes = pako.inflate(messageReader.getRemainingData())
        } catch (e) {
            throw new Error("Failed to uncompress received data, error: " + e.toString())
        }

        if (bytes.length != length) {
            throw new Error("Unexpected uncompressed data length, have=" + bytes.length + ", expected=" + length)
        }

        return Crypto.uint8_to_string(bytes)
    }

    private async handleIQMessage(message: Uint8Array) {
        let messageReader = new MessageReader(message)

        let type = messageReader.readUint8()

        switch (type) {
            case Message.MSG_ID_NEW_SESSION_RESULT:
                await this.handleNewSessionResult(messageReader)
                break

            case Message.MSG_ID_CRYPTED_CONTAINER_TO_CLIENT:
                await this.handleCryptedContainerToClient(messageReader)
                break

            case Message.MSG_ID_ERROR_RESPONSE:
                let errorcode = messageReader.readUint32()
                Application.error(messageReader.readString())
                Application.exit(1)
                break

            default:
                throw new Error("Not Implemented")
        }
    }

    private async handleNewSessionResult(messageReader: MessageReader) {
        let result = messageReader.readUint32()

        if (result != Result.RESULT_CODE_OK) {
            throw new Error("Failed to establish session")
        }

        let version = messageReader.readUint32()

        if (version !== General.PROTOCOL_VERSION) {
            Application.log("Unknown Protocol Version detected. Ignoring ...")
        }

        let Ys = messageReader.readString()
        let Yt = messageReader.readBlob(8)
        this.crypto!.__setYs(Ys)
        this.crypto!.__setYt(Yt)

        let jid = this.user!.jid

        let scram = this.crypto!.getClientScramHandler().createClientFirst(jid)

        await this.sendMessage(this.messageBuilder!.buildLoginSaslMessage(scram))
        Application.log("Sent Login SASL Message")
    }

    private async handleCryptedContainerToClient(messageReader: MessageReader) {
        let data = this.crypto!.decryptPayload(messageReader)

        var msgId = data.readUint8()
        switch (msgId) {
            case Message.MSG_ID_RPC_CALL_RESULT:
                Application.debug("Received RPC Call Result Message")
                this.handleRpcCallResult(data)
                break

            case Message.MSG_ID_ERROR_RESPONSE:
                //cE = this.__YH(cC)
                throw new Error("Not Implemented")

            case Message.MSG_ID_SASL_CHALLENGE:
                Application.log("Received SASL Challenge")
                let clientFinal = this.crypto!.__YJ(data)
                await this.sendMessage(this.messageBuilder!.buildSaslResponseMessage(clientFinal))
                Application.log("Sent SASL Challenge Response")
                break

            case Message.MSG_ID_SASL_LOGIN_SUCCESS:
                Application.log("Received SASL Login Confirmation")
                Application.log("Successfully Authenticated")
                this.crypto!._YK(data)

                await this.sendMessage(this.messageBuilder!.buildCapabilityAnnouncementMessage())
                Application.log("Announced Capabilities to System Access Point")

                await this.sendMessage(this.messageBuilder!.buildRequestMasterDataMessage())
                Application.log("Requested Master Data Structure from System Access Point")
                break

            default:
                throw new Error("Not Implemented")
        }
    }

    private async handleRpcCallResult(messageReader: MessageReader) {
        let result = messageReader.readUint32()

        if (result !== Result.RESULT_CODE_OK) {
            throw new Error("rpcCallResult with code " + result)
        }

        let data = this.parseDecryptedData(messageReader)

        if (!data) {
            throw new Error("rpcCallResult failed to uncompress remote data.")
        }

        // Probably not a master update so we're ignoring it
        if (data.length <= 10240) {
            return
        }

        let message

        try {
            message = JSON.parse(data)
        } catch (e) {
            throw new Error("Failed to parse rpc call result JSON: " + e.toString())
        }

        Application.log("Received Master Update from System Acccess Point")

        this.deviceData = XmlParser.parseMasterUpdate(message.value)

        if (!this.subscribed) {
            await this.sendMessage(this.messageBuilder!.buildSubscribeMessage())
            Application.log("Sent Subscription Request")
        }

    }

    private async sendMessage(message: any) {
        await this.client!.send(message)
    }

    async connect() {
        await this.createClient()
        await this.crypto!.ready()
        this.crypto!.generateKeypair()

        if (compareVersions(this.settings!.flags.version, '2.3.1') > 0) {
            Application.error('Your System Access Point\'s firmware must be at least 2.3.1')
            Application.exit(1)
        }

        try {
            await this.client!.start()
            this.sendKeepAliveMessages()
        } catch (e) {
            Application.error('Could not connect to System Access Point', e.toString())
            Application.exit(1)
        }
    }

    async disconnect() {
        Application.log("Disconnecting from the System Access Point")
        await this.client!.stop()
    }

    private async sendKeepAliveMessage() {
        await this.sendMessage(this.messageBuilder!.buildKeepAliveMessage(this.keepAliveMessageId++))
    }

    private sendKeepAliveMessages() {
        this.keepAliveTimer = setInterval(() => this.sendKeepAliveMessage(), 15000)
    }

    private disableKeepAliveMessages() {
        if (this.keepAliveTimer !== null) {
            clearInterval(this.keepAliveTimer)
            this.keepAliveTimer = null
        }
    }

    private applyIncrementalUpdate(update: any) {
        if (update == null || !(update instanceof Object)) {
            throw new Error("Invalid Incremental Update")
        }

        for (const [serialNo, device] of Object.entries<any>(update)) {
            if (!(serialNo in this.deviceData)) {
                this.deviceData[serialNo] = {
                    serialNumber: serialNo,
                    channels: {}
                }
            }

            if (device.channels != null) {
                for (const [channelNo, channel] of Object.entries<any>(device.channels)) {
                    if (!(channelNo in this.deviceData[serialNo]['channels'])) {
                        this.deviceData[serialNo]['channels'][channelNo] = {
                            datapoints: {}
                        }
                    }

                    if (channel.datapoints != null) {
                        for (const [datapointNo, value] of Object.entries<any>(channel.datapoints)) {
                            this.deviceData[serialNo]['channels'][channelNo]['datapoints'][datapointNo] = value
                            
                            Application.debug("Updated Datapoint: " + serialNo + '/' + channelNo + '/' + datapointNo + '/' + value)
                        }
                    }
                }
            }
        }

        this.application.broadcastMessage(JSON.stringify({result: update, type: 'update'}))
    }

    async setDatapoint(serialNo: string, channel: string, datapoint: string, value: string) {
        await this.sendMessage(this.messageBuilder!.buildSetDatapointMessage(serialNo, channel, datapoint, value))

        Application.log("Set Datapoint: " + serialNo + '/' + channel + '/' + datapoint + '/' + value)
    }

    getDeviceData(): any {
        if (Object.entries(this.deviceData).length === 0 && this.deviceData.constructor === Object) {
            throw new Error("Device Data was requested before we have initialized it")
        }

        return this.deviceData
    }
}
