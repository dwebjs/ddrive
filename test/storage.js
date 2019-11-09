var tape = require('tape')
var tmp = require('temporary-directory')
var create = require('./helpers/create')
var ddrive = require('..')

tape('ram storage', function(t) {
    var vault = create()

    vault.ready(function() {
        t.ok(vault.metadata.writable, 'vault metadata is writable')
        t.ok(vault.content.writable, 'vault content is writable')
        t.end()
    })
})

tape('dir storage with resume', function(t) {
    tmp(function(err, dir, cleanup) {
        t.ifError(err)
        var vault = ddrive(dir)
        vault.ready(function() {
            t.ok(vault.metadata.writable, 'vault metadata is writable')
            t.ok(vault.content.writable, 'vault content is writable')
            t.same(vault.version, 0, 'vault has version 0')
            vault.close(function(err) {
                t.ifError(err)

                var vault2 = ddrive(dir)
                vault2.ready(function() {
                    t.ok(vault2.metadata.writable, 'vault2 metadata is writable')
                    t.ok(vault2.content.writable, 'vault2 content is writable')
                    t.same(vault2.version, 0, 'vault has version 0')

                    cleanup(function(err) {
                        t.ifError(err)
                        t.end()
                    })
                })
            })
        })
    })
})

tape('dir storage for non-writable vault', function(t) {
    var src = create()
    src.ready(function() {
        tmp(function(err, dir, cleanup) {
            t.ifError(err)

            var clone = ddrive(dir, src.key)
            clone.on('content', function() {
                t.ok(!clone.metadata.writable, 'clone metadata not writable')
                t.ok(!clone.content.writable, 'clone content not writable')
                t.same(clone.key, src.key, 'keys match')
                cleanup(function(err) {
                    t.ifError(err)
                    t.end()
                })
            })

            var stream = clone.replicate()
            stream.pipe(src.replicate()).pipe(stream)
        })
    })
})

tape('dir storage without permissions emits error', function(t) {
    t.plan(1)
    var vault = ddrive('/')
    vault.on('error', function(err) {
        t.ok(err, 'got error')
    })
})

tape('write and read (sparse)', function(t) {
    t.plan(3)

    tmp(function(err, dir, cleanup) {
        t.ifError(err)
        var vault = ddrive(dir)
        vault.on('ready', function() {
            var clone = create(vault.key, { sparse: true })
            clone.on('ready', function() {
                vault.writeFile('/hello.txt', 'world', function(err) {
                    t.error(err, 'no error')
                    var stream = clone.replicate()
                    stream.pipe(vault.replicate()).pipe(stream)
                    var readStream = clone.createReadStream('/hello.txt')
                    readStream.on('error', function(err) {
                        t.error(err, 'no error')
                    })
                    readStream.on('data', function(data) {
                        t.same(data.toString(), 'world')
                    })
                })
            })
        })
    })
})

tape('sparse read/write two files', function(t) {
    var vault = create()
    vault.on('ready', function() {
        var clone = create(vault.key, { sparse: true })
        vault.writeFile('/hello.txt', 'world', function(err) {
            t.error(err, 'no error')
            vault.writeFile('/hello2.txt', 'world', function(err) {
                t.error(err, 'no error')
                var stream = clone.replicate()
                stream.pipe(vault.replicate()).pipe(stream)
                clone.metadata.update(start)
            })
        })

        function start() {
            clone.stat('/hello.txt', function(err, stat) {
                t.error(err, 'no error')
                t.ok(stat, 'has stat')
                clone.readFile('/hello.txt', function(err, data) {
                    t.error(err, 'no error')
                    t.same(data.toString(), 'world', 'data ok')
                    clone.stat('/hello2.txt', function(err, stat) {
                        t.error(err, 'no error')
                        t.ok(stat, 'has stat')
                        clone.readFile('/hello2.txt', function(err, data) {
                            t.error(err, 'no error')
                            t.same(data.toString(), 'world', 'data ok')
                            t.end()
                        })
                    })
                })
            })
        }
    })
})