/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
(function() {
    var Buffers = require('buffers');
    
	var ArgumentBuffer = function() {
        const TYPE_END = 0;
        const TYPE_BUFFER = 1;
        const TYPE_OBJECT = 2;
        const TYPE_STRING = 3;

        var self = this;
        var data = new Buffers();
        var header = [];
        
        
        
        this.toArguments = function() {
            var args = [];
            for (var i=0; i < header.length; i++) {
                args.push(
                    self.get(i)
                );
            }
            return args;
        }
        
        
        
        this.loadArguments = function(args) {
            header = [];
            for (var i = 0; i < args.length; i++) {
                if (typeof args[i] === 'function') {
                    return args[i];
                }
                self.add(args[i]);
            }
            return false;
        }
        
        
        
        this.toBuffer = function() {
            var buffer = new Buffers();
            for (var n in header) {
                var h_item = new Buffer(9);
                h_item.writeUInt8(header[n].type, 0);
                h_item.writeUInt32LE(header[n].offset, 1);
                h_item.writeUInt32LE(header[n].size, 5);
                buffer.push(h_item);
            }
            var h_end = new Buffer(1);
            h_end.writeUInt8(TYPE_END, 0);
            buffer.push(h_end);
            buffer.push(data.toBuffer());
            return buffer.toBuffer();
        }
        
        
        
        this.loadBuffer = function(buffer) {
            header = [];
            data = new Buffers();
            if (buffer instanceof Buffer) {
                // build header:
                var bytesRead = 0;
                while (bytesRead < buffer.length) {
                    var type = buffer.readUInt8(bytesRead, 0);
                    if (type > 0) {
                        var offset = buffer.readInt32LE(bytesRead + 1);
                        var size = buffer.readInt32LE(bytesRead + 5);
                        header.push({
                            type: type,
                            offset: offset,
                            size: size
                        });
                        bytesRead += 9;
                    } else {
                        bytesRead += 1;
                        break;
                    }
                }
                // read data:
                for (var i=0; i < header.length; i++) {
                    var start = bytesRead + header[i].offset;
                    data.push( buffer.slice(start, start + header[i].size));
                }
                return true;
            }
            throw new Error('ArgumentBuffer: Unable to load buffer');
        }
        
        
        
        this.add = function(value) {
            switch (true) {
            case value instanceof Buffer:
                header.push({
                    type: TYPE_BUFFER,
                    size: value.length,
                    offset: data.length
                });
                data.push(value);
                break;
                
            case typeof value === 'object':
                var json = new Buffer(JSON.stringify(value), 'binary');
                header.push({
                    type: TYPE_OBJECT,
                    size: json.length,
                    offset: data.length
                });
                data.push(json);
                break;

            default:
                var string = new Buffer(String(value), 'binary');
                header.push({
                    type: TYPE_STRING,
                    size: string.length,
                    offset: data.length
                });
                data.push(string);
            }
        }
        
        
        
        this.get = function(index) {
            if (typeof header[index] === 'object') {
                switch (header[index].type) {
                    case TYPE_BUFFER:
                        var value = new Buffer(header[index].size);
                        data.copy(value, 0, header[index].offset + header[index].size);
                        return value;
                    
                    case TYPE_OBJECT:
                        var json = data.toString('binary', header[index].offset, header[index].size);
                        return JSON.parse(json);
                    
                    case TYPE_STRING:
                        return data.toString('binary', header[index].offset, header[index].offset + header[index].size);
                    
                    default:
                        throw new Error('ArgumentBuffer: Unknown attribute type');
                }
            }
            return undefined;
        }
        
    }
    
	module.exports = ArgumentBuffer;
}());
