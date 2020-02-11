import ApolloClient from 'apollo-boost';

import fetch from 'node-fetch';
import { createHttpLink } from 'apollo-link-http';
import express from 'express';

import { makeExecutableSchema, addSchemaLevelResolveFunction } from 'apollo-server';
import { importSchema } from 'graphql-import';
import depthLimit from 'graphql-depth-limit';
import { ApolloServer } from 'apollo-server-express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { GraphQLScalarType, Kind } from 'graphql';
import DB from './api/DB.js';
import Resolvers from './api/resolvers.js';

import Cookies from 'cookies';

import jwt from'jsonwebtoken';

import gql from 'graphql-tag';

global.fetch = fetch
global.window = global
global.Headers = fetch.Headers
global.Request = fetch.Request
global.Response = fetch.Response
global.location = { hostname: '' }




var app = express();

const db = new DB();
const resolvers = new Resolvers(db);
const typeDefs = importSchema('./api/schema.graphql')
const schema = makeExecutableSchema({
    typeDefs: typeDefs,
    resolvers: resolvers.resolvers,
    inheritResolversFromInterfaces: true
});
const apollo = new ApolloServer({ schema, playground: true, validationRules: [depthLimit(5)] })


const configurations = {
    api: { ssl: false, port: 4000, hostname: 'localhost' },
    www: { ssl: false, port: 8080, hostname: 'localhost' }
};

apollo.applyMiddleware({ app });
var server = http.createServer(app)

apollo.installSubscriptionHandlers(server);
server.listen({ port: configurations['api'].port }, () =>
    console.log('API launched on port '+configurations['api'].port)
);



const client = new ApolloClient({
  uri: `http${configurations['api'].ssl ? 's' : ''}://${configurations['api'].hostname}:${configurations['api'].port}${apollo.graphqlPath}`
});

app.set('view engine', 'pug');

app.use('/styles',express.static('dist/styles'));
app.use('/images',express.static('dist/images'));
app.use('/js',express.static('dist/js'));






app.get('/', function (req, res) {
  var memory = {};

  var keys = ['JWT_R JWT_A theme']
  var cookies = new Cookies(req, res, { keys: keys })
  var JWT_A = cookies.get('JWT_A');
  var JWT_R = cookies.get('JWT_R');

  if (JWT_A){
    checkToken(JWT_A).then((data) => {
      if (data && data != -1 && data != 0) {
        memory.JWT = data;
        res.render('index', memory);
      } else if(data == 0){
        updateToken(JWT_R).then((data)=>{
          if (data.Access == ""){
            cookies.set('JWT_A', "", {maxAge: -1, signed:false})
            cookies.set('JWT_R', "", {maxAge: -1, signed:false})
            memory = {}
            res.redirect('/auth');
            res.render('auth', memory);
          } else {
            cookies.set('JWT_A', data.Access, {maxAge: 3600*24*30, signed:false})
            cookies.set('JWT_R', data.Refresh, {maxAge: 3600*24*30, signed:false})
            memory.JWT = jwt.decode(data.Access);
            res.render('index', memory);
          }
        })
      } else if(data == -1){
        cookies.set('JWT_A', "", {maxAge: -1, signed:false})
        cookies.set('JWT_R', "", {maxAge: -1, signed:false})
        res.redirect('/auth');
      }
    })
  } else {
    res.redirect('/auth');
  }
});

app.get('/ticket/', function (req, res) {
  var memory = {};

  var id = req.query.id;

  var keys = ['JWT_R JWT_A theme']
  var cookies = new Cookies(req, res, { keys: keys })
  var JWT_A = cookies.get('JWT_A');
  var JWT_R = cookies.get('JWT_R');

  if (JWT_A){
    checkToken(JWT_A).then((data) => {
      if (data && data != -1 && data != 0) {
        memory.JWT = data;
        getTicket(id).then((ticket)=>{
          
          memory.ticket = ticket;
          res.render('ticket', memory);
        });
      } else if(data == 0){
        updateToken(JWT_R).then((data)=>{
          if (data.Access == ""){
            cookies.set('JWT_A', "", {maxAge: -1, signed:false})
            cookies.set('JWT_R', "", {maxAge: -1, signed:false})
            memory = {}
            res.redirect('/auth');
            res.render('auth', memory);
          } else {
            cookies.set('JWT_A', data.Access, {maxAge: 3600*24*30, signed:false})
            cookies.set('JWT_R', data.Refresh, {maxAge: 3600*24*30, signed:false})
            memory.JWT = jwt.decode(data.Access);

            getTicket(id).then((ticket)=>{
              memory.ticket = ticket;
              res.render('ticket', memory);
            });
            
          }
        })
      } else if(data == -1){
        cookies.set('JWT_A', "", {maxAge: -1, signed:false})
        cookies.set('JWT_R', "", {maxAge: -1, signed:false})
        res.redirect('/auth');
      }
    })
  } else {
    res.redirect('/auth');
  }
});


app.get('/auth/', function (req, res) {
  var memory = {};

  var keys = ['JWT_R JWT_A theme']
  var cookies = new Cookies(req, res, { keys: keys })
  var JWT_A = cookies.get('JWT_A');
  var JWT_R = cookies.get('JWT_R');
  

  if (JWT_A){
    checkToken(JWT_A).then((data) => {
      if (data && data != -1 && data != 0) {
        memory.JWT = data;
        res.redirect('/');
      } else if(data == 0){
        updateToken(JWT_R).then((data)=>{
          if (data.Access == ""){
            cookies.set('JWT_A', "", {maxAge: -1, signed:false})
            cookies.set('JWT_R', "", {maxAge: -1, signed:false})
            memory = {}
            res.render('auth', memory);
          } else {
            cookies.set('JWT_A', data.Access, {maxAge: 3600*24*30, signed:false})
            cookies.set('JWT_R', data.Refresh, {maxAge: 3600*24*30, signed:false})
            memory.JWT = jwt.decode(data.Access);
            res.redirect('/');
          }
        })
      } else if(data == -1) {
        cookies.set('JWT_A', "", {maxAge: -1, signed:false})
        cookies.set('JWT_R', "", {maxAge: -1, signed:false})
        res.render('auth', memory);
      }
    })
  } else {
    res.render('auth', memory);
  }
  
});


app.listen(configurations['www'].port, () =>{
  console.log('Website launched on port ' + configurations['www'].port);
});






async function updateToken(Refresh) {
  const UPDATE_REQUEST = gql`
  mutation upd($Refresh: String!) {
      updateToken(
        refresh: $Refresh
      ) {
        Access
        Refresh
      }
    }
  `;


  return new Promise(function(resolve, reject) {
    client.mutate({
      mutation: UPDATE_REQUEST,
      variables: {
        Refresh: Refresh
      }
    })
      .then(data => resolve(data.data.updateToken))
      .catch(error => reject(error));
  });
}

async function getTicket(id) {
  var getTicket_REQUEST = gql`
  query ($ID: Int!) {
      ticket(
        id: $ID
      ) {
        ID
        name
        description
        status
        severity
        priority
        type
        createat
        tester{
          login
        }
        messages{
          content
          createat
          owner{
            login
          }
        }
        project{
          name
          shortname
          developer{
            login
          }
        }
      }
    }
  `;


  return new Promise(function(resolve, reject) {
    client.mutate({
      mutation: getTicket_REQUEST,
      variables: {
        ID: Number(id)
      }
    })
      .then(data => {
        resolve(data.data.ticket);
      })
      .catch(error => reject(error));
  });
}


async function checkToken(token) {
  return new Promise(function(resolve, reject) {
      return jwt.verify(token, 'O3uBcufY7VOv5o4DFcys', (err, decoded) => {
          if (err) {
              if (err.name === 'TokenExpiredError') {
                resolve(0);
                  //истёк
              }
              resolve(-1);
              //ложный токен
          }

          resolve(decoded);
      })
  });
}