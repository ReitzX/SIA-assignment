import { ApolloClient, InMemoryCache, gql, HttpLink, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

// GraphQL Endpoints
const HTTP_URI = "http://localhost:4002/graphql"; // HTTP API
const WS_URI = "ws://localhost:4002/graphql"; // WebSocket for subscriptions

// HTTP Link (for queries & mutations)
const httpLink = new HttpLink({ uri: HTTP_URI });

// WebSocket Link (using graphql-ws)
const wsLink = new GraphQLWsLink(
    createClient({
        url: WS_URI,
        connectionParams: {
            reconnect: true, // Allow auto-reconnection
        },
        shouldRetry: () => true, // Retry on failure
    })
);


// Use WebSocket for subscriptions & HTTP for everything else
const link = split(
    ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === "OperationDefinition" && definition.operation === "subscription";
    },
    wsLink,
    httpLink
);

// Apollo Client
const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
});

// GraphQL Query to fetch all posts
const GET_POSTS = gql`
    query {
        posts {
            id
            title
            content
            userId
        }
    }
`;

// GraphQL Subscription to listen for new posts
const POST_SUBSCRIPTION = gql`
    subscription {
        postAdded {
            id
            title
            content
            userId
        }
    }
`;

// Function to render posts
function renderPosts(posts) {
    const tableBody = document.getElementById("postsTable");
    tableBody.innerHTML = ""; // Clear existing rows

    posts.forEach(({ userId, title, content }) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${userId}</td><td>${title}</td><td>${content}</td>`;
        tableBody.appendChild(row);
    });
}

// Fetch posts and update UI
client
    .query({ query: GET_POSTS })
    .then(response => renderPosts(response.data.posts))
    .catch(error => console.error("Error fetching posts:", error));

// Subscribe to new posts and update UI in real time
client.subscribe({ query: POST_SUBSCRIPTION }).subscribe({
    next({ data }) {
        console.log("New post received:", data.postAdded);
        
        // Append new post to the table dynamically
        const tableBody = document.getElementById("postsTable");
        const row = document.createElement("tr");
        row.innerHTML = `<td>${data.postAdded.userId}</td><td>${data.postAdded.title}</td><td>${data.postAdded.content}</td>`;
        tableBody.prepend(row); // Add new post at the top
    },
    error(error) {
        console.error("Subscription error:", error);
    }
});
