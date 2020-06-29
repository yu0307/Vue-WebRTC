<script>
import room from './nativeRTC/room';
import {SoundMeter} from './nativeRTC/soundmeter';
const TV = require('twilio-video');
export default {
    name:'nativeWrtc',
    render() {
        return '';
    },
    data(){
        return {
            attendee: {},
            navigator:null,
            isConnected:false,
            isBroadcasting:false,
            room:null,
            backupRoom:null,
            audioContext:null,
            settingUp:false,
            localParticipant:{
                tracks:{
                    audio:[],
                    video:[]
                }
            },

        }
    },
    methods:{
        handleAudioStream(stream){
            const soundMeter = window.soundMeter = new SoundMeter(this.audioContext);
            soundMeter.connectToSource(stream, function(e) {
                if (e) {
                    console.log(e);
                    return;
                }
                if(typeof this.volumeMeterCallback =='function'){
                    setInterval(function(soundMeter){
                        this.volumeMeterCallback(soundMeter.instant.toFixed(2));
                    }.bind(this,soundMeter), 50);
                }
            }.bind(this));
        },
        createLocalAudioTrack(asStream=false){
            return new Promise((resolve, reject) => {
                try {
                    if(this.navigator){
                        this.navigator.mediaDevices
                        .getUserMedia({
                            audio: {
                                mandatory: {
                                    googEchoCancellation: "false",
                                    googAutoGainControl: "false",
                                    googNoiseSuppression: "false",
                                    googHighpassFilter: "false"
                                },
                                optional: []
                            }
                        })
                        .then(
                            function(resolve,stream) {
                                this.handleAudioStream(stream);
                                resolve(asStream===true?stream: stream.getAudioTracks());
                            }.bind(this,resolve)
                        )
                        .catch(
                            function(reject,error) {
                                reject(error);
                            }.bind(this,reject)
                        );
                    }else{
                        reject('not supported');
                    }
                } catch (error) {
                    reject(error);
                }
            });
        },
        createLocalVideoTrack(asStream=false){
            return new Promise((resolve, reject) => {
                try {
                    if(this.navigator){
                        this.navigator.mediaDevices
                        .getUserMedia({
                            video: {
                                mandatory: {
                                    minAspectRatio: 1.333,
                                    maxAspectRatio: 1.334
                                },
                                optional: [
                                    { minFrameRate: 20 },
                                    { maxWidth: 640 },
                                    { maxHeigth: 480 }
                                ]
                            },
                            audio: {
                                mandatory: {
                                    googEchoCancellation: "false",
                                    googAutoGainControl: "false",
                                    googNoiseSuppression: "false",
                                    googHighpassFilter: "false"
                                },
                                optional: []
                            }
                        })
                        .then(
                            function(resolve,stream) {
                                resolve(asStream===true?stream: stream.getVideoTracks());
                            }.bind(this,resolve)
                        )
                        .catch(
                            function(reject,error) {
                                reject(error);
                            }.bind(this,reject)
                        );
                    }else{
                        reject('not supported');
                    }
                } catch (error) {
                    reject(error);
                }
            });
        },
        broadcastAudio(){
            if(this.hasAudioDevice){
                this.createLocalAudioTrack().then(function(track){
                    this.localParticipant.tracks.audio=[];
                    this.attachTrack(track);
                    this.room.publishTrack(this.localParticipant.tracks);
                    if(this.usingBackup){
                        this.backupRoom.localParticipant.publishTracks(track);
                    }
                    this.isBroadcasting=true;
                }.bind(this));
            }
        },
        broadcastVideo(){
            if(this.hasVideoDevice){
                this.createLocalVideoTrack().then(function(track){
                    this.localParticipant.tracks.video=[];
                    this.attachTrack(track);
                    if(this.localScreen){
                        this.localScreen.appendChild(this.attachMedia(this.localParticipant.tracks.video));
                    }
                    this.room.publishTrack(this.localParticipant.tracks);
                    if(this.usingBackup){
                        this.backupRoom.localParticipant.publishTracks(track);
                    }
                    this.isBroadcasting=true;
                }.bind(this));
            }
        },
        async enableLocalAudio(){
            if(this.isConnected==false){
               await this.connect();
            }
            if(_.isEmpty(this.localParticipant.tracks.audio) || _.isNull(this.localParticipant.tracks.audio)){
                this.broadcastAudio();
            }else{
                this.localParticipant.tracks.audio.forEach(function (audioTrack) {
                    audioTrack.enabled=true;
                });
                if(this.usingBackup){
                    this.backupRoom.localParticipant.audioTracks.forEach(function (videoTrack) {
                        videoTrack.track.enable();
                    });
                }
            }
        },
        async enableLocalVideo(){
            if(this.isConnected==false){
               await this.connect();
            }
            if(_.isEmpty(this.localParticipant.tracks.video) || _.isNull(this.localParticipant.tracks.video)){
                this.broadcastVideo();
            }else{
                this.localParticipant.tracks.video.forEach(function (videoTrack) {
                    videoTrack.enabled=true;
                });
                if(this.usingBackup){
                    this.backupRoom.localParticipant.videoTracks.forEach(function (videoTrack) {
                        videoTrack.track.enable();
                    });
                }
            }
        },
        pauseLocalVideo(){
            this.localParticipant.tracks.video.forEach(function (videoTrack) {
                videoTrack.enabled=false;
            });
            if(this.usingBackup){
                this.backupRoom.localParticipant.videoTracks.forEach(function (videoTrack) {
                    videoTrack.track.disable();
                });
            }
        },
        pauseLocalAudio(){
            this.localParticipant.tracks.audio.forEach(function (audioTrack) {
                audioTrack.enabled=false;
            });
            if(this.usingBackup){
                this.backupRoom.localParticipant.audioTracks.forEach(function (videoTrack) {
                    videoTrack.track.disable();
                });
            }
        },
        attachMedia(tracks){
            let stream = new MediaStream();
            if (_.isArray(tracks)){
                tracks.forEach(t=>stream.addTrack(t));
            }else{
                stream.addTrack(tracks);
            }
            let video = document.createElement("VIDEO");
            video.autoplay = true;
            video.srcObject=stream;
            return video;
        },
        detatchMedia(id){
            let dom = this.screen.querySelector(`#v${id}`);
            if(dom){
                dom.remove();
            }
        },
        async generateAlternatConnection(part){
            if(this.backupRoom==null && this.settingUp==false){
                this.settingUp=true;
                await this.initBackupRoom();
            }
            part.socket.emit('backupReady',part.socket_id);
            part.disableNativeRTC();
            this.detatchMedia(part.socket.id.replace(`${part.socket.nsp}#`,''));
        },
        attachTvMedia(participant){
            participant.tracks.forEach(function(publication){
                if (!publication.isSubscribed && publication.track) {
                    this.screen.appendChild(track.attach());
                }
            }.bind(this));
            participant.on('trackSubscribed', function(track){
                this.screen.appendChild(track.attach());
            }.bind(this));
            participant.on('trackUnsubscribed', function(track){
                track.detach().forEach(element => element.remove());
            }.bind(this));
        },
        async initBackupRoom(callback=null){
            await TV.connect(this.roomToken,{
                    name:this.roomName,
                    audio: false,
                    video: false
                }).then(function(callback,room){
                    this.backupRoom=room;
                    room.participants.forEach(function(participant){
                        this.attachTvMedia(participant);
                    }.bind(this));

                    room.on('participantConnected', function(participant){
                        this.attachTvMedia(participant);
                    }.bind(this));

                    this.backupRoom.isConnected=true;
                    this.settingUp=false;
                    if(typeof(callback)==='function'){
                        callback(room);
                    }
                    if(this.hasAudio){
                        room.localParticipant.publishTracks(this.localAudio);
                    }
                    if(this.hasVideo){
                        room.localParticipant.publishTracks(this.localVideo);
                    }
                }.bind(this,callback), error => {
                    console.error(`Unable to connect to Room: ${error.message}`);
                });
        },
        async connect(){
            await this.room.connect(this.signalServer).then(function(room){

                    room.participants.forEach(function(p){
                        p.on('trackAdded', function(p,track) {
                            let resp=p.attachTracks(track);
                            if(resp){
                                this.screen.appendChild(resp);
                            }
                        }.bind(this));

                        p.on('generateAlternatConnection',function(participant){
                            this.generateAlternatConnection(participant);
                        }.bind(this));

                        p.on('useBackUp',function(participant){
                            if(this.backupRoom==null && this.settingUp==false){
                                this.settingUp=true;
                                this.initBackupRoom(function(participant,room){
                                    this.detatchMedia(participant.socket.id.replace(`${participant.socket.nsp}#`,''));
                                    participant.disableNativeRTC();
                                }.bind(this,participant));
                            }
                        }.bind(this));
                    }.bind(this));

                    room.on('participantJoin',function(part){
                        part.on('trackAdded', function(p,track) {
                            let resp=p.attachTracks(track);
                            if(resp){
                                this.screen.appendChild(resp);
                            }
                        }.bind(this));

                        part.on('useBackUp',function(participant){
                            if(this.backupRoom==null && this.settingUp==false){
                                this.settingUp=true;
                                this.initBackupRoom(function(participant,room){
                                    this.detatchMedia(participant.socket.id.replace(`${participant.socket.nsp}#`,''));
                                    participant.disableNativeRTC();
                                }.bind(this,participant));
                            }
                        }.bind(this));

                        part.on('generateAlternatConnection',function(participant){
                            this.generateAlternatConnection(participant);
                        }.bind(this));

                        if(this.isBroadcasting){
                            part.addTracks(this.localParticipant.tracks);
                        }
                    }.bind(this));

                    room.on('participantDisconnected',function(part){
                        this.detatchMedia(part.socket.id.replace(`${part.socket.nsp}#`,''));
                    }.bind(this));
                    this.isConnected=true;
                }.bind(this), error => {
                    console.error(`Unable to connect to Room: ${error.message}`);
                });
        },
        attachTrack(tracks){
            if(Array.isArray(tracks)){
                tracks.forEach(function(track){
                    if(track.kind=='audio'){
                        this.localParticipant.tracks.audio.push(track);
                    }else if(track.kind=='video'){
                        this.localParticipant.tracks.video.push(track);
                    }
                }.bind(this));
            }else{
                if(tracks.kind=='audio'){
                    this.localParticipant.tracks.audio.push(tracks);
                }else if(tracks.kind=='video'){
                    this.localParticipant.tracks.video.push(tracks);
                }
            }
        },
    },
    props:{
        signalServer:{
            required:true
        },
        hasAudioDevice:{
            default:false
        },
        hasVideoDevice:{
            default:false
        },
        userInfo:{
            default:{}
        },
        screen:{//Dom
            required:true
        },
        localScreen:{
            default:null
        },
        volumeMeterCallback:{
            default:null
        },
        roomName:{
            default:null
        },
        roomToken:{
            default:null
        },
        bitRateThreshold:{
            default:450
        },
        iceServerConfig:{
            default(){
                return {};
            }
        }
    },
    mounted(){
        this.room = new room(this.userInfo,this.iceServerConfig,this.bitRateThreshold);
        this.navigator=navigator;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Volume meter not supported.');
        }
        this.navigator.getUserMedia =
            navigator.getUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.msGetUserMedia;
        this.connect();
        window.addEventListener('beforeunload', function (e) {
            if(this.backupRoom!=null){
                this.backupRoom.disconnect();
            }
        }.bind(this));
    },
    computed:{
        usingBackup(){
            return !_.isNull(this.backupRoom);
        },
        hasAudio(){
            return !_.isEmpty(this.localAudio);
        },
        hasVideo(){
            return !_.isEmpty(this.localVideo);
        },
        localAudio(){
            return this.localParticipant.tracks.audio
        },
        localVideo(){
            return this.localParticipant.tracks.video
        }
    }
}
</script>

<style>

</style>