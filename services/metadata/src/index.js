const express = require("express");
const mongodb = require("mongodb");
const bodyParser = require("body-parser");

function connectDb(dbhost, dbname) {
    return mongodb.MongoClient.connect(dbhost) 
        .then(client => {
            return client.db(dbname);
        });
}

function setupHandlers(app, db) {

    const videosCollection = db.collection("videos");

    app.get("/videos", (req, res) => {
        videosCollection.find()
            .toArray() // TODO Pagination
            .then(videos => {
                res.json({ videos });
            })
            .catch(err => {
                console.error("Failed to get videos collection.");
                console.error(err);
                res.sendStatus(500);
            });
    });
}

function startHttpServer(db,) {
    return new Promise(resolve => {
        const app = express();
        app.use(bodyParser.json());
        setupHandlers(app, db);

        const port = process.env.PORT && parseInt(process.env.PORT) || 3000;
        app.listen(port, () => {
            resolve();
        });
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
