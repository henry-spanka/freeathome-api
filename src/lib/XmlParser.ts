import ltx from "ltx"

export class XmlParser {
    static parseUpdate(update: string) {
        let data = ltx.parse(update)

        if (data.getAttr('type') !== 'update') {
            throw new Error("Not a valid update packet")
        }

        return this.parseDeviceData(data)
    }

    static parseMasterUpdate(update: string) {
        let data = ltx.parse(update)

        return this.parseDeviceData(data, false)
    }

    static parseDeviceData(data: ltx.Element, update: boolean = true) {
        let parsed: any = {}

        let stringData: any = {}

        if (!update) {
            let strings = data.getChild('strings')

            if (strings === undefined) {
                throw new Error("Not a valid Master Packet")
            }

            for (let string of strings.getChildren('string')) {
                stringData[string.getAttr('nameId')] = string.getText()
            }
        }

        let devices = data.getChild('devices')

        if (devices === undefined) {
            return
        }

        for (let device of devices.getChildren('device')) {
            let serialNo = device.getAttr('serialNumber')

            // Ignore Scenes for now
            if (serialNo.substring(0, 4) == 'FFFF') {
                continue
            }

            if (!update) {
                parsed[serialNo] = {
                    serialNumber: serialNo,
                    deviceId: device.getAttr('deviceId'),
                    typeName: stringData[device.getAttr('nameId')],
                    channels: {}
                }
            } else {
                parsed[serialNo] = {
                    serialNumber: serialNo,
                    channels: {}
                }
            }

            if (device.getAttr('commissioningState') !== 'ready') {
                continue
            }

            let channels = device.getChild('channels')

            if (channels === undefined) {
                continue
            }

            for (let channel of channels.getChildren('channel')) {
                let channelName = channel.getAttr('i')

                parsed[serialNo]['channels'][channelName] = {
                    datapoints: {}
                }

                for (let type of ['input', 'output', 'parameter']) {
                    let datapoints = channel.getChild(type + 's')

                    if (datapoints === undefined) {
                        continue
                    }

                    for (let datapoint of datapoints.getChildren(type == 'parameter' ? 'parameter' : 'dataPoint')) {
                        let datapointName = datapoint.getAttr('i')

                        for (let value of datapoint.getChildren('value')) {
                            if (value.children.length == 1) {
                                let datapointValue = value.children[0]

                                parsed[serialNo]['channels'][channelName]['datapoints'][datapointName] = datapointValue
                            }
                        }
                    }
                }
            }
        }

        return parsed
    }
}
