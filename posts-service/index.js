const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const { PubSub } = require("graphql-subscriptions");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { json } = require("body-parser");

const prisma = new PrismaClient();
const pubsub = new PubSub();
const POST_ADDED = "POST_ADDED";

// Define GraphQL schema
const typeDefs = `#graphql
  type Post {
    id: ID!
    title: String!
    content: String!
    userId: Int!
  }

  type Query {
    posts: [Post]
  }

  type Mutation {
    createPost(title: String!, content: String!, userId: Int!): Post
  }

  type Subscription {
    postAdded: Post
  }
`;

const resolvers = {
  Query: {
    posts: async () => await prisma.post.findMany(),
  },
  Mutation: {
    createPost: async (_, { title, content, userId }) => {
      const newPost = await prisma.post.create({
        data: { title, content, userId },
      });
      console.log("Publishing new post:", newPost);
      pubsub.publish(POST_ADDED, { postAdded: newPost });

      return newPost;
    },
  },
  Subscription: {
    postAdded: {
      subscribe: (_, __, { pubsub }) => {
        console.log("New post subscription triggered");
        return pubsub.asyncIterator([POST_ADDED]);
      },
    },
  },
  
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Enable CORS and JSON body parsing
app.use(cors());
app.use(json());

// WebSocket Server for GraphQL Subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const wsServerCleanup = useServer(
  {
    schema,
    context: async (ctx, msg, args) => {
      return { pubsub }; 
    },
  },
  wsServer
);


// Create Apollo Server
const server = new ApolloServer({
  schema,
  introspection: true,
  plugins: [
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await wsServerCleanup.dispose();
          },
        };
      },
    },
  ],
  context: async ({ req }) => ({
    pubsub, // Pass pubsub to resolvers
  }),
});

async function startServer() {
  await server.start();
  app.use("/graphql", expressMiddleware(server));

  httpServer.listen(4002, () => {
    console.log(`🚀 Posts service running at http://localhost:4002/graphql`);
    console.log(`📡 Subscription endpoint ready at ws://localhost:4002/graphql`);
  });
}

// Graceful Prisma disconnection on exit
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
