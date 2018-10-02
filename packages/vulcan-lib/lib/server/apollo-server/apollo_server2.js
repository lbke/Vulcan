/**
 * @see https://www.apollographql.com/docs/apollo-server/whats-new.html
 * @see https://www.apollographql.com/docs/apollo-server/migration-two-dot.html
 */

// Migration:
// [ ] remove imports form graphql-tools everywhere
// [ ] engine: setup could be simplified
// [ ] switch to graphql playground

// no need to setup an http server anymore
import { graphiqlExpress } from 'apollo-server-express';
//import bodyParser from 'body-parser';

import express from 'express';
import { ApolloServer, makeExecutableSchema } from 'apollo-server';

// now in apollo-server
//import { makeExecutableSchema } from 'graphql-tools';
import compression from 'compression';
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
// import { Accounts } from 'meteor/accounts-base';

import { GraphQLSchema } from '../../modules/graphql.js';
import { Utils } from '../../modules/utils.js';
import { webAppConnectHandlersUse } from '../meteor_patch.js';

import { runCallbacks } from '../../modules/callbacks.js';
import cookiesMiddleware from 'universal-cookie-express';
// import Cookies from 'universal-cookie';

export let executableSchema;

import './settings';
import { engine, engineApiKey } from './engine';
import { defaultConfig } from './defaults';
console.log('defaultConfig', defaultConfig);
import makeOptionsBuilder from './makeOptionsBuilder';

// createApolloServer
const createApolloServer = (givenOptions = {}, givenConfig = {}) => {
  const graphiqlOptions = { ...defaultConfig.graphiqlOptions, ...givenConfig.graphiqlOptions };
  const config = { ...defaultConfig, ...givenConfig };
  config.graphiqlOptions = graphiqlOptions;

  const app = express();
  // given options contains the schema
  const apolloServer = new ApolloServer({
    // this replace the previous syntax graphqlExpress(async req => { ... })
    // this function takes the context, which contains the current request,
    // and setup the options accordingly ({req}) => { ...; return options }
    context: makeOptionsBuilder(givenOptions)
    // TODO: we could split options that actually need the request/result and others
    // (eg schema, formatError, etc.)
  });

  // default function does nothing
  // TODO: what is the correct api with v2?
  config.configServer({ apolloServer, app });

  // Use Engine middleware
  if (engineApiKey) {
    app.use(engine.expressMiddleware());
  }
  // setup middleware
  // cookies
  app.use(cookiesMiddleware());
  // compression
  app.use(compression());

  // setup graphql endpoint
  apolloServer.applyMiddleware({ app, path: config.path });

  // TODO: update with new api
  if (config.graphiql) {
    const graphiqlServer = graphiqlExpress({ ...config.graphiqlOptions, endpointURL: config.path });
    app.use(config.graphiQL, graphiqlServer);
  }

  // This binds the specified paths to the Express server running Apollo + GraphiQL
  webAppConnectHandlersUse(Meteor.bindEnvironment(apolloServer), {
    name: 'graphQLServerMiddleware_bindEnvironment',
    order: 30
  });
};

// createApolloServer when server startup
Meteor.startup(() => {
  runCallbacks('graphql.init.before');

  // typeDefs
  const generateTypeDefs = () => [
    `
scalar JSON
scalar Date

${GraphQLSchema.getAdditionalSchemas()}

${GraphQLSchema.getCollectionsSchemas()}

type Query {

${GraphQLSchema.queries
      .map(
        q =>
          `${
            q.description
              ? `  # ${q.description}
`
              : ''
          }  ${q.query}
  `
      )
      .join('\n')}
}

${
      GraphQLSchema.mutations.length > 0
        ? `type Mutation {

${GraphQLSchema.mutations
            .map(
              m =>
                `${
                  m.description
                    ? `  # ${m.description}
`
                    : ''
                }  ${m.mutation}
`
            )
            .join('\n')}
}
`
        : ''
    }
`
  ];

  const typeDefs = generateTypeDefs();

  GraphQLSchema.finalSchema = typeDefs;

  executableSchema = makeExecutableSchema({
    typeDefs,
    resolvers: GraphQLSchema.resolvers,
    schemaDirectives: GraphQLSchema.directives
  });

  createApolloServer({
    schema: executableSchema
  });
});
