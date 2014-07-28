SDP
===

High performance json, binary, rpc communication protocol in javascript.

Usage:

Create client:
===

var Sdp = require('./Sdp');

    var client = new Sdp({
        clientFunc: function(arg, callback) {
            callback('This argument will be sent to server as . Hello message :)');
        }
    });
    client.connect({
        port: 13330,
        host: localhost
    }, function(client) {
        // some initial code
    });

    client.on('connect', function(remote) {
        require('crypto').randomBytes(100000, function(ex, buf) {
            //buf = new Buffer(buf);

            setInterval(function() {
                remote.remoteFunc(buf, 'BUFF', function(response) {
                    console.log('Got response: ' + response)
                });
            }, 1);

        });

    })
    client.on('packet', function(packet) {
        console.log('RECIVED: ' + packet, packet.getData().length);
    });



Create server:
===

    var server = new Sdp({
        remoteFunc: function(buf, arg1, callback) {
            console.log('God buf with lenhth:' + buf.length, ':', arg1)
            callback('response from Sdp');
        }
    });
    server.createServer(13330);

    server.on('packet', function(packet) {
        console.log('SV RECIVED: ' + packet, packet.getData().length);
    })
    server.on('error', function(err) {
        console.log('SV ERROR: ', err);
    })
    server.on('listening', function() {
        console.log('derver started');
    })
    server.on('connection', function(remote) {

        setInterval(function() {
            remote.clientFunc('Sendig to client: ', function(response) {
                console.log('Recived from client: ' + response);
            })
        }, 0);


    })