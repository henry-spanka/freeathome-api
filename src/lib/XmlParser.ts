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
        let floorData: any = {}

        let channelDescriptions: any = {}

        if (!update) {
            let strings = data.getChild('strings')
            let floorplan = data.getChild('floorplan')
            let descriptions = data.getChild('descriptions')

            if (strings === undefined || floorplan === undefined || descriptions === undefined) {
                throw new Error("Not a valid Master Packet")
            }

            channelDescriptions = descriptions

            for (let string of strings.getChildren('string')) {
                stringData[string.getAttr('nameId')] = string.getText()
            }

            for (let floor of floorplan.getChildren('floor')) {
                if (floor.getAttr('uid') == 'FD') {
                    continue
                }

                let roomData: any = {}

                for (let room of floor.getChildren('room')) {
                    if (room.getAttr('uid') == 'FC') {
                        continue
                    }

                    roomData[room.getAttr('uid')] = {
                        name: room.getAttr('name')
                    }
                }

                floorData[floor.getAttr('uid')] = {
                    name: floor.getAttr('name'),
                    rooms: roomData
                }
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

            if (device.getAttr('commissioningState') !== 'ready' && update) {
                continue
            }

            let channels = device.getChild('channels')

            if (channels === undefined) {
                continue
            }

            for (let channel of channels.getChildren('channel')) {
                let channelName = channel.getAttr('i')

                let cid = ""

                if (!update) {
                    let channelAttr = channel.getChildren('attribute')

                    let displayName = channelAttr.find(attr => attr.getAttr('name') == 'displayName')
                    let floorId = channelAttr.find(attr => attr.getAttr('name') == 'floor')
                    let roomId = channelAttr.find(attr => attr.getAttr('name') == 'room')
                    let icon = channelAttr.find(attr => attr.getAttr('name') == 'selectedIcon')
                    let functionId = channelAttr.find(attr => attr.getAttr('name') == 'functionId')

                    if (!displayName) {
                        displayName = device.getChildren('attribute').find(attr => attr.getAttr('name') == 'displayName')
                    }

                    if (!floorId) {
                        floorId = device.getChildren('attribute').find(attr => attr.getAttr('name') == 'floor')
                    }

                    if (!roomId) {
                        roomId = device.getChildren('attribute').find(attr => attr.getAttr('name') == 'room')
                    }

                    if (!icon) {
                        icon = device.getChildren('attribute').find(attr => attr.getAttr('name') == 'selectedIcon')
                    }

                    if (!functionId) {
                        functionId = device.getChildren('attribute').find(attr => attr.getAttr('name') == 'functionId')
                    }

                    // This is not unique - It is only used to get the pairingId of datapoints.
                    cid = channel.getAttr('cid')

                    parsed[serialNo]['channels'][channelName] = {
                        datapoints: {},
                        "displayName": displayName ? displayName.getText() : "",
                        "floor": floorId ? floorData[floorId.getText()].name : "",
                        "room": floorId && roomId ? floorData[floorId.getText()].rooms[roomId.getText()].name : "",
                        "iconId": icon ? icon.getText() : "",
                        "functionId": functionId ? functionId.getText() : "",
                        "cid": cid
                    }
                } else {
                    parsed[serialNo]['channels'][channelName] = {
                        datapoints: {}
                    }
                }

                for (let type of ['input', 'output', 'parameter']) {
                    let datapoints = channel.getChild(type + 's')

                    if (datapoints === undefined) {
                        continue
                    }

                    let index = 0

                    for (let datapoint of datapoints.getChildren(type == 'parameter' ? 'parameter' : 'dataPoint')) {
                        let datapointName = datapoint.getAttr('i')

                        for (let value of datapoint.getChildren('value')) {
                            if (value.children.length == 1) {
                                let datapointValue = value.children[0]

                                parsed[serialNo]['channels'][channelName]['datapoints'][datapointName] = {
                                    "value": datapointValue,
                                }

                                if (!update && type != 'parameter') {
                                    let pairingId = parseInt("0x" + channelDescriptions.getChildren('channel').find((attr: ltx.Element) => attr.getAttr('cid') == cid)
                                        .getChild(type + 's').getChildren(type == 'parameter' ? 'parameter' : 'dataPoint')[index]
                                        .getAttr('pairingId'))

                                    parsed[serialNo]['channels'][channelName]['datapoints'][datapointName]["pairingId"] = pairingId;
                                }
                            }
                        }

                        index++
                    }
                }
            }
        }

        return parsed
    }
}
