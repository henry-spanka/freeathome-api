import { Crypto } from "./Crypto"

interface DataEntry {
    type: string
    value: Uint8Array | number
}

export class MessageReader {
    private data: Uint8Array
    private offset: number = 0

    constructor(data: Uint8Array) {
        this.data = data
    }

    readUint8(): number {
        if (this.offset + 1 > this.data.length) {
            throw new Error("Insufficient data for reading")
        }

        return this.data[this.offset++]
    }

    readUint16(): number {
        if (this.offset + 2 > this.data.length) {
            throw new Error("Insufficient data for reading")
        }

        return this.readUint8() | this.readUint8() << 8
    }

    readUint32(): number {
        if (this.offset + 4 > this.data.length) {
            throw new Error("Insufficient data for reading")
        }

        return this.readUint8() | (this.readUint8() << 8) | (this.readUint8() << 16) | (this.readUint8() << 24)
    }

    readUint64(): number {
        if (this.offset + 8 > this.data.length) {
            throw new Error("Insufficient data for reading")
        }
        var g = this.readUint32()
        var f = this.readUint32()
        if (f !== 0) {
            throw new Error("Cannot read 64 bit value: upper 32 bits have value != 0")
        }

        return g
    }

    readUint32BE(): number {
        if (this.offset + 4 > this.data.length) {
            throw new Error("Insufficient data for reading")
        }

        return (this.readUint8() << 24) | (this.readUint8() << 16) | (this.readUint8() << 8) | this.readUint8()
    }

    readString(): string {
        var i = this.readUint32()
        if (this.offset + i > this.data.length) {
            throw new Error("Insufficient data for reading")
        }

        var h = Crypto.uint8_to_string(this.data.slice(this.offset, this.offset + i))
        this.offset += i

        return h
    }

    readBlob(k: number): Uint8Array {
        if (this.offset + k > this.data.length) {
            throw new Error("Insufficient data for reading")
        }

        var j = this.data.slice(this.offset, this.offset + k)
        this.offset += k

        return j
    }

    getOffset(): number {
        return this.offset
    }

    getRemainingData(): Uint8Array {
        return this.data.slice(this.offset)
    }

    getRemainingDataLength(): number {
        if (this.offset >= this.data.length) {
            return 0
        }

        return this.data.length - this.offset
    }
}
