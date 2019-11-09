var tape = require('tape')
var sodium = require('sodium-universal')
var create = require('./helpers/create')

tape('write and read', function(t) {
    var vault = create()

    vault.writeFile('/hello.txt', 'world', function(err) {
        t.error(err, 'no error')
        vault.readFile('/hello.txt', function(err, buf) {
            t.error(err, 'no error')
            t.same(buf, new Buffer('world'))
            t.end()
        })
    })
})

tape('write and read (2 parallel)', function(t) {
    t.plan(6)

    var vault = create()

    vault.writeFile('/hello.txt', 'world', function(err) {
        t.error(err, 'no error')
        vault.readFile('/hello.txt', function(err, buf) {
            t.error(err, 'no error')
            t.same(buf, new Buffer('world'))
        })
    })

    vault.writeFile('/world.txt', 'hello', function(err) {
        t.error(err, 'no error')
        vault.readFile('/world.txt', function(err, buf) {
            t.error(err, 'no error')
            t.same(buf, new Buffer('hello'))
        })
    })
})

tape('write and read (sparse)', function(t) {
    t.plan(2)

    var vault = create()
    vault.on('ready', function() {
        var clone = create(vault.key, { sparse: true })

        vault.writeFile('/hello.txt', 'world', function(err) {
            t.error(err, 'no error')
            var stream = clone.replicate()
            stream.pipe(vault.replicate()).pipe(stream)

            var readStream = clone.createReadStream('/hello.txt')
            readStream.on('data', function(data) {
                t.same(data.toString(), 'world')
            })
        })
    })
})

tape('write and unlink', function(t) {
    var vault = create()

    vault.writeFile('/hello.txt', 'world', function(err) {
        t.error(err, 'no error')
        vault.unlink('/hello.txt', function(err) {
            t.error(err, 'no error')
            vault.readFile('/hello.txt', function(err) {
                t.ok(err, 'had error')
                t.end()
            })
        })
    })
})

tape('root is always there', function(t) {
    var vault = create()

    vault.access('/', function(err) {
        t.error(err, 'no error')
        vault.readdir('/', function(err, list) {
            t.error(err, 'no error')
            t.same(list, [])
            t.end()
        })
    })
})

tape('owner is writable', function(t) {
    var vault = create()

    vault.on('ready', function() {
        t.ok(vault.writable)
        t.ok(vault.metadata.writable)
        t.ok(vault.content.writable)
        t.end()
    })
})

tape('provide keypair', function(t) {
    var publicKey = new Buffer(sodium.crypto_sign_PUBLICKEYBYTES)
    var secretKey = new Buffer(sodium.crypto_sign_SECRETKEYBYTES)

    sodium.crypto_sign_keypair(publicKey, secretKey)

    var vault = create(publicKey, { secretKey: secretKey })

    vault.on('ready', function() {
        t.ok(vault.writable)
        t.ok(vault.metadata.writable)
        t.ok(vault.content.writable)
        t.ok(publicKey.equals(vault.key))

        vault.writeFile('/hello.txt', 'world', function(err) {
            t.error(err, 'no error')
            vault.readFile('/hello.txt', function(err, buf) {
                t.error(err, 'no error')
                t.same(buf, new Buffer('world'))
                t.end()
            })
        })
    })
})

tape('download a version', function(t) {
    var src = create()
    src.on('ready', function() {
        t.ok(src.writable)
        t.ok(src.metadata.writable)
        t.ok(src.content.writable)
        src.writeFile('/first.txt', 'number 1', function(err) {
            t.error(err, 'no error')
            src.writeFile('/second.txt', 'number 2', function(err) {
                t.error(err, 'no error')
                src.writeFile('/third.txt', 'number 3', function(err) {
                    t.error(err, 'no error')
                    t.same(src.version, 3)
                    testDownloadVersion()
                })
            })
        })
    })

    function testDownloadVersion() {
        var clone = create(src.key, { sparse: true })
        clone.on('content', function() {
            t.same(clone.version, 3)
            clone.checkout(2).download(function(err) {
                t.error(err)
                clone.readFile('/second.txt', { cached: true }, function(err, content) {
                    t.error(err, 'block not downloaded')
                    t.same(content && content.toString(), 'number 2', 'content does not match')
                    clone.readFile('/third.txt', { cached: true }, function(err, content) {
                        t.same(err && err.message, 'Block not downloaded')
                        t.end()
                    })
                })
            })
        })
        var stream = clone.replicate()
        stream.pipe(src.replicate()).pipe(stream)
    }
})

tape('write and read, no cache', function(t) {
    var vault = create({
        metadataStorageCacheSize: 0,
        contentStorageCacheSize: 0,
        treeCacheSize: 0
    })

    vault.writeFile('/hello.txt', 'world', function(err) {
        t.error(err, 'no error')
        vault.readFile('/hello.txt', function(err, buf) {
            t.error(err, 'no error')
            t.same(buf, new Buffer('world'))
            t.end()
        })
    })
})

tape('closing a read-only, latest clone', function(t) {
    // This is just a sample key of a dead ddrive
    var clone = create('1d5e5a628d237787afcbfec7041a16f67ba6895e7aa31500013e94ddc638328d', {
        latest: true
    })
    clone.on('error', function(err) {
        t.fail(err)
    })
    clone.close(function(err) {
        t.error(err)
        t.end()
    })
})

tape('no .. entries', function(t) {
    var vault = create()

    vault.writeFile('../hello.txt', 'world', function(err) {
        t.error(err, 'no error')
        vault.readdir('/', function(err, list) {
            t.error(err, 'no error')
            t.same(list, ['hello.txt'])
            t.end()
        })
    })
})