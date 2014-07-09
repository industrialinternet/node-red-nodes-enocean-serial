/**
 * Copyright 2014 Industrialinternet.co.uk
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
module.exports = function(RED) {

	function EnOceanIn(config){
		RED.nodes.createNode(this,config);
		var node = this;
		node.log(":: EnOcean USB 300 Gateway input node - v0.1i");

		node.on('input', function(msg) {  
			var data = msg.payload;
			//console.log('telegram in: ' + data.toString('hex')+' len:'+data.length);
			// handle RPS and 4BS telegrams 
			if( toHex(data[0]) == "55" &&  (data.length >=12 &&  toHex(data[6]) =="f6") || (data.length >=15 &&  toHex(data[6]) =="a5") || (data.length >=12 &&  toHex(data[6]) =="d5") ){	
				packet =  data.toString('hex');
				if(toHex(data[6]) == "f6"){
					ENOreciveSW(toHex(data[7]),packet);
				}	
				else if(toHex(data[6]) == "d5"){
					ENOrecive1BS(packet);
				}				
				else if(toHex(data[6]) == "a5"){
					ENOrecive4BS(packet);
				}
				else {
					msg.payload = null;
				}
				node.send( [msg, null]);	
			}
			// handle responce from CO_RD_IDBASE - read base id
			if(toHex(data[0]) == "55" &&  toHex(data[4]) =="2" &&  toHex(data[6]) =="0" && data.length >=12){
				//console.log("read base ID responce:"+ data.toString('hex'));
				var d= new Date();
				var utc = d.toUTCString();
				var baseID = toHex(data[7])+toHex(data[8])+toHex(data[9])+toHex(data[10]);
				var noOfWritesLeft = toHex(data[11]);
				//msg.payload= {"baseID":""+baseID+"","noOfWritesLeft":+""+""};
				msg.payload= {baseID:""+baseID+"",noOfWritesLeft : noOfWritesLeft, utc:""+ utc+""};
				node.send([null,msg]);
			}	
			// handle responce from CO_WR_IDBASE - write base id
			var baseResponce = null;
			if( toHex(data[2]) == "1" &&   toHex(data[4]) == "2"){
				if(toHex(data[6]) == "0"){
					baseResponce= 'OK';
				} else if (toHex(data[6]) == "2"){
					baseResponce= 'Error: baseID not surported';
				} else if (toHex(data[6]) == "82"){
					baseResponce= 'Error: writing baseID to flash!';
				} else if (toHex(data[6]) == "90"){
					baseResponce= 'Error: baseID out of range!';
				} else if (toHex(data[6]) == "91"){
					baseResponce= "Error: can't write baseID no more changes allowed!";
				} 
				var baseResponcMsg = { payload: baseResponce };
				node.send([msg,  baseResponcMsg]);
			}
			// support functions
			function toHex(s){
				 return _s = s.toString(16);
			}      
			function ENOreciveSW(swState,packet){
				msg.type= "F6: RPS Telegram";
				if(swState == "ff"){ // invalid sw states
					msg.payload=packet.substring(16,24);
					msg.ID=msg.payload;
					msg.state= swState;
					msg.rocker= null;
					msg.rssiHex=packet.substring(36,38);
					msg.rssi=  "-"+parseInt(msg.rssiHex, 16);
					msg.error="invalid switch state";
					return;
				}
				if(swState == "00" || swState == "0"){ // Rocker released 
					msg.payload= packet.substring(16,24);
					msg.ID =msg.payload;
					msg.state= -1;				
					msg.rocker="not known";
					msg.rssiHex=packet.substring(36,38);
					msg.rssi=  "-"+parseInt(msg.rssiHex, 16);
					return;
				}
				if(swState == "10" || swState == "50" || swState == "30" || swState == "70"){ // Rocker pressed 1 or 2 gang switch
					msg.payload= packet.substring(16,24); 
					msg.ID= msg.payload;
					if(swState == "10" || swState == "50"){msg.state= 1;}
					if(swState == "30" || swState == "70"){msg.state= 0;}
					if(swState == "10" || swState == "30"){msg.rocker= "B";}
					if(swState == "50" || swState == "70"){msg.rocker= "A";}			
					msg.rssiHex=packet.substring(36,38);
					msg.rssi=  "-"+parseInt(msg.rssiHex, 16);
				}
			}
			function ENOrecive1BS(packet){
				msg.type = "D5: 1BS Telegram";
				msg.payload= packet.substring(16,24);
				msg.ID= msg.payload;
				msg.state=packet.substring(14,16);
				msg.rssiHex=packet.substring(36,38);
				msg.rssi=  "-"+parseInt(msg.rssiHex, 16);
			}	
			function ENOrecive4BS(packet){
				msg.type = "A5: 4BS Telegram";
				msg.payload= packet.substring(22,30);
				msg.ID= msg.payload;
				msg.DB3= packet.substring(14,16);
				msg.DB2= packet.substring(16,18);
				msg.DB1= packet.substring(18,20);
				msg.DB0= packet.substring(20,22);
				msg.DBall=[msg.DB0,msg.DB1,msg.DB2,msg.DB3];			
				msg.rssiHex=packet.substring(42,44);
				msg.rssi=  "-"+parseInt(msg.rssiHex, 16);
			}	
		});
	}
	RED.nodes.registerType('EnOceanIN',EnOceanIn);

	// To use all 128 channels use base ID in place of Chip ID
	// http://www.enocean.com/en/knowledge-base-doku/enoceansystemspecification:issue:what_is_a_base_id/?purge=1
	
	var enoBaseID= [0xFF,0xFF,0x46,0x80]; 
	var msg  = null;
	var payload = null;
	var CRC8Table = [
	  0x00, 0x07, 0x0e, 0x09, 0x1c, 0x1b, 0x12, 0x15, 
	  0x38, 0x3f, 0x36, 0x31, 0x24, 0x23, 0x2a, 0x2d, 
	  0x70, 0x77, 0x7e, 0x79, 0x6c, 0x6b, 0x62, 0x65, 
	  0x48, 0x4f, 0x46, 0x41, 0x54, 0x53, 0x5a, 0x5d, 
	  0xe0, 0xe7, 0xee, 0xe9, 0xfc, 0xfb, 0xf2, 0xf5, 
	  0xd8, 0xdf, 0xd6, 0xd1, 0xc4, 0xc3, 0xca, 0xcd, 
	  0x90, 0x97, 0x9e, 0x99, 0x8c, 0x8b, 0x82, 0x85, 
	  0xa8, 0xaf, 0xa6, 0xa1, 0xb4, 0xb3, 0xba, 0xbd, 
	  0xc7, 0xc0, 0xc9, 0xce, 0xdb, 0xdc, 0xd5, 0xd2, 
	  0xff, 0xf8, 0xf1, 0xf6, 0xe3, 0xe4, 0xed, 0xea, 
	  0xb7, 0xb0, 0xb9, 0xbe, 0xab, 0xac, 0xa5, 0xa2, 
	  0x8f, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9d, 0x9a, 
	  0x27, 0x20, 0x29, 0x2e, 0x3b, 0x3c, 0x35, 0x32, 
	  0x1f, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0d, 0x0a, 
	  0x57, 0x50, 0x59, 0x5e, 0x4b, 0x4c, 0x45, 0x42, 
	  0x6f, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7d, 0x7a, 
	  0x89, 0x8e, 0x87, 0x80, 0x95, 0x92, 0x9b, 0x9c, 
	  0xb1, 0xb6, 0xbf, 0xb8, 0xad, 0xaa, 0xa3, 0xa4, 
	  0xf9, 0xfe, 0xf7, 0xf0, 0xe5, 0xe2, 0xeb, 0xec, 
	  0xc1, 0xc6, 0xcf, 0xc8, 0xdd, 0xda, 0xd3, 0xd4, 
	  0x69, 0x6e, 0x67, 0x60, 0x75, 0x72, 0x7b, 0x7c, 
	  0x51, 0x56, 0x5f, 0x58, 0x4d, 0x4a, 0x43, 0x44, 
	  0x19, 0x1e, 0x17, 0x10, 0x05, 0x02, 0x0b, 0x0c, 
	  0x21, 0x26, 0x2f, 0x28, 0x3d, 0x3a, 0x33, 0x34, 
	  0x4e, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5c, 0x5b, 
	  0x76, 0x71, 0x78, 0x7f, 0x6A, 0x6d, 0x64, 0x63, 
	  0x3e, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2c, 0x2b, 
	  0x06, 0x01, 0x08, 0x0f, 0x1a, 0x1d, 0x14, 0x13, 
	  0xae, 0xa9, 0xa0, 0xa7, 0xb2, 0xb5, 0xbc, 0xbb, 
	  0x96, 0x91, 0x98, 0x9f, 0x8a, 0x8D, 0x84, 0x83, 
	  0xde, 0xd9, 0xd0, 0xd7, 0xc2, 0xc5, 0xcc, 0xcb, 
	  0xe6, 0xe1, 0xe8, 0xef, 0xfa, 0xfd, 0xf4, 0xf3
	];

	function EnOceanOut(config){
		RED.nodes.createNode(this,config);
		this.baseID =  config.baseID;
		var node = this;
		node.log(":: EnOcean USB 300 Gateway output node - v0.1b");
			
		node.on('input', function(msg) {  
			// Handel send switch
			if(msg.action == "setSW"){
				ENOsendSW(msg.channel,msg.state);
			}
			// Handel get baseID 
			if(msg.action == "getBaseID"){
				 // COMMON_COMMAND = 5      8 = CO_RD_IDBASE 
				sendESP3Packet_V2(0x05, [0x08]);
			}
			// Handel set baseID WARNING you only write 10 times 
			if(msg.action == "setBaseID"){
				 // COMMON_COMMAND = 5      7 = CO_WR_IDBASE 
				sendESP3Packet_V2(0x05, [0x07,enoBaseID[0],enoBaseID[1],enoBaseID[2],enoBaseID[3]]);
			}
		});
		
		// EnOcean telegram crc & functions
		function proccrc8(CRC, u8Data){ 
			return CRC8Table[(CRC ^ u8Data) & 0xff];
		}
		function ESP3HeaderCRC(telegramHeader){
			u8CRC = 0;
			u8CRC = proccrc8(u8CRC,telegramHeader[1]);
			u8CRC = proccrc8(u8CRC,telegramHeader[2]);
			u8CRC = proccrc8(u8CRC,telegramHeader[3]);
			u8CRC = proccrc8(u8CRC,telegramHeader[4]);
			return u8CRC;
		}
		function ESP3DataCRC(telegramData){
			u8CRC = 0;
			for (var dbyte in telegramData){
				u8CRC = proccrc8(u8CRC,telegramData[dbyte])
			}
			return u8CRC;
		}
		function ESP3Header(packetType,packetData){
			pHeader = [0x55]; 					//sync
			pHeader.push(0x00); 					//MSB Data Length
			pHeader.push(packetData.length);	//LSB Data Length
			pHeader.push(0x00); 					//optional data length
			pHeader.push(packetType); 			//packet type
			pHeader.push(ESP3HeaderCRC(pHeader));//Header CRC
			return pHeader;
		}
		function sendESP3Packet_V2(packetType, packetData){

			pESP3Packet = ESP3Header(packetType,packetData);
			for(pi=0; pi<packetData.length; pi++){
				pESP3Packet.push(packetData[pi]); 
			}	
			pESP3Packet.push(ESP3DataCRC(packetData)); 
			//console.log("tel:"+pESP3Packet.toString('hex'));

			//var stel = new Buffer ([0x55,0x00,0x07,0x00,0x01,0x11,0xF6,0x30,0xFF,0x8D,0x67,0x80,0x30,0xD7]);  
			//var pk = ['syn','dlo','dl1','opl','pt','crc','org','sw','id0','id1','id2','id3','status','crc'];
			var stel = new Buffer(pESP3Packet.length);
				
			for(bi=0; bi<pESP3Packet.length; bi++){
				//var hexno = pESP3Packet[bi].toString(16);
				stel[bi]= pESP3Packet[bi];
				//console.log("stel["+bi+"]"+stel[bi]+" hex:"+hexno+" dec:"+pESP3Packet[bi]+" pk:"+pk[bi]);				
			}	
			msg={ payload: stel, topic: "send enocean telegram"} ;
			node.send(msg);;
		}
		function ENOsendSW(_ch,_state){
			// Note math only good for base + 78 channels re-wite to support 128
			var x=parseInt( enoBaseID[3]);
			var z=x+_ch;
			var channel = "0x"+z.toString(16);
			if(_state==true || _state=="true"){  
				sendESP3Packet_V2(0x01, [0xF6,0x10,enoBaseID[0],enoBaseID[1],enoBaseID[2],""+channel+"",0x30]); // on/up/dim-up pressed
			} else {	  // Radio =01 ORG=F6 State                    BaseID                          Status         
				sendESP3Packet_V2(0x01, [0xF6,0x30,enoBaseID[0],enoBaseID[1],enoBaseID[2],""+channel+"",0x30]); // off/down/dim-down pressed
			}
		}
		function toHex(s){
		 return _s = s.toString(16);
		}
		function lt(){
			var  lt = new Date();
			var d = new Date(lt.getTime()-(lt.getTimezoneOffset()*60000));
			return d;
		}
	}  		
	RED.nodes.registerType('EnOceanOut',EnOceanOut);
}
