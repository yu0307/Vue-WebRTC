# Vue-WebRTC
A Vue component for WebRTC (Web video conference) with fail-over option
### Let's collaborate!
Please send an email to me for bugs, feature suggestions,pull requests,etc... or even hang out :) [yu0307@gmail.com](mailto:yu0307@gmail.com)
### This package provides the following features:
- Basic webRTC functions; connect peers for video/audio communication. 
- Room for participants to join, communicate and conduct conference.
- A failover is used when the bitrate is below the threshold specified. Twilio is used in this implementation. 
- A signaling server application to run in between participants.
### Dependencies:
- npm ^6.14.4
- socket.io ^2.3.0
- socket.io-client ^2.3.0
- vue ^2.6.11
- twilio-video ^2.6.0

### Installation:
- twilio-video
    If twilio is your failover service. Further information can be found at [Here](https://media.twiliocdn.com/sdk/js/video/releases/2.0.0-beta5/docs/) and [here](https://www.twilio.com/docs/video)
    ```
        npm install twilio-video --save
    ```
- socket.io
    ```
        npm install socket.io
    ```
### Basic Usage:
1. Start Server:
    Start the signaling app before anything else with 
    ```
        node MissionControl.js 
    ```
2. Load the webRtc Vue module. 
    ```
        ...
        <template>
            <native-wrtc 
                :signal-server=`URL to the signaling server` 
                :room-name="Name of the room" 
                :room-token="Twilio specific token"
                :user-info='Additional user information'
                :screen='Local dom to inject video elements'
                :localScreen='If seperate dom is used for local video feeds'
                :volume-meter-callback="call back for voulume meter"
            />
        </template>
        <script>
        import nativeWrtc from './nativeRTC';
        </script>
        ...
    ```
3. Vue module props:

| Prop name | Values | Description | Default |
| --- | --- | --- | --- |
| signalServer | string | URL for the Signaling server. Could be local IP or public domain if available. | required |
| hasAudioDevice | boolean | If audio device is available for the component to publish to all participants. | false |
| hasVideoDevice | boolean | If video device is available for the component to publish to all participants. | false |
| userInfo | object | Any additional user data to include as part of participant initialization. | {} |
| screen | DOM | Local Dom container object(a reference or object) to be used to inject video elements into. | required |
| localScreen | DOM | If a seperate Dom container is needed to hold local video feeds. If left empty, "screen" is used to inject local video feeds. | Null |
| volumeMeterCallback | function | This callback function will be called when volume level is changed. Volume value between 0 to 1 is passed into the callback. | null |
| roomName | string | If a specific name is assigned to the room everyone is joining into. Twilio will REQUIRE this value. | null |
| roomToken | string | Twilio specific prop. You will need this token for a participant to successfully join the room. To generate a token for participant to use, reference [this link](https://www.twilio.com/docs/iam/access-tokens). | null |
| bitRateThreshold | integer | bitRate threshold to use backup connection. If threshold is below the number specified, Backup connection(twilio) will be used instead of the native RTC connection. Note: a minimum of 350 is highly recommended for video and audio calls.  | 450 |
| iceServerConfig | object | Native webRTC iceServer configuration. You will need to specify a STUN server at the very least. A TURN server is highly recommended since nowadays everyone is behind some sort of fire walls or NATs.  | {} |

4. Additional Information:
- STUN server is relatively easy to find. 
You can use Twilio's public STUN "stun:global.stun.twilio.com:3478?transport=udp", Or Google's STUN server "stun.l.google.com:19302"
- TURN server is very expensive(resourcewise) to run, thus you are less likely to find public and free servers to use. 
You can purchase one from providers that do offer TURN services, like Twilio, google, etc. 
However, you can also setup your own TURN server. I recommend using [CoTurn](https://github.com/coturn/coturn). It is relatively easy to setup. 
For more information regarding STUN and TURN servers, [reference here](https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/), I love this particular explaination.

