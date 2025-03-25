const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const { PrismaClient } = require("@prisma/client");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createServer } = require("http");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { PubSub } = require("graphql-subscriptions");

const prisma = new PrismaClient();
const pubsub = new PubSub();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const typeDefs = `#graphql
  type Post {
    id: ID!
    title: String!
    content: String!
    userId: Int!
  }

  type Query {
    posts: [Post!]!
  }

  type Mutation {
    createPost(title: String!, content: String!, userId: Int!): Post!
    deletePost(id: ID!): Post
  }

  type Subscription {
    postAdded: Post!
    postDeleted: Post!
  }
`;

const resolvers = {
  Query: {
    posts: () => prisma.post.findMany(),
  },
  Mutation: {
    createPost: async (_, { title, content, userId }) => {
      const newPost = await prisma.post.create({
        data: { title, content, userId },
      });

      // Publish the new post event
      pubsub.publish("POST_ADDED", { postAdded: newPost });

      return newPost;
    },
    deletePost: async (_, { id }) => {
      const post = await prisma.post.findUnique({ where: { id: Number(id) } });

      if (!post) {
        throw new Error("Post not found");
      }

      await prisma.post.delete({ where: { id: Number(id) } });

      // Publish the deleted post event
      pubsub.publish("POST_DELETED", { postDeleted: post });

      return post;
    },
  },
  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterableIterator(["POST_ADDED"]),
    },
    postDeleted: {
      subscribe: () => pubsub.asyncIterableIterator(["POST_DELETED"]),
    },
  },
};

// Create schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create Apollo Server
const server = new ApolloServer({ schema });

async function startServer() {
  await server.start();
  app.use("/graphql", expressMiddleware(server));

  // Create HTTP & WebSocket Server
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  useServer({ schema }, wsServer);

  httpServer.listen(4002, () => {
    console.log("🚀 GraphQL & WebSocket Server running on http://localhost:4002/graphql");
  });
}

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
