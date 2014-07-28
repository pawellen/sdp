/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
(function() {
    var net = require('net');
    var util = require('util');
    var EventEmitter = require('events').EventEmitter;
    var SdpProtocol = require('./lib/SdpProtocol');
    var ArgumentBuffer = require('./lib/ArgumentBuffer');
    
	var Sdp = function(options) {
		var self = this;
        var timeout = global.config.get('server').socket_timeout;
        var rpc = null;
        var rpc_id = 0;
        var rpc_calls = [];
        var server = null;

        // set options:
        if (typeof options === 'object') {
            if (typeof options.timeout === 'number') {
                timeout = options.timeout;
            }
            if (typeof options.rpc === 'object') {
                rpc_= options.rpc;
            }
        }



        var createRemoteObject = function(sdp) {
            var obj = {}
            var handler = {
                get: function(recv, name) {
                    if (name == 'inspect') {
                        return false;
                    }
                    return obj[name] || function() {
                        var argBuffer = new ArgumentBuffer();
                        callback = argBuffer.loadArguments(arguments);
                        if (typeof callback === 'function') {
                            var new_rpc_id = (++rpc_id) + '_' + name;
                            if (typeof rpc_calls[ new_rpc_id ] === 'undefined') {
                                rpc_calls[ new_rpc_id ] = {
                                    callback: callback
                                }
                            } else {
                                throw new Error('createRemoteObject: RPC id is already')
                            }
                        } else {
                            rpc_id = false;
                        }
                        console.log('Call: ' +  name + ' with id', (new_rpc_id ? new_rpc_id : ' no callback'));
                        sdp.send('rpc', argBuffer.toBuffer(), {
                            id: new_rpc_id,
                            call: name
                        });
                        return true;
                    }
                    return false;
                },
                getOwnPropertyNames: function(name) {
                    return obj[name];
                },
                getOwnPropertyDescriptor: function(name) {
                    return Object.getOwnPropertyDescriptor(obj, name);
                },
                keys: function() {
                    return Object.keys(obj);
                }
            }
            return Proxy.create(handler);
        }
        
        
        
        var responseRemoteCall = function(sdp, packet, callback) {
            var h = packet.getHeader();
            var argBuffer = new ArgumentBuffer();
            argBuffer.loadBuffer( packet.getDataBuffer() );
            var args = argBuffer.toArguments();
            if (h.call && typeof rpc === 'object' && typeof rpc[ h.call ] === 'function') {
               // call procedure:
               args.push(function() {
                   var argBuffer = new ArgumentBuffer();
                   argBuffer.loadArguments(arguments);
                   sdp.send('rpc', argBuffer.toBuffer(), {
                       id: h.id
                   }, callback);
                });
                rpc[ h.call ].apply(rpc[ h.call ], args);
            } else if (h.id && typeof rpc_calls[ h.id ] ==='object' && typeof rpc_calls[ h.id ].callback === 'function') {
                // answer:
                rpc_calls[ h.id ].callback.apply(rpc_calls[ h.id ].callback, args);
                delete rpc_calls[ h.id ];
            }
        }



        // Public:
        this.createServer = function(port, host, max_connection, callback) {
            server = net.createServer({
                allowHalfOpen: false
            });
            server.on('connection', function(socket) {
                var sdp = new SdpProtocol(socket);
                sdp.on('data', function(packet){
                    // SERVER DATA RECIVED:
                    if (self.hasRpc() && packet.getCommand() == 'rpc') {
                        console.log('RPC PACKET RECIVED')
                        responseRemoteCall(sdp, packet);
                    } else {
                        console.log('PACKET RECIVED')
                        sdp.emit('packet', packet);
                    }
                });
                if (timeout > 0) {
                    socket.setTimeout(timeout);
                }
                self.emit('connection', sdp, self.hasRpc() ? createRemoteObject(sdp) : undefined);
            })
            .on('listening', self.onListening)
            .on('close', self.onClose)
            .on('error', self.onError)
            .startListening = function(port, host, max_connection, callback) {
                global.log.msg('Start listening')
                if (typeof this.listeningRetry != 'undefined') {
                    this.listeningRetry--;
                } else {
                    this.listeningRetry = 3;
                }
                return this.listen(port, host, max_connection, callback);
            }
            server.startListening(port, host, max_connection, callback);
            
            return server;
        }



        this.connect = function(options, callback) {
            var socket = net.createConnection(options);
            socket.on('connect', function() {
                var sdp = new SdpProtocol(socket);
                sdp.on('data', function(packet){
                    // CLIENT DATA RECIVED:
                    if (self.hasRpc() && packet.getCommand() == 'rpc') {
                        responseRemoteCall(sdp, packet);
                    } else {
                        //console.log('PACKET RECIVED: ')
                        self.emit('packet', packet);
                    }
                });
                self.emit('connect', sdp, self.hasRpc() ? createRemoteObject(sdp) : undefined);
            })
            .on('error', self.onError)
            .on('close', self.onClose);
            
            return socket;
        }
        
        
        
        this.hasRpc = function() {
            return (typeof rpc === 'object');
        }
        
        
        
        this.setRpc = function(rpcObject) {
            rpc = rpcObject;
        }
        
        

        this.onListening = function() {
            self.emit('listening');
        }



        this.sendPacket = function(packet, callback) {
            sdp.writeData(packet, callback);
        }
              
              

        this.onConnection = function(socket) {
            self.emit('connect', socket);
            console.log('onConnection');
        }
        
        
        
        this.onClose = function(had_error) {
            self.emit('close', had_error);
            console.log('onClose');
        }
        
        
        
        this.onEnd = function() {
            self.emit('end');
        }
        
        
        this.onDrain = function() {
            self.emit('drain');
        }


        this.onTimeout = function() {
            self.emit('timeout');
        }
        
        
        
        this.onError = function(err) {
            console.log('onError');
            switch (err.code) {
                case 'EADDRINUSE':
                    //global.log.msg('Server error. Address already in use', -3);
                    if (this.listeningRetry > 0) {
                        setTimeout(function () {
                            server.startListening();
                        }, 5000);
                    } else {
                        //global.log.msg('Server fatal error. Unable to start server. Exit!', -3);
                        process.exit(2);

                    }
                    break;

                default:
                  self.emit('error', err);
            }
        }


        /*
        this.createRemoteObjectOneArg = function(sdp) {
            var obj = {}
            var handler = {
                get: function(recv, name) {
                    if (name == 'inspect') {
                        return false;
                    }
                    return obj[name] || function(data, callback) {
                        if (typeof callback === 'function') {
                            var new_rpc_id = (++rpc_id) + '_' + name;
                            if (typeof rpc_calls[ new_rpc_id ] === 'undefined') {
                                rpc_calls[ new_rpc_id ] = {
                                    callback: callback
                                }
                            } else {
                                throw new Error('createRemoteObject: RPC id is already')
                            }
                        } else {
                            rpc_id = false;
                        }
                        console.log('Call: ' +  name + ' with id', new_rpc_id)
                        sdp.send('rpc', data, {
                            id: new_rpc_id,
                            call: name
                        });
                        return true;
                    }
                    return false;
                },
                getOwnPropertyNames: function(name) {
                    return obj[name];
                },
                getOwnPropertyDescriptor: function(name) {
                    return Object.getOwnPropertyDescriptor(obj, name);
                },
                keys: function() {
                    return Object.keys(obj);
                }
            }
            return Proxy.create(handler);
        }



        this.responseRemoteCallOneArg = function(sdp, packet, callback) {
            var h = packet.getHeader();
            if (h.call && typeof rpc === 'object' && typeof rpc[ h.call ] === 'function') {
               // call procedure:
               rpc[ h.call ](packet.getData(), function(data) {
                   sdp.send('rpc', data, {
                       id: h.id
                   }, callback);
                });
            } else if (h.id && typeof rpc_calls[ h.id ] ==='object' && typeof rpc_calls[ h.id ].callback === 'function') {
                rpc_calls[ h.id ].callback(packet.getData());
                delete rpc_calls[ h.id ];
            }
        }
        */
    }
    
    util.inherits(Sdp, EventEmitter);
	module.exports = Sdp;
}());
