
describe("metadata service Unit tests", () => {

    const mockListenFn = jest.fn((port, callback) => callback());
    const mockGetFn = jest.fn();
    const mockUseFn = jest.fn();
    
    afterAll(() => {
        jest.resetModules();
        jest.resetAllMocks();
    });

    jest.doMock("express", () => {
        return () => {
            return {
                close: mockUseFn,
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