const express = require("express");
const mongodb = require("mongodb");
const amqp = require('amqplib');
const bodyParser = require("body-parser");

function connectDb(dbHost, dbName) {
    return mongodb.MongoClient.connect(dbHost, { useUnifiedTopology: true }) 
        .then(client => {
            const db = client.db(dbName);
            return {
                db: db,
                close: () => {
                    return client.close();
                },
            };
        });
}

function connectRabbit(rabbitHost) {

    // console.log(`Connecting to RabbitMQ server at ${rabbitHost}.`);

    return amqp.connect(rabbitHost)
        .then(messagingConnection => {
            // console.log("Connected to RabbitMQ.");

            return messagingConnection.createChannel();
        });
}

function setupHandlers(microservice) {

    const videosCollection = microservice.db.collection("videos");

    microservice.app.get("/videos", (req, res) => {
        return videosCollection.find()
            .toArray()
            .then(videos => {
                res.json({
                    videos: videos
                });
            })
            .catch(err => {
                console.error("Failed to get videos collection from database!");
                console.error(err && err.stack || err);
                res.sendStatus(500);
            });
    });

    
    microservice.app.get("/video", (req, res) => {
        const videoId = new mongodb.ObjectID(req.query.id);
        return videosCollection.findOne({ _id: videoId })
            .then(video => {
                if (!video) {
                    res.sendStatus(404);
                }
                else {
                    res.json({ video });
                }
            })
            .catch(err => {
                console.error(`Failed to get video ${videoId}.`);
                console.error(err);
                res.sendStatus(500);
            });
    });
    
    function consumeVideoUploadedMessage(msg) { 
        console.log("Received a 'viewed-uploaded' message");

        const parsedMsg = JSON.parse(msg.content.toString());

        const videoMetadata = {
            _id: new mongodb.ObjectID(parsedMsg.video.id),
            name: parsedMsg.video.name,
        };
        
        return videosCollection.insertOne(videoMetadata)
            .then(() => {
                console.log("Acknowledging message was handled.");                
                microservice.messageChannel.ack(msg);
            });
    };

    return microservice.messageChannel.assertExchange("video-uploaded", "fanout")
        .then(() => {
            return microservice.messageChannel.assertQueue("", {});
        })
        .then(response => {
            const queueName = response.queue;
            // console.log(`Created queue ${queueName}, binding it to "video-uploaded" exchange.`);
            return microservice.messageChannel.bindQueue(queueName, "video-uploaded", "")
                .then(() => {
                    return microservice.messageChannel.consume(queueName, consumeVideoUploadedMessage);
                });
        });
}

//
// Starts the Express HTTP server.
//
function startHttpServer(dbConn, messageChannel) {
    return new Promise(resolve => {
        const app = express();
        const microservice = {
            app: app,
            db: dbConn.db,
			messageChannel: messageChannel,
        };
		app.use(bodyParser.json());
        setupHandlers(microservice);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3000;
        const server = app.listen(port, () => {
            microservice.close = () => {
                return new Promise(resolve => {
                    server.close(() => {
            resolve();
        });
                })
                .then(() => {
                    return dbConn.close();
                });
            };
            resolve(microservice);
        });
    });
}

function startMicroservice(dbHost, dbName, rabbitHost) {
    return connectDb(dbHost, dbName)
        .then(dbConn => {
			return connectRabbit(rabbitHost)
				.then(messageChannel => {
            		return startHttpServer(
						dbConn, 
						messageChannel
					);	
				});
        });
}

function main() {
    if (!process.env.DBHOST) {
        throw new Error("Please specify the database host using environment variable DBHOST.");
    }
    
    const DBHOST = process.env.DBHOST;

    if (!process.env.DBNAME) {
        throw new Error("Please specify the database name using environment variable DBNAME.");
    }
    
    const DBNAME = process.env.DBNAME;
        
	if (!process.env.RABBIT) {
	    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
	}
	
	const RABBIT = process.env.RABBIT;

    return startMicroservice(DBHOST, DBNAME, RABBIT);
}

if (require.main === module) {
    
	main()
	    .then(() => console.log("Microservice online."))
	    .catch(err => {
	        console.error("Microservice failed to start.");
	        console.error(err && err.stack || err);
	    });
}
else {
    // For testing
    module.exports = {
        startMicroservice,
    };
}

