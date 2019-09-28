import { Crypto } from "./Crypto"

interface DataEntry {
    type: string
    value: Uint8Array | number
}

export class MessageWriter {
    private data: DataEntry[] = []

    writeUint8(value: number): void {
        this.data.push({ type: 'uint8', value: value })
    }

    writeUint32(value: number): void {
        this.data.push({ type: 'uint32', value: value })
    }

    writeString(value: string): void {
        if (value.length > 1024 * 1024 * 10) {
            throw new Error("Refusing attempt to write " + value.length + " bytes of data, exceeding valid range.")
        }

        this.data.push({ type: 'string', value: Crypto.string_to_uint8(value) })
    }

    writeBlob(value: Uint8Array): void {
        if (value.length > 1024 * 1024 * 10) {
            throw new Error("Refusing attempt to write " + value.length + " bytes of data, exceeding valid range.")
        }

        this.data.push({ type: 'blob', value: value })
    }

    toUint8Array(): Uint8Array {
        let length = 0
        for (let entry of this.data) {
            switch (entry.type) {
                case 'uint8':
                    length += 1
                    break
                case 'uint32':
                    length += 4
                    break
                case 'string':
                    length += 4 + (<Uint8Array>entry.value).length
                    break
                case 'blob':
                    length += (<Uint8Array>entry.value).length
                    break
                default:
                    throw new Error("Invalid data found in data array")
            }
        }

        let buffer = new Buffer(length)

        let pos = 0

        for (let entry of this.data) {
            switch (entry.type) {
                case 'uint8':
                    buffer.writeUInt8(<number>entry.value, pos)
                    pos += 1
                    break
                case 'uint32':
                    buffer.writeUInt32LE(<number>entry.value, pos)
                    pos += 4
                    break
                case 'string':
                    buffer.writeUInt32LE((<Uint8Array>entry.value).length, pos)
                    pos += 4
                case 'blob':
                    buffer.set(<Uint8Array>entry.value, pos)
                    pos += (<Uint8Array>entry.value).length
                    break
                default:
                    throw new Error("Invalid data found in data array")
            }
        }

        return Uint8Array.from(buffer)
    }
}
