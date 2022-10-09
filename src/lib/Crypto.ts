import { SystemAccessPointUser, SystemAccessPointAuthMethod } from "./SystemAccessPointSettings"
import * as asmCrypto from 'asmcrypto.js'
import sodium from 'libsodium-wrappers-sumo'
import { MessageReader } from "./MessageReader"
import { ClientScramHandler } from "./ClientScramHandler"
import { MessageWriter } from "./MessageWriter"
import { General, Message } from "./constants"

interface SystemAccessPointResponse {
    data: string
    totalByteLength: number
}

export class Crypto {
    private user: SystemAccessPointUser
    private password: string
    private keypair: sodium.KeyPair | undefined
    private cryptoIntermediateData: Uint8Array | undefined
    private clientScramHandler: ClientScramHandler
    private __Yt: Uint8Array | undefined
    private messageCounter: number = 1
    private __Yp: Uint8Array[] = []
    private __Ys: string | undefined
    private __Yx: Uint8Array | undefined
    private __Yq: any = []

    constructor(user: SystemAccessPointUser, password: string) {
        this.user = user
        this.password = password

        this.clientScramHandler = new ClientScramHandler()
    }

    async ready() {
        await sodium.ready
    }

    generateKeypair() {
        this.keypair = sodium.crypto_box_keypair()
    }

    private generateSharedKey(): Uint8Array {
        let authMethod: SystemAccessPointAuthMethod = this.user.authmethods["SCRAM-SHA-256"]

        let iterations = authMethod.iterations
        let salt = asmCrypto.base64_to_bytes(authMethod.salt)

        return asmCrypto.Pbkdf2HmacSha256(sodium.from_string(this.password), salt, iterations, 32)
    }

    generateLocalKey() {
        let sharedKey = this.generateSharedKey()

        let buffer = sodium.randombytes_buf(16)

        let authenticator = this.makeAuthenticator(sharedKey, buffer)

        sodium.memzero(sharedKey)

        return authenticator
    }

    static uint8_to_base64(array: Uint8Array): string {
        return Buffer.from(array).toString('base64')
    }

    static base64_to_uint8(data: string): Uint8Array {
        return Uint8Array.from(Buffer.from(data, 'base64'))
    }

    static string_to_uint8(data: string): Uint8Array {
        return sodium.from_string(data)
    }

    static uint8_to_string(data: Uint8Array): string {
        return sodium.to_string(data)
    }

    private makeAuthenticator(message: Uint8Array, key: Uint8Array): Uint8Array {
        let length = 64

        let generic_hash = sodium.crypto_generichash(sodium.crypto_onetimeauth_KEYBYTES, message, key)

        if (!generic_hash) {
            throw Error("generic hash undefined")
        }

        let token = sodium.crypto_onetimeauth(this.keypair!.publicKey, generic_hash)

        sodium.memzero(generic_hash)

        if (this.keypair!.publicKey.length + key.length + token.length !== length) {
            throw Error("Unexpected token size")
        }

        let authenticator = new Uint8Array(64)
        authenticator.set(this.keypair!.publicKey, 0)
        authenticator.set(key, this.keypair!.publicKey.length)
        authenticator.set(token, this.keypair!.publicKey.length + key.length)

        return authenticator
    }

    completeKeyExchange(data: Uint8Array): string {
        let fN = 0
        let fR = 25

        if (data.length < 8) {
            throw new Error("Invalid KeyExchange response")
        }

        let fL = new DataView(data.buffer)
        let pos = 0
        let keyExchangeVersion = fL.getInt32(pos, true)
        pos += 4

        if (keyExchangeVersion !== 2) {
            throw new Error("Unexpected KeyExchange version " + keyExchangeVersion)
        }

        let errorCode = fL.getInt32(pos, true)
        pos += 4
        if (errorCode !== fN && errorCode !== fR) {
            throw new Error("received error code " + errorCode + " as result of KeyExchange")
        }
        let fC = 16
        let fI = 16
        if (pos + fC + fI > data.length) {
            throw new Error("Insufficient data length in KeyExchange response, have only " + data.length + " bytes")
        }

        let fD = data.subarray(pos, pos + fC)
        pos += fC
        let fS = data.subarray(pos, pos + fI)
        pos += fI

        let sharedKey = this.generateSharedKey()

        let authenticatorValid = this.validateAuthenticator(data.subarray(pos), fD, fS, sharedKey)
        sodium.memzero(sharedKey)

        if (!authenticatorValid) {
            throw new Error("Failed to authenticate key exchange data")
        }

        let fK = this.extractData(data, pos)

        pos += fK.totalByteLength
        let sessionIdentifier = fK.data
        let flags = this.extractData(data, pos)
        pos += flags.totalByteLength
        if (errorCode === fR) {
            throw new Error("KeyExchange response returned ALREADYTHERE - currently not supported")
        }

        let fP = 32
        if (data.length < pos + fP) {
            throw new Error("KeyExchange response buffer too short, expected " + fP + " bytes for public key at pos " + pos + ", have length " + data.length)
        }

        let publicKey = data.subarray(pos, pos + fP)

        this.cryptoIntermediateData = this.generateCryptoIntermediateData(publicKey)

        return sessionIdentifier
    }

    private generateCryptoIntermediateData(publicKey: Uint8Array): Uint8Array {
        return sodium.crypto_box_beforenm(publicKey, this.keypair!.privateKey)
    }

    private extractData(fX: Uint8Array, fY: number): SystemAccessPointResponse {
        if (!fX || fX.length < fY + 4) {
            throw new Error("Cannot read string from buffer, buffer not large enough")
        }

        let fW = new DataView(fX.buffer)
        let length = fW.getUint32(fY, true)

        if (length === 0) {
            throw new Error("Failed to read keyId from KeyExchange response")
        }

        if (length > 20000000) {
            throw new Error("Cannot read string from buffer, string length exceeds allowed maximum size")
        }

        if (length > fX.length - fY - 4) {
            throw new Error("Cannot read string from buffer at pos " + fY + ", string length " + length + " exceeds buffer size " + fX.length)
        }

        return <SystemAccessPointResponse>{
            data: sodium.to_string(fX.subarray(fY + 4, fY + 4 + length)),
            totalByteLength: 4 + length
        }
    }

    private validateAuthenticator(message2: Uint8Array, message: Uint8Array, hash: Uint8Array, key: Uint8Array): boolean {
        let keyHash = sodium.crypto_generichash(sodium.crypto_onetimeauth_KEYBYTES, key, message)
        if (!keyHash) {
            return false
        }

        let result = sodium.crypto_onetimeauth_verify(hash, message2, keyHash)
        sodium.memzero(keyHash)
        return result
    }

    decryptPubSub(data: string, type: string = 'update'): Uint8Array {
        let bytes = asmCrypto.base64_to_bytes(data)

        if (!bytes || bytes.length == 0) {
            throw new Error("Can not decrypt empty pubsub")
        }

        let nonce = bytes.slice(0, sodium.crypto_box_NONCEBYTES)

        let messageReader = new MessageReader(bytes.slice(16, 24))

        var dF = messageReader.readUint64()
        if (!this.__Yq[type]) {
            this.__Yq[type] = {
                'sequenceCounter': 0,
                'skippedSymmetricSequences': new Set()
            }
        }
        var dH = this.__Yq[type].sequenceCounter
        if (dF < dH) {
            if (!this.__Yq[type].skippedSymmetricSequences.has(dF)) {
                throw new Error("Unexpected sequence in received symmetric nonce " + dF + '(' + dH + ')')
            }

            this.__Yq[type].skippedSymmetricSequences.delete(dF)
        }

        if (dF > dH) {
            var c = dF - dH - 1
            if (c > 16) {
                c = 16
            }

            var x = dF - 1
            var i
            for (i = 0; i < c; i++) {
                if (x === 0) {
                    break
                }

                this.__Yq[type].skippedSymmetricSequences.add(x)
                x--
            }

            if (this.__Yq[type].skippedSymmetricSequences.size > 32) {
                var a = Array.from(this.__Yq[type].skippedSymmetricSequences).sort()
                var dK = a.length - 32
                for (i = 0; i < dK; i++) {
                    this.__Yq[type].skippedSymmetricSequences.delete(a[i])
                }
            }
        }

        this.__Yq[type].sequenceCounter += 1
        var dL = sodium.crypto_secretbox_open_easy(bytes.slice(sodium.crypto_box_NONCEBYTES), nonce, this.__Yx!)
        if (!dL) {
            throw new Error("Failed to decrypt message")
        }

        return dL
    }

    getClientScramHandler(): ClientScramHandler {
        return this.clientScramHandler
    }

    private __YC(): Uint8Array {
        let cl = new MessageWriter()
        cl.writeBlob(this.__Yt!)
        cl.writeUint32(this.messageCounter++)
        cl.writeUint32(0)

        if (this.messageCounter > 4294967296) {
            throw new Error("MessageCounter exceeds valid range")
        }

        cl.writeBlob(sodium.randombytes_buf(8))
        return cl.toUint8Array()
    }

    __setYt(data: Uint8Array) {
        this.__Yt = data
    }

    __setYs(data: string) {
        this.__Ys = data
    }

    encryptPayload(data: Uint8Array): Uint8Array {
        if (data.length > 10485760) {
            throw new Error("__buildMessageEncrypted: message is too large: " + data.length)
        }

        var cq = 0
        /*if (!this.__Yv) {
            cq |= 2
        }*/
        cq |= 2

        var cs = this.__YC()

        if (cs == null) {
            throw new Error("MessageCounter exceeds valid range")
        }

        var cn = cs.length + General.FH_CRYPTO_MAC_LENGTH + data.length
        var ct = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
        var cm = new Uint8Array(ct.length + data.length)
        cm.set(ct, 0)
        cm.set(data, ct.length)

        var cr = sodium.crypto_box_easy_afternm(cm, cs, this.cryptoIntermediateData!)
        if (!cr || cr.length === 0) {
            throw new Error("Failed to encrypt message")
        }

        if (cr.length !== cn) {
            throw new Error("Internal error: Unexpected size of encrypted data array")
        }

        this.__Yp.push(ct)
        var co = new MessageWriter()
        co.writeUint8(Message.MSG_ID_CRYPTED_CONTAINER_TO_SERVER)
        co.writeUint8(cq)
        co.writeString(this.__Ys!)
        co.writeBlob(cs)
        co.writeUint32(cn)
        co.writeBlob(cr)

        return co.toUint8Array()
    }

    decryptPayload(cJ: MessageReader): MessageReader {
        var cS = cJ.readUint8()
        var cQ = cJ.readUint32()
        var cT = cJ.getRemainingData()
        if (cT.length !== cQ) {
            throw new Error("Failed to decrypt container: invalid message length " + cQ + ', expected ' + cT.length)
        }

        if (cQ < sodium.crypto_box_MACBYTES) {
            throw new Error("Failed to decrypt container: invalid message length " + cQ)
        }

        var cX: Uint8Array | null = null
        var cM = this
        var cK = this.__Yp.some(function (da, cY) {
            cX = sodium.crypto_box_open_easy_afternm(cT, da, cM.cryptoIntermediateData!)
            if (cX != null) {
                cM.__Yp.splice(cY, 1)
                return true
            }
        })

        if (!cK || cX == null) {
            throw new Error("Failed to decrypt encrypted container")
        }

        var cW = new MessageReader(cX)
        if (cS & 2) {
            this.__Yx = cW.readBlob(sodium.crypto_secretbox_KEYBYTES)
            var cV = cW.readUint16()
            for (var i = 0; i < cV; i++) {
                var cO = cW.readString()
                var cL = cO.lastIndexOf('/')
                if (cL === -1) {
                    continue
                }
                var cR = cO.substr(cL + 1)
                if (cR.endsWith('_encrypted')) {
                    cR = cR.substring(0, cR.length - 10) // - length of _encrypted (10)
                }
                var cU = cW.readUint64()
                this.__Yq[cR] = {
                    'sequenceCounter': cU,
                    'skippedSymmetricSequences': new Set()
                }
            }

            //this.__Yv = true

            if (cX !== null) {
                cX = (cX as Uint8Array).slice(sodium.crypto_secretbox_KEYBYTES + 8)
            }
        }

        return cW

    }

    __YJ(messageReader: MessageReader): string {
        var dq = messageReader.readString()

        this.clientScramHandler.setServerFirst(dq, this.password)

        let clientFinal = this.clientScramHandler.createClientFinal()

        if (clientFinal == null || clientFinal.length === 0) {
            throw new Error("Failed to send login response message, failed to create clientFinal")
        }

        return clientFinal
    }

    _YK(messageReader: MessageReader) {
        var dr = messageReader.readString()
        this.clientScramHandler.setServerFinal(dr)
    }
}
