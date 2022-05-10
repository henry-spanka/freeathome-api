[Install Homebridge]: https://github.com/nfarina/homebridge#installation
[Install Busch-Jaeger API]: https://github.com/sstadlberger/home
[Configuration]: #api-configuration

[sstadlberger]: https://github.com/sstadlberger
[Home Hub]: https://support.apple.com/en-us/HT207057


# free@home-api

Busch-Jaeger free@home API to control actuators.

[![NPM](https://nodei.co/npm/freeathome-api.png?compact=true)](https://npmjs.org/package/freeathome-api)

# Description
This API exposes a websocket and HTTP API which can be used to receive and set state changes of free@home actuators. It
can be used as a library as well in other applications. 
It requires a System Access Point with version 2.3.1 or higher.

# Features
* Control your Busch-Jaeger Lights, Outlets, Blinds, etc. via HTTP or Websocket requests

# Supported devices
- Busch-Jaeger System Access Point
- Busch-Jaeger System Access Point 2.0

# Tested Versions
|Version|Supported|Notes|
|---|---|---|
|2.5.0|:heavy_check_mark:|no known issues|
|2.4.0|:heavy_check_mark:|no known issues|
|2.3.1|:heavy_check_mark:|no known issues|

# Requirements
* Node.JS >= 10
* Linux or macOS (may run on Windows but not tested)

# Setup / Installation
You can install free@home-api both locally or globally. Choose whatever works best for you. I recommend local installation to keep all related project files in the same directory.

Alternatively you can also use docker if Node >= 10 is not available or you want to isolate the API from the rest of your system using containers.

## Locally
1. Create a new directory for the project and enter it
2. Run `npm install freeathome-api --save`
3. See [Configuration](#api-configuration) section.
4. Start the API with `node node_modules/freeathome-api/bin/freeathome-api`
5. Star the repository ;)

## Globally
1. Run `npm install freeathome-api -g`
2. See [Configuration](#api-configuration) section.
3. Start the API with `freeathome-api`
4. Star the repository ;)

## Docker
Run the docker container with:
```sh
docker run -d -p 8080:8080 -p 8081:8081 \
-e FREEATHOME_HOSTNAME=bj.example.com \
-e FREEATHOME_USERNAME=freeathome \
-e FREEATHOME_PASSWORD=mypassword \
henryspanka/freeathome-api:$IMAGE_ID
```

Replace *$IMAGE_ID* with the latest version on [Docker Hub](https://hub.docker.com/r/henryspanka/freeathome-api/tags).
Do not use the *latest* tag unless necessary as it is built from the master branch and may contain untested code/features.

For more configuration options see [Configuration](#api-configuration).

To view the logs and see if any errors during authentication occurred run:
```sh
docker logs $CONTAINER_ID
```

Replace *$CONTAINER_ID* with the id that is shown after starting the docker container. Alternatively check with `docker ps -a`

## Use `freeathome-api` as a library
1. Use `npm install freeathome-api` in your application for which you want control over busch jaeger devices
1. Include package in code:

Javascript:
```ecmascript 6
"use strict";
const {SystemAccessPoint} = require("freeathome-api");

module.exports = class FreeAtHomeApi {
    constructor() {
        this._connected = false
        const config = {
            hostname: "192.168.2.164",
            username: "API",
            password: "12345",
        };

        this.systemAccessPoint = new SystemAccessPoint(
            config,
            this,      // instance to report broadcastMessages
        );
    }

    async start() {
        console.log("Starting free@home API");

        try {
            await this.systemAccessPoint.connect();
            this._connected = true
        } catch (e) {
            console.error("Could not connect to SysAp: ", e);
            this._connected = false
        }
    }

    async stop() {
        if (this._connected) {
            console.log("Stopping free@home API")
            await this.systemAccessPoint.disconnect()
            this._connected = false
        }
    }

    /**
     * @param message
     */
    broadcastMessage(message) {
        // Do nothing when receiving a message from SysAccessPoint

    }

    async getAllDevices() {
        if (this._connected) {
            console.log("Getting device info");
            try {
                const response = await this.systemAccessPoint.getDeviceData();
                console.log(response);
                return response;
            } catch (e) {
                console.error("Error getting device data", e);
                return {};
            }
        }
    }

    /**
     *
     * @param deviceId
     * @param channel
     * @param dataPoint
     * @param value
     * @returns {Promise<void>}
     */
    async set(deviceId, channel, dataPoint, value) {
        console.log(
            `Setting (device, channel, datapoint, value): ${deviceId}, ${channel}, ${dataPoint}, ${value}`
        );

        if (this._connected) {
            return await this.systemAccessPoint.setDatapoint(
                deviceId.toString(),
                channel.toString(),
                dataPoint.toString(),
                value.toString()
            );
        }
    }
};

```


# Automatically Start on Boot
You can automatically start the API on boot. The following example is for Linux when using the local install (installed in /opt/freeathome-api). You may need to adjust the script if the API is installed globally.
Copy the contents of the following code section to `/etc/systemd/system/freeathome-api.service` and run `systemctl daemon-reload`.

You can then enable the service to auto-start on boot with `systemctl enable freeathome-api.service` and start it with `systemctl start freeathome-api.service`

```
[Unit]
Description=freeathome API Service
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/node node_modules/freeathome-api/bin/freeathome-api
Restart=on-failure
User=freeathome
Group=freeathome
WorkingDirectory=/opt/freeathome-api

[Install]
WantedBy=multi-user.target
```

I recommend running the API as a separate user. For this example I have first created a new user with `adduser --system --group --home /opt/freeathome-api freeathome`

# API Configuration
The API can be configured using a `config.json` or using environment variables. For unexperienced users I recommend using the `config.json`.

## Using `config.json`
The API will look for the configuration file in the directory from which the API is executed. Make sure to set your working directory accordingly.

Copy the [config.example.json](config.example.json) to `config.json` and edit it accordingly.
If installed locally, you can copy the example file with: `cp node_modules/freeathome-api/config.example.json ./config.json`

## Using environment variables
The following environment variables can be set to configure the API:

| Name                      | Required  | Type | Default Value | Description
|---------------------------|-----------|---|---|---|
| FREEATHOME_HOSTNAME       | yes       | string | | Hostname where we will connect to
| FREEATHOME_USERNAME       | yes       | string | | System Access Point Username
| FREEATHOME_PASSWORD       | yes       | string | | System Access Point Password
| FREEATHOME_HTTP_ENABLED   | no        | 0 \| 1 | 1 | Enable/Disable the HTTP API
| FREEATHOME_WS_ENABLED     | no        | 0 \| 1 | 1 | Enable/Disable the Websocket API
| FREEATHOME_DEBUG          | no        | 0 \| 1 | 0 | Enable/Disable Debug Logging

The environment variables can be passed to node with (When using local installation):

```sh
FREEATHOME_HOSTNAME=bj.example.com FREEATHOME_USERNAME=freeathome FREEATHOME_PASSWORD=mypassword node_modules/freeathome-api/bin/freeathome-api
```


# Security
The communication with the System Access Point is encrypted and authenticated with asymmetric encryption. This API uses the same encryption as used by the Browser when communicating with the System Access Point.

# Note
This API is still in an early state. After Busch-Jaeger released an updated firmware (>= 2.3.0), which is not compatible with other APIs anymore, I have written a new API from scratch to bring my home back to life and make Apple HomeKit work again ([homebridge-freeathome](https://github.com/henry-spanka/homebridge-freeathome)). I have tried to keep the API endpoints of [sstadlberger/home](https://github.com/sstadlberger/home)'s API so I don't need to rewrite all my plugins to integrate with a new API. Therefore this project should be backwards-compatible.

# Known Issues

* If you do not receive any updates from the System Access Point or are unable to set any datapoints log into the System Access Point interface and log out again. This must be done sometimes after a reboot of the System Access Point to enable websocket notifications.

# API Endpoints

## Set a datapoint
A datapoint can be set by sending the following payload to the API (for the HTTP based API send the payload as path):
`raw/{serialNo}/{channel}/{datapoint}/{value}`

## Get the state of all actuators
To get the state of all actuators send the following payload: `info`

## Get the state of a specific actuator
To get the state of a specific actuator send the following payload: `info/{serialNo}`

## Receive real-time updates
Real-Time updates are automatically sent to all connected websocket clients. Messages which have `{type: 'update'}` set are updates.

# Technical description
This API reflects the internal XML structure of the ABB free@home API. Therefore, the cloud API is similar to this API.

## functionId
The attribute `functionID` describes what function a device or a channel has. [Full list of functionIds](https://developer.eu.mybuildings.abb.com/fah_cloud/reference/functionids/)

Examples for `functionIds`:
* 0x0000 	FID_SWITCH_SENSOR 	Control element
* 0x0001 	FID_DIMMING_SENSOR 	Dimming sensor
* 0x0003 	FID_BLIND_SENSOR 	Blind sensor
* 0x0004 	FID_STAIRCASE_LIGHT_SENSOR 	Stairwell light sensor
* 0x0005 	FID_FORCE_ON_OFF_SENSOR 	Force On/Off sensor
* 0x0006 	FID_SCENE_SENSOR 	Scene sensor
* 0x0007 	FID_SWITCH_ACTUATOR 	Switch actuator
* 0x0009 	FID_SHUTTER_ACTUATOR 	Blind actuator
* 0x000A 	FID_ROOM_TEMPERATURE_CONTROLLER_MASTER_WITH_FAN 	Room temperature controller with fan speed level
* 0x000B 	FID_ROOM_TEMPERATURE_CONTROLLER_SLAVE 	Room temperature controller extension unit
* 0x000C 	FID_WIND_ALARM_SENSOR 	Wind Alarm
* 0x000D 	FID_FROST_ALARM_SENSOR 	Frost Alarm
* 0x000E 	FID_RAIN_ALARM_SENSOR 	Rain Alarm
* 0x000F 	FID_WINDOW_DOOR_SENSOR 	Window sensor
* 0x0011 	FID_MOVEMENT_DETECTOR 	Movement Detector
* 0x0012 	FID_DIMMING_ACTUATOR 	Dim actuator

# Changelog
The changelog can be viewed [here](CHANGELOG.md).

# Upgrade Notes
Upgrade Notes can be found in the [CHANGELOG](CHANGELOG.md).

# Help
If you have any questions or help please open an issue on the GitHub project page.

# Contributing
Pull requests are always welcome.

# Donation
If you find my work useful you can support the ongoing development of this project by buying me a [cup of coffee](https://www.paypal.me/Hspanka)

# License
The project is subject to the MIT license unless otherwise noted. A copy can be found in the root directory of the project [LICENSE](LICENSE).

# Disclaimer
This API is a private contribution and not related to ABB or Busch-Jaeger. It may not work with future updates of the free@home firmware and can also cause unintended behavior. Use at your own risk!

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
