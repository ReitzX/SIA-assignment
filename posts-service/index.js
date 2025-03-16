const { ApolloServer, gql } = require("apollo-server");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const typeDefs = gql`
  type Post {
    id: ID!
    title: String!
    content: String!
    userId: Int!
  }

  type Query {
    posts: [Post]
    post(id: ID!): Post
  }

  type Mutation {
    createPost(title: String!, content: String!, userId: Int!): Post
    updatePost(id: ID!, title: String, content: String): Post
    deletePost(id: ID!): Post
  }
`;

const resolvers = {
  Query: {
    posts: () => prisma.post.findMany(),
    post: (_, { id }) => prisma.post.findUnique({ where: { id: parseInt(id) } }),
  },
  Mutation: {
    createPost: (_, { title, content, userId }) =>
      prisma.post.create({ data: { title, content, userId } }),

    updatePost: (_, { id, title, content }) => 
      prisma.post.update({
        where: { id: parseInt(id) },
        data: { title, content },
      }),

    deletePost: (_, { id }) => 
      prisma.post.delete({
        where: { id: parseInt(id) },
      }),
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen(4002).then(({ url }) => console.log(`🚀 Posts service running at ${url}`));
