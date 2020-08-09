import {MessageBuilder} from "./MessageBuilder"
import Axios from "axios"
import {SystemAccessPointSettings, SystemAccessPointUser} from "./SystemAccessPointSettings"
import compareVersions from "compare-versions"
import {ClientConfiguration} from "./Configuration"
import {Crypto} from "./Crypto"
import {MessageReader} from "./MessageReader"
import {General, Message, Result} from "./constants"
import pako from "pako"
import {XmlParser} from "./XmlParser"
import {ConsoleLogger, Logger} from "./Logger";
import {GuardedClient} from "./GuardedClient";
import {Subscriber} from "./Subscriber";
import {Element, childrenEqual} from "ltx"

export class SystemAccessPoint {
    private configuration: ClientConfiguration
    private readonly subscriber: Subscriber
    private client: GuardedClient | undefined
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

    private logger : Logger = new ConsoleLogger()

    constructor(configuration: ClientConfiguration, subscriber: Subscriber, logger: Logger | null) {
        this.configuration = configuration
        this.subscriber = subscriber
        if (logger !== undefined && logger !== null){
            this.logger = logger
        }
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
            this.logger.error('The user does not exist in the System Access Point\'s configuration')
            throw new Error(`User ${this.configuration.username} does not exist`)
        }

        this.user = user

        let username = user!.jid.split('@')[0]

        this.client = new GuardedClient(this.subscriber, {
            service: 'ws://' + this.configuration.hostname + ':5280/xmpp-websocket',
            domain: 'busch-jaeger.de',
            resource: 'freeathome-api',
            username: username,
            password: this.configuration.password
        }, this.logger)



        this.crypto = new Crypto(user!, this.configuration.password)

        this.messageBuilder = new MessageBuilder(username, this.crypto)

        this.registerHandlers()
    }

    private async getSettings(): Promise<SystemAccessPointSettings> {
        let response = await Axios.get('http://' + this.configuration.hostname + '/settings.json')

        if (response.status != 200) {
            this.logger.error("Unexpected status code from System Access Point while retrieving settings.json.")
            throw new Error("Unexpected status code from System Access Point while retrieving settings.json.")
        }

        if (!('flags' in response.data) || !('version' in response.data.flags)) {
            this.logger.error("Flags key does not exist in settings.json.")
            throw new Error("Flags key does not exist in settings.json.")
        }

        if (!('users' in response.data || !Array.isArray(response.data.users))) {
            this.logger.error("Users key does not exist in settings.json.")
            throw new Error("Users key does not exist in settings.json.")
        }
        
        return <SystemAccessPointSettings>response.data
    }

    private registerHandlers() {
        if (this.client === undefined) {
            throw new Error("Unknown error occurred! this.client undefined.")
        }

        this.client.on('error', err => {
            this.logger.error(err.toString())
            this.subscriber.broadcastMessage({
                type: "error",
                result: err
            })
        })

        this.client.on('offline', () => {
            this.logger.log('Access Point has gone offline')
            this.online = false
            this.subscribed = false
            this.subscriber.broadcastMessage({
                'type': 'subscribed',
                'result': false
            })
            this.disableKeepAliveMessages()
        })

        this.client.guardedOn('stanza', async stanza => {
            this.logger.debug('Received stanza:', stanza)

            if (stanza.attrs.from == 'mrha@busch-jaeger.de/rpc' && stanza.attrs.to == this.connectedAs) {
                if (stanza.name == 'iq') {
                    if (stanza.attrs.type == 'result') {
                        if (stanza.children.length > 0) {
                            let data = Crypto.base64_to_uint8(stanza.getChild('query').getChild('methodResponse').getChild('params').getChild('param').getChild('value').getChildText('base64'))

                            if (!this.online) {
                                this.logger.log("Received Local Key")

                                let sessionIdentifier = this.crypto!.completeKeyExchange(data)
                                this.online = true

                                await this.sendMessage(this.messageBuilder!.buildStartNewSessionMessage(sessionIdentifier))
                                this.logger.log("Sent New Session Request")
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
                    this.subscriber.broadcastMessage({
                        'type': 'subscribed',
                        'result': true
                    })
                    this.logger.log("Sent Subscription Confirmation")
                }
            } else if (stanza.name == 'message' && stanza.attrs.type == 'headline') {
                this.handleEvent(stanza)
            }
        })

        this.client.on('online', async address => {
            this.logger.log("Connected as " + address.toString())
            this.connectedAs = address.toString()

            let key = this.crypto!.generateLocalKey()

            await this.sendMessage(this.messageBuilder!.buildCryptExchangeLocalKeysMessage(Crypto.uint8_to_base64(key)))
            this.logger.log("Sent Authenticator")
        })

        // Debug
        this.client.on('status', status => {
            this.logger.debug('Received new status:', status)
        })
        this.client.on('input', input => {
            this.logger.debug('Received new input data:', input)
        })
        this.client.on('output', output => {
            this.logger.debug('Received new output data:', output)
        })

    }

    private handleEvent(stanza: Element) {
        let event = stanza.getChild('event')

        if (event === undefined) {
            return
        }
        
        let items = event.getChild('items')

        if (items === undefined) {
            return
        }

        items.getChildren('item').forEach(item => {
            item.children.forEach(child => {
                let data: string = this.unwrapEventData(child)

                switch (child.name) {
                    case 'update':
                        this.applyIncrementalUpdate(XmlParser.parseUpdate(data))
                        break
                    case 'log':
                        this.logger.warn("Received Log Data which is currently not supported: " + data)
                        break
                }
            })
        })
    }

    private unwrapEventData(item: Element): string {
        let data: string | null = null;

        switch (item.name) {
            case 'update':
                data = item.getChildText('data')
                break
            case 'log':
                data = item.getChildText('message')
                break
            default:
                throw new Error("Cannot unwrap event data!")
        }

        if (data === null) {
            throw new Error("Event data is null!")
        }

        let xmlns: string = item.getAttr('xmlns')

        if (!xmlns.endsWith("_encrypted")) {
            throw new Error("Received data which is not encrypted!")
        }

        return this.parseDecryptedData(new MessageReader(this.crypto!.decryptPubSub(data, item.name)))
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
                const errorcode = messageReader.readUint32()
                const messages = messageReader.readString();
                this.logger.error(messages)
                throw Error(`Error response: ${messages}`);
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
            this.logger.log("Unknown Protocol Version detected. Ignoring ...")
        }

        let Ys = messageReader.readString()
        let Yt = messageReader.readBlob(8)
        this.crypto!.__setYs(Ys)
        this.crypto!.__setYt(Yt)

        let jid = this.user!.jid

        let scram = this.crypto!.getClientScramHandler().createClientFirst(jid)

        await this.sendMessage(this.messageBuilder!.buildLoginSaslMessage(scram))
        this.logger.log("Sent Login SASL Message")
    }

    private async handleCryptedContainerToClient(messageReader: MessageReader) {
        let data = this.crypto!.decryptPayload(messageReader)

        var msgId = data.readUint8()
        switch (msgId) {
            case Message.MSG_ID_RPC_CALL_RESULT:
                this.logger.debug("Received RPC Call Result Message")
                this.handleRpcCallResult(data)
                break

            case Message.MSG_ID_ERROR_RESPONSE:
                //cE = this.__YH(cC)
                throw new Error("Not Implemented")

            case Message.MSG_ID_SASL_CHALLENGE:
                this.logger.log("Received SASL Challenge")
                let clientFinal = this.crypto!.__YJ(data)
                await this.sendMessage(this.messageBuilder!.buildSaslResponseMessage(clientFinal))
                this.logger.log("Sent SASL Challenge Response")
                break

            case Message.MSG_ID_SASL_LOGIN_SUCCESS:
                this.logger.log("Received SASL Login Confirmation")
                this.logger.log("Successfully Authenticated")
                this.crypto!._YK(data)

                await this.sendMessage(this.messageBuilder!.buildCapabilityAnnouncementMessage())
                this.logger.log("Announced Capabilities to System Access Point")

                await this.sendMessage(this.messageBuilder!.buildRequestMasterDataMessage())
                this.logger.log("Requested Master Data Structure from System Access Point")
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

        this.logger.log("Received Master Update from System Acccess Point")

        this.deviceData = XmlParser.parseMasterUpdate(message.value)

        if (!this.subscribed) {
            await this.sendMessage(this.messageBuilder!.buildSubscribeMessage())
            this.logger.log("Sent Subscription Request")
        }

    }

    private async sendMessage(message: any) {
        await this.client!.send(message)
    }

    async connect() {
        await this.createClient()
        await this.crypto!.ready()
        this.crypto!.generateKeypair()

        if (compareVersions(this.settings!.flags.version, '2.3.1') < 0) {
            throw Error('Your System Access Point\'s firmware must be at least 2.3.1');
        }

        try {
            await this.client!.start()
            this.sendKeepAliveMessages()
        } catch (e) {
            this.logger.error('Could not connect to System Access Point', e.toString())
            throw Error("Could not connect to System Access Point")
        }
    }

    async disconnect() {
        this.logger.log("Disconnecting from the System Access Point");
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
            } else {
                update[serialNo]['deviceId'] = this.deviceData[serialNo]['deviceId']
                update[serialNo]['typeName'] = this.deviceData[serialNo]['typeName']
            }

            update[serialNo]['serialNumber'] = serialNo

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
                            
                            this.logger.debug("Updated Datapoint: " + serialNo + '/' + channelNo + '/' + datapointNo + '/' + value)
                        }
                    }
                }
            }
        }

        this.subscriber.broadcastMessage({result: update, type: 'update'})
    }

    async setDatapoint(serialNo: string, channel: string, datapoint: string, value: string) {
        await this.sendMessage(this.messageBuilder!.buildSetDatapointMessage(serialNo, channel, datapoint, value))

        this.logger.log("Set Datapoint: " + serialNo + '/' + channel + '/' + datapoint + '/' + value)
    }

    getDeviceData(): any {
        if (Object.entries(this.deviceData).length === 0 && this.deviceData.constructor === Object) {
            throw new Error("Device Data was requested before we have initialized it")
        }

        return this.deviceData
    }
}
