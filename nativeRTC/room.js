const EventEmitter = require('events');
import io from "socket.io-client";
import participant from './participant';
export default class room extends EventEmitter{ 

    constructor(user={},iceServerConfig={},BitRateThreshold=350){
        super();
        this.participants=[];
        this.socket=null;
        this.bitRateThreshold=BitRateThreshold;
        this.userInfo=user;
        this.configuration={...{
            iceServers: [
                {
                    urls: "stun:global.stun.twilio.com:3478?transport=udp" //stun:global.stun.twilio.com:3478?transport=udp stun.l.google.com:19302
                },
                // {
                //     urls: ["turns:turn server url"],
                // },
            ]
        },...iceServerConfig};
    }

    addParticipant(part){
        part= new participant(this.socket, part,this.configuration,this.bitRateThreshold);
        part.on('suggestAlternative',function(participant){
            if(participant.alternateRequestSent==false){
                participant.alternateRequestSent=true;
                this.socket.emit('requestAlternative',participant.socket_id);
            }
        }.bind(this));
        this.participants.push(part);
        return part;
    }

    removeParticipant(id){
        this.participants.splice(this.participants.findIndex(function(id,p){
            return p.socket_id==id;
        }.bind(this,id)),1);
    }

    getParticipant(id){
        return this.participants.find((p)=>p.socket_id==id);
    }

    publishTrack(tracks){
        this.participants.forEach(function(e){
            e.addTracks(tracks);
        }.bind(this));
    }

    connect(url,options={}){
        return new Promise(function(resolve,reject){
            try {
                options={...{secure: true},...options};
                this.socket = io(url, options);
                this.socket.on('welcome',function(welcomMessage){
                    if(welcomMessage.participants && !_.isEmpty(welcomMessage.participants)){
                        Object.values(welcomMessage.participants).forEach(function(p){
                            this.addParticipant(p);
                        }.bind(this));
                    }
                    this.socket.emit("introduction", {...{socket_id:this.socket.id}, ...this.userInfo});

                    this.socket.on('participantJoin',async function(user){
                        let part = this.addParticipant(user);
                        this.emit('participantJoin',part);
                    }.bind(this));

                    this.socket.on('participantDisconnected',function(user){
                        this.emit('participantDisconnected',this.getParticipant(user.socket_id));
                        let part = this.removeParticipant(user.socket_id);
                    }.bind(this));



                    resolve(this);
                }.bind(this));
            } catch (error) {
                reject(error);
            }
        }.bind(this));
    }
    
    isConnected(){
        return this.socket && this.socket.connected;
    }
}