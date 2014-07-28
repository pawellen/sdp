/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
(function() {
    	
	var SdpPacket = function(PS) {
		var self = this;

		// construct:
        if (!PS) {
            PS = global.HEADER_DEF_SIZE;
        }
        if (PS < global.HEADER_DEF_SIZE) {
            throw new Error("Packet size to small. Minimum packet size is " + global.HEADER_DEF_SIZE);
        }
        this.packet = new Buffer(PS);
        this.packet[0] = 0x48;
        this.header = null;
        this.data = null;       
        
        
        
        this.setHS = function(HS) {
            self.packet.writeUInt16LE(HS, 1);
        }
        
        
        
        this.setDS = function(DS) {
            self.packet.writeUInt32LE(DS, 3);
        }        
        
        
        
        this.setHS(global.HEADER_DEF_SIZE);
        this.setDS(0);
                
                
                
		// public:
        this.getHS = function() {
            return self.packet.readUInt16LE(1);
        }
        
        
        
        this.getDS = function() {
            return self.packet.readUInt32LE(3);
        }
       
       
       
		this.getCommand = function() {
			return this.getHeader().cmd;
		}
       
       
       
		this.getFormat = function() {
			return this.getHeader().format;
		}



		this.getType = function() {
			return this.getHeader().type;
		}



        this.setData = function(data, encoding) {
            var dataType = undefined;
			if (data) {
                var _data;
                if (data instanceof Buffer) {
                    dataType = 'buffer';
                     _data = data;
                } else {
                    if (typeof data == 'object') {
                        dataType = 'object';
                        data = JSON.stringify(data);
                    } else {
                        dataType = 'string';
                    }
                    _data = new Buffer(data, encoding ? encoding : 'binary');
                }
				self.packet = Buffer.concat([
					self.packet.slice(0, self.getHS()),
					new Buffer([0x44]),
					_data
				]);
				self.setDS(_data.length + 1);
		   } else {
				self.packet = Buffer.concat([
					self.packet.slice(0, self.getHS()),
				]);
				self.setDS(0);
                dataType = 'none';
		   }
           self.data = null;
           return dataType;
        }
        
        
        
        this.getData = function(encoding) {
            if (self.data === null) {
                if (self.getDS() > 0 && self.packet[ self.getHS() ] == 0x44) {
                    
                    switch (self.getFormat()) {
                        
                        case 'buffer':
                            self.data = self.packet.slice(self.getHS() + 1, self.packet.length);
                            break;
                            
                        case 'string':
                            self.data = self.packet.toString(encoding ? encoding : 'binary', self.getHS() + 1);
                            break;
                            
                        case 'object':
                            self.data = JSON.parse(
                                self.packet.toString(encoding ? encoding : 'binary', self.getHS() + 1)
                            );
                            if (typeof self.data !== 'object') {
                                throw new Error("Unable to parse packet jSon data");
                            }
                            break;
                            
                        case 'none':
                            self.data = null;
                            break;
                            
                        default:
                            throw new Error('Unknown packet format "' + self.getFormat() + '"');
                    }
                }
            }
            return self.data;
        }



        this.getDataBuffer = function() {
            if (self.getDS() > 0 && self.packet[ self.getHS() ] == 0x44) {
                var buffer = new Buffer(self.getDS());
                var start = self.getHS() + 1;
                self.packet.copy(buffer, 0, start, start + self.getDS());
				
                return buffer;
            }
            return false;
        }


        
        this.validatePacket = function() {
            var HS = self.getHS();
            var DS = self.getDS();
            if (HS > 0 
                && HS < global.HEADER_MAX_SIZE
                && DS >= 0
                && DS < global.DATA_MAX_SIZE
                && self.packet[0] == 0x48
                && (DS==0 || self.packet[ HS ] == 0x44)
                && self.packet.length == HS + DS) {
                return true;
            } else {
                return false;
            }
        }
        
        
        
        this.setHeader = function(header, encoding) {
            if (typeof header === 'object') {
                var _header = new Buffer(JSON.stringify(header), encoding ? encoding : 'binary');
                self.packet = Buffer.concat([
                    self.packet.slice(0, global.HEADER_DEF_SIZE),
                    _header,
                    self.packet.slice(self.getHS())
                ]);
                self.setHS(global.HEADER_DEF_SIZE + _header.length);
                self.header = null;
            } else {
                throw new Error("Invalid header to set");
            }
        }
		
        
        
        this.getHeader = function(encoding) {
            if (!self.header) {
                var jSonToParse = self.packet.toString(encoding ? encoding : 'binary', global.HEADER_DEF_SIZE, self.getHS());
                try {
                    self.header = JSON.parse(jSonToParse);
                } catch (err) {
                    throw new Error('Unable to parse header. Error: "' + err.message + '" while parsing json string: "' + jSonToParse + '"');
                }
                if (typeof self.header != 'object') {
                    throw new Error('Invalid header. Header data must be in JSON format, parsing: "' + jSonToParse + '"');
                }
            }
            return self.header;
        }
        
        
        
        this.toBinaryString = function () {
            return self.packet.toString('binary');
        }
	}

	module.exports = SdpPacket;
}());
