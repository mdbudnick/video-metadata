const axios = require("axios");
const mongodb = require("mongodb");

describe("metadata service Unit tests", () => {

    const mockListenFn = jest.fn((port, callback) => callback());
    const mockGetFn = jest.fn();
    const mockUseFn = jest.fn();

    jest.doMock("express", () => {
        return () => {
            return {
                listen: mockListenFn,
                get: mockGetFn,
                use: mockUseFn
            };
        };
    });

    const mockVideosCollection = {
    };

    const mockDb = {
        collection: () => {
            return mockVideosCollection;
        }
    };

    const mockMongoClient = {
        db: () => {
            return mockDb;
        }
    };
    
    jest.doMock("mongodb", () => {
        return {
            MongoClient: {
                connect: async () => {
                    return mockMongoClient;
                }
            }
        };
    });

    const { startMicroservice } = require("./index"); 
    
    test("microservice starts web server on startup", async () => {
        
        await startMicroservice();

        expect(mockListenFn.mock.calls.length).toEqual(1);
        expect(mockListenFn.mock.calls[0][0]).toEqual(3000);
    });

    test("/videos route is handled", async () => {
        
        await startMicroservice();

        expect(mockGetFn).toHaveBeenCalled();

        const videosRoute = mockGetFn.mock.calls[0][0];
        expect(videosRoute).toEqual("/videos");
    });

    test("/videos route retrieves data via videos collection", async () => {

        await startMicroservice();

        const mockRequest = {};
        const mockJsonFn = jest.fn();
        const mockResponse = {
            json: mockJsonFn
        };

        const mockRecord1 = {};
        const mockRecord2 = {};

        mockVideosCollection.find = () => {
            return {
                toArray: async () => {
                    return [ mockRecord1, mockRecord2 ];
                }
            };
        };

        const videosRouteHandler = mockGetFn.mock.calls[0][1];
        await videosRouteHandler(mockRequest, mockResponse);

        expect(mockJsonFn.mock.calls.length).toEqual(1);
        expect(mockJsonFn.mock.calls[0][0]).toEqual({
            videos: [ mockRecord1, mockRecord2 ],
        });
    });

});

describe("metadata service Integration tests", () => {
    
    const BASE_URL = "http://localhost:3000";
    const DBHOST = "mongodb://localhost:27017";
    const DBNAME = "testdb";

    const { startMicroservice } = require("./index"); 

    let microservice;

    beforeAll(async () => {
        microservice = await startMicroservice(DBHOST, DBNAME);
    });

    afterAll(async () => {
        await microservice.close();
    });

    function httpGet(route) {
        const url = `${BASE_URL}${route}`;
        console.log(`Requesting ${url}`);
        return axios.get(url);
    }

    async function loadDatabaseFixture(collectionName, records) {
        await microservice.db.dropDatabase();

        const collection = microservice.db.collection(collectionName);
        await collection.insertMany(records);
    }
    
    test("/videos route retrieves data via videos collection", async () => {

        const id1 = new mongodb.ObjectId();
        const id2 = new mongodb.ObjectId();
        const videoPath1 = "my-video-1.mp4";
        const videoPath2 = "my-video-2.mp4";

        const testVideos = [
            {
                _id: id1,
                videoPath: videoPath1
            },
            {
                _id: id2,
                videoPath: videoPath2
            },
        ];

        await loadDatabaseFixture("videos", testVideos);
        
        const response = await httpGet("/videos");
        expect(response.status).toEqual(200);

        const videos = response.data.videos;
        expect(videos.length).toEqual(2);
        expect(videos[0]._id).toEqual(id1.toString());
        expect(videos[0].videoPath).toEqual(videoPath1);
        expect(videos[1]._id).toEqual(id2.toString());
        expect(videos[1].videoPath).toEqual(videoPath2);
    });

});
