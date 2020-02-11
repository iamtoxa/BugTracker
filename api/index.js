const { gql, makeExecutableSchema, addSchemaLevelResolveFunction } = require('apollo-server');
const { importSchema } = require('graphql-import')
const depthLimit = require('graphql-depth-limit');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const fs = require('fs');
const https = require('https');
const http = require('http');

const { GraphQLScalarType, Kind } = require('graphql');

var DB = require('./DB.js');
var Resolvers = require('./resolvers.js');

const db = new DB();
const resolvers = new Resolvers(db);

const typeDefs = importSchema('schema.graphql')
const schema = makeExecutableSchema({
    typeDefs: typeDefs,
    resolvers: resolvers.resolvers,
    inheritResolversFromInterfaces: true
});
const apollo = new ApolloServer({ schema, playground: true, validationRules: [depthLimit(5)] })


const configurations = {
    development: { ssl: false, port: 4000, hostname: '127.0.0.1' }
};

const environment = 'development';
const config = configurations[environment];

const app = express();
apollo.applyMiddleware({ app });

var server;
if (config.ssl) {
    server = https.createServer({
            key: fs.readFileSync(`./ssl/${environment}/server.key`),
            cert: fs.readFileSync(`./ssl/${environment}/server.crt`)
        },
        app
    )
} else {
    server = http.createServer(app)
}

apollo.installSubscriptionHandlers(server);
server.listen({ port: config.port }, () =>
    console.log(
        '🚀 Server ready at',
        `http${config.ssl ? 's' : ''}://${config.hostname}:${config.port}${apollo.graphqlPath}`
    )
);
