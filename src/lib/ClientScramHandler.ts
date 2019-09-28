import * as asmCrypto from 'asmcrypto.js'
import sodium from 'libsodium-wrappers-sumo'

export class ClientScramHandler {
    private scram: string | undefined
    private __YQ: string | undefined
    private __YX: string | undefined
    private __YT: number | undefined
    private __YS: Uint8Array | undefined
    private __YP: number = 32
    private __YU: Uint8Array | undefined
    private __YV: Uint8Array | undefined
    private __YW: Uint8Array | undefined

    createClientFirst(P: string) {
        var O = 32
        var buf = sodium.randombytes_buf(32)
        if (!buf || buf.length !== 32) {
            throw new Error("Could not generate random bytes")
        }

        var N = asmCrypto.bytes_to_base64(buf)
        this.scram = 'n,,n=' + P + ',r=' + N

        return this.scram
    }

    createClientFinal() {
        let R = 'c=biws,r=' + this.__YX
        this.__YW = asmCrypto.string_to_bytes(this.scram!.substring(3) + ',' + this.__YQ + ',' + R)

        var S = this.__bac(this.__YU!)
        if (!S) {
            throw new Error("Failed to create client signature")
        }

        for (var i = 0; i < this.__YP; i++) {
            S[i] ^= this.__YU![i]
        }

        var Q = asmCrypto.bytes_to_base64(S)
        R += ',p=' + Q
        return R
    }

    setServerFirst(U: string, password: string) {
        this.__YQ = U
        this.__YX = this.__YY(this.__YQ, 'r')
        var T = this.__YY(this.__YQ, 's')
        var W = this.__YY(this.__YQ, 'i')
        if (this.__YX.length === 0 || T.length === 0 || W.length === 0) {
            throw new Error("Missing one or more parameters in SCRAM-SHA challenge")
        }

        if (T.length < 32) {
            throw new Error("setServerFirst: salt is too short")
        }

        this.__YT = parseInt(W)

        if (!this.__YT || this.__YT < 4096 || this.__YT > 600000) {
            throw new Error("Invalid i parameter in SCRAM-SHA challenge")
        }

        this.__YS = asmCrypto.base64_to_bytes(T)
        if (!this.__YS || this.__YS.length < 32) {
            throw new Error("Failed to decode s parameter of SCRAM-SHA challenge")
        }

        this.__YU = this.__baa(password)
        if (!this.__YU || this.__YU.length <= 0) {
            throw new Error("Failed to create clientKey")
        }

        this.__YV = this.__bab(password)
        if (!this.__YV || this.__YV.length <= 0) {
            throw new Error("Failed to create serverKey")
        }
    }

    setServerFinal(X: string) {
        var Y = this.__YY(X, 'v');
        if (Y == null) {
            throw new Error("setServerFinal: Missing v parameter")
        }

        var bb = new asmCrypto.HmacSha256(this.__YV!).process(this.__YW!).finish().result
        if (!bb || bb.length <= 0) {
            throw new Error("setServerFinal: Failed to calculate HMAC")
        }

        var ba = asmCrypto.bytes_to_base64(bb)

        if (Y !== ba) {
            throw new Error("Failed to verify server SCRAM-SHA signature")
        }
    }

    __YY(be: string, bf: string): string {
        if (be.length < 2) {
            return ""
        }

        var bc = -1
        if (be[0] === bf && be[1] === '=') {
            bc = 0
        } else {
            bc = be.indexOf(',' + bf + '=')
            if (bc === -1) {
                return ""
            }

            bc += 1
        }

        var bd = be.indexOf(',', bc)
        if (bd === -1) {
            bd = be.length
        }

        return be.substring(bc + 2, bd)
    }

    __baa(bh: string): Uint8Array {
        var bj = asmCrypto.Pbkdf2HmacSha256(sodium.from_string(bh), this.__YS!, this.__YT!, this.__YP)
        if (!bj || bj.length <= 0) {
            throw new Error("__createClientKey: PBKDF2_HMAC_SHA256 failed")
        }

        var bi = sodium.from_string('Client Key')
        var bg = new asmCrypto.HmacSha256(bj).process(bi).finish().result

        if (!bg || bg.length <= 0) {
            throw new Error("__createClientKey: HMAC failed")
        }

        return bg
    }
    __bab(bl: string): Uint8Array {
        var bn = asmCrypto.Pbkdf2HmacSha256(sodium.from_string(bl), this.__YS!, this.__YT!, this.__YP)
        if (!bn || bn.length <= 0) {
            throw new Error("__createServerKey: PBKDF2_HMAC_SHA256 failed")
        }

        var bm = sodium.from_string('Server Key')
        var bk = new asmCrypto.HmacSha256(bn).process(bm).finish().result
        if (!bk || bk.length <= 0) {
            throw new Error("__createServerKey: HMAC failed")
        }

        return bk
    }

    __bac(bq: Uint8Array): Uint8Array {
        var bp = new asmCrypto.Sha256().process(bq).finish().result
        var bo = new asmCrypto.HmacSha256(bp!).process(this.__YW!).finish().result
        if (!bo || bo.length <= 0) {
            throw new Error("Failed to create client signature")
        }

        return bo
    }
}
