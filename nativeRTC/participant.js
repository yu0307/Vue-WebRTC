const EventEmitter = require('events');
export default class participant extends EventEmitter{ 
    
    constructor(socket,userInfo={},iceConfig,BitRateThreshold=350){
        super();
        this.userInfo=userInfo;
        this.socket=socket;
        this.RTCPconnection= new RTCPeerConnection(iceConfig);
        this.bitrate=null;
        this.bitRateThreshold=BitRateThreshold;
        this.bytesPrev=null;
        this.timestampPrev=null;
        this.alternateRequestSent=false;
        Object.assign(this, userInfo);
        this.initRTCP();
        this.useAlternative=false;
        this.switching=false;
    }
    disableNativeRTC(){
        this.socket.off(`ice.offer:${this.socket_id}`);
        this.socket.off(`ice.answer:${this.socket_id}`);
        this.socket.off(`ice.newcandidate:${this.socket_id}`);
        this.RTCPconnection.close();
        this.useAlternative=true;
    }

    initRTCP(){

        this.socket.on(`ice.offer:${this.socket_id}`, async function(offer){
            let answer=await this.setOffer(offer);
            this.socket.emit('ice.answerTo',{to_socket_id:this.socket_id,answer:answer});
        }.bind(this));

        this.socket.on(`ice.answer:${this.socket_id}`,function(answer){
            this.setAnswer(answer);
        }.bind(this));

        this.socket.on(`ice.newcandidate:${this.socket_id}`,function(candidateList){
            this.addCandidate(candidateList);
        }.bind(this));

        this.socket.on(`requestAlternative:${this.socket_id}`,function(){
            this.emit('generateAlternatConnection',this);
        }.bind(this));

        this.socket.on(`useBackUp:${this.socket_id}`,function(){
            this.emit('useBackUp',this);
        }.bind(this));

        this.RTCPconnection.onicecandidate = function(e) {
            if (e.candidate) {
                this.socket.emit('ice.candidateTo',{to_socket_id:this.socket_id,candidate:e.candidate});
            }
        }.bind(this);

        if ("onaddstream" in this.RTCPconnection === true) {
            this.RTCPconnection.onaddstream = function(e) {
                this.emit('trackAdded',this,e.stream.getTracks());
            }.bind(this);
        } 
        if ("ontrack" in this.RTCPconnection === true) {
            this.RTCPconnection.ontrack = function(e) {
                this.emit('trackAdded',this,e.track);
            }.bind(this);
        }
        if ("onconnectionstatechange" in this.RTCPconnection === true) {
            this.RTCPconnection.onconnectionstatechange = function(e) {
                this.emit('onconnectionstatechange',this.RTCPconnection.connectionState);
                if (this.RTCPconnection.connectionState === 'connected') {
                    this.analytics();
                }
            }.bind(this);
        }
        if ("onnegotiationneeded" in this.RTCPconnection === true) {
            this.RTCPconnection.onnegotiationneeded = this.makeOffer.bind(this);
        }
    }

    analytics(){
        setInterval(function(){
            this.RTCPconnection.getStats(null).then(function(results){
                let stat;
                results.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.mediaType === 'video'){
                        stat=report;
                    }
                });
                if(stat){
                    const now = stat.timestamp;
                    if(stat){
                        const bytes = stat.bytesReceived;
                        if (this.timestampPrev) {
                            this.bitrate = 8 * (bytes - this.bytesPrev) / (now - this.timestampPrev);
                            this.bitrate = Math.floor(this.bitrate);
                        }
                        this.bytesPrev = bytes;
                        this.timestampPrev = now;
                        if(this.bitrate){
                            this.emit('bitrateUpdated',this.bitrate);
                            if(this.bitrate<=this.bitRateThreshold && this.switching==false){
                                this.emit('suggestAlternative',this);
                                // console.log(this.bitrate);
                            }
                        }
                    }
                }
            }.bind(this), err => console.log(err));
        }.bind(this), 1000);
    }

    async makeOffer(){
        const offer = await this.RTCPconnection.createOffer();
        await this.RTCPconnection.setLocalDescription(offer);
        this.socket.emit('ice.offerTo',{offer:offer,to_socket_id:this.socket_id});
        return offer;
    }

    async addCandidate(iceCandidate){
        await this.RTCPconnection.addIceCandidate(iceCandidate);
    }

    async setAnswer(answer){
        const remoteDesc = new RTCSessionDescription(answer);
        await this.RTCPconnection.setRemoteDescription(remoteDesc);
    }

    async setOffer(offer){
        this.RTCPconnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.RTCPconnection.createAnswer();
        await this.RTCPconnection.setLocalDescription(answer);
        return answer;
    }

    addTracks(tracks){
        if(!this.useAlternative){
            tracks.audio.forEach(function(track){
                this.RTCPconnection.addTrack(track);
            }.bind(this));
            tracks.video.forEach(function(track){
                this.RTCPconnection.addTrack(track);
            }.bind(this));
        }
    }

    attachTracks(tracks){
        let stream = new MediaStream();
        let hasVideo=false;
        if (_.isArray(tracks)){
            tracks.forEach(function(t){
                if(t.kind=='video'){
                    hasVideo=true;
                }
                return stream.addTrack(t);
            });
        }else{
            stream.addTrack(tracks);
            if(tracks.kind=='video'){
                hasVideo=true;
            }
        }
        if(hasVideo){
            let video = document.createElement("VIDEO");
            video.autoplay = true;
            video.srcObject=stream;
            video.id='v'+this.socket.id.replace(`${this.socket.nsp}#`,'');
            return video;
        }
        return null;
    }
}