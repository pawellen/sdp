/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
(function() {
	var util = require('util');
	var EventEmitter = require('events').EventEmitter;
    var SdpPacket = require('./SdpPacket');
	var Buffers = require('buffers');
    
	var SdpProtocol = function(socket) {
		var self = this;
        var buffer = new Buffers();
        var packetBytesRead = 0;
        var reading = null;
        var packet = null;
        var PS = null;
        var headerDefaults = {
            version: '0.2',
            format: 'none'
        }
        var connected = socket ? true : false;



		// Public:
        this.ip = socket.remoteAddress;



        this.createPacket = function(header, data) {
            var packet = new SdpPacket();
            if (typeof header.version === 'undefined')
                header.version = headerDefaults.version;
            if (typeof header.type === 'undefined')
                header.type = headerDefaults.type;
            header.format = packet.setData(data);
            packet.setHeader(header);
            return packet;
        }



        this.send = function(command, data, header, callback) {
            var _header = header ? header : {};
            _header.cmd = command;
            var packet = self.createPacket(_header, data);
            self.writeData(packet, callback);
        }



        this.writeData = function(packet, callback) {
            if (connected && socket) {
                console.log('SEND: ', packet.packet.length, new Buffer(packet.toBinaryString(), 'binary'));
                console.log('SEND: ', packet.packet.length, packet.getHeader(), packet.getData());
                return socket.write(packet.toBinaryString(), 'binary', callback);
            }
            return false;
        }



		this.readData = function(data) {
            //console.log('DATA: ', data.length);
            try {
                buffer.push(new Buffer(data, 'binary'));
                reading = true;
                // process whole buffer:
                while (reading) {
                    if (PS !== null) {
                        if (packetBytesRead < PS) {
							var packetBytesLeft = PS - packetBytesRead;
							var bytesToCopy = packetBytesLeft < buffer.length ? packetBytesLeft : buffer.length;
							buffer.splice(0, bytesToCopy).copy(packet.packet, packetBytesRead);
							packetBytesRead += bytesToCopy;
							if (buffer.length < 1)
								reading = false;
                        }
                        if (packetBytesRead == PS) {
                            // packet ready:
                            //console.log('PACKET LENGRH: ' + PS)
                            if (packet.validatePacket()) {
                                self.emit('data', packet);
                            } else {
                                throw new Error('Incorrect packet');
                            }
                            PS = null;
                        }
                    } else {
                        if (buffer.length >= global.HEADER_DEF_SIZE) {
                            if (buffer.get(0) == 0x48) {
								var def = new Buffer(global.HEADER_DEF_SIZE, 'binary');
								buffer.copy(def, 0, 0, global.HEADER_DEF_SIZE);
                                var HS = def.readUInt16LE(1);
                                var DS = def.readUInt32LE(3);
                                //console.log(HS, DS);
                                if (HS > 0 && HS < global.HEADER_MAX_SIZE && DS >= 0 && DS < global.DATA_MAX_SIZE) {
                                    PS = HS + DS;
                                    packetBytesRead = 0;
                                    packet = new SdpPacket(PS);
                                    continue;
                                }
                                throw new Error('Incorrect header or data size');
                            }
                            throw new Error('Incorrect header');
                        }
                        reading = false;
                    }
                }
            } catch (err) {
				delete buffer;
                buffer = new Buffers();
                self.emit('error', err);
            }
        }



        this.getPacketBytesLeft = function() {
            if (PS) {
                return PS - packetBytesRead;
            } else {
                return null;
            }
        }
        
        
        
        this.disconnect = function() {
            socket.destroy();
            connected = false;
        }


        
        this.isConnected = function() {
            return connected && socket;
        }


        socket.on('data', self.readData)
        .on('end', function() {
            connected = false;
            self.emit('close');
        })
        .on('timeout', function() {
            self.emit('timeout');
            socket.destroy();
            connected = false;
        })
        .on('error', function(err) {
            self.emit('error', err);
        })
        .on('close', function(has_error) {
            self.emit('close', has_error);
            connected = false;
        })
        .setEncoding('binary');
	}

	util.inherits(SdpProtocol, EventEmitter);
	module.exports = SdpProtocol;
}());


