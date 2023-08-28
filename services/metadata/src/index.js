const express = require("express");
const mongodb = require("mongodb");

function connectDb(dbhost, dbname) {
    return mongodb.MongoClient.connect(dbhost, { useUnifiedTopology: true }) 
        .then(client => {
            const db = client.db(dbname);
            return {                
                db: db,             
                close: () => {      
                    return client.close();
                },
            };
        });
}

function setupHandlers(microservice) {

    const videosCollection = microservice.db.collection("videos");

    microservice.app.get("/videos", (req, res) => {
        videosCollection.find()
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
}

function startHttpServer(dbConn) {
    return new Promise(resolve => {
        const app = express();
        console.log(express());
        const microservice = {
            app: app,
            db: dbConn.db,
        }
        setupHandlers(microservice);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3000;
        const server = app.listen(port, () => { console.log('started service on port ' + port) });

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
}

function startMicroservice(dbhost, dbname) {
    return connectDb(dbhost, dbname)
        .then(dbConn => {
            return startHttpServer(dbConn);
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
        
    return startMicroservice(DBHOST, DBNAME);
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
    // Otherwise we are running under test
    module.exports = {
        startMicroservice,
    };
}
