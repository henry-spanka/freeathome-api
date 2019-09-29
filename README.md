[Install Homebridge]: https://github.com/nfarina/homebridge#installation
[Install Busch-Jaeger API]: https://github.com/sstadlberger/home
[Configuration]: #Configuration

[sstadlberger]: https://github.com/sstadlberger
[Home Hub]: https://support.apple.com/en-us/HT207057


# free@home-api

Busch-Jaeger free@home API to control actuators.

[![NPM](https://nodei.co/npm/freeathome-api.png?compact=true)](https://npmjs.org/package/freeathome-api)

# Description
This API exposes a websocket and HTTP API which can be used to receive and set state changes of free@home actuators.
It requires a System Access Point with version 2.3.0 or higher.

# Features
* Control your Busch-Jaeger Lights, Outlets, Blinds, etc. via HTTP or Websocket requests

# Supported devices
- Busch-Jaeger System Access Point
- Busch-Jaeger System Access Point 2.0

# Requirements
* Node.JS 10
* Linux or macOS (may run on Windows but not tested)

# Setup / Installation
You can install free@home-api both locally or globally. Choose whatever works best for you. I recommend local installation to keep all related project files in the same directory.

## Locally
1. Create a new directory for the project and enter it
2. Run `npm install freeathome-api --save`
3. Create a `config.json` file in root directory of the repository. See [Configuration](#configuration) section.
4. Start the API with `node bin/freeathome-api`
5. Star the repository ;)

## Globally
1. Run `npm install freeathome-api -g`
2. Create a `config.json` file. The API will look for the configuration file in the directory from which the API is executed. Make sure to set your working directory accordingly. See [Configuration](#configuration) section.
3. Start the API with `freeathome-api`
4. Star the repository ;)


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

# Configuration
The configuration is placed in the root directory of the repository (where all the other files like `package.json` are).

Copy the [config.example.json](config.example.json) to `config.json` and edit it accordingly.
If installed locally, you can copy the example file with: `cp node_modules/freeathome-api/config.example.json ./config.json`

# Security
The communication with the System Access Point is encrypted and authenticated with asymmetric encryption. This API uses the same encryption as used by the Browser when communicating with the System Access Point.

# Note
This API is still in an early state. After Busch-Jaeger released an updated firmware (>= 2.3.0), which is not compatible with other APIs anymore, I have written a new API from scratch to bring my home back to life and make Apple HomeKit work again ([homebridge-buschjaeger](https://github.com/henry-spanka/homebridge-buschjaeger)). I have tried to keep the API endpoints of [sstadlberger/home](https://github.com/sstadlberger/home)'s API so I don't need to rewrite all my plugins to integrate with a new API. Therefore this project should be backwards-compatible.

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
