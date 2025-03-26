import { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription, gql } from '@apollo/client';
import './app.css';
// GraphQL operations
const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      userId
    }
  }
`;

const POST_ADDED = gql`
  subscription PostAdded {
    postAdded {
      id
      title
      content
      userId
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!, $userId: Int!) {
    createPost(title: $title, content: $content, userId: $userId) {
      id
      title
      content
      userId
    }
  }
`;

function App() {
  const [formState, setFormState] = useState({
    title: '',
    content: '',
    userId: 1
  });

  // Fetch posts
  const { loading, error, data, refetch } = useQuery(GET_POSTS);

  // Create post mutation
  const [createPost] = useMutation(CREATE_POST, {
    onCompleted: () => {
      setFormState({ ...formState, title: '', content: '' });
      showNotification("Post created successfully!", "success");
    },
    onError: (error) => {
      showNotification(`Failed to create post: ${error.message}`, "error");
    }
  });


  useSubscription(POST_ADDED, {
    onSubscriptionData: ({ subscriptionData }) => {
      showNotification("New post added!", "success");
      refetch(); 
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createPost({ variables: formState });
  };

  if (loading) return <div className="loading">Loading posts...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="app-container">
      <h1>Real-Time Posts</h1>
      
      <form onSubmit={handleSubmit} className="post-form">
        <input
          type="text"
          value={formState.title}
          onChange={(e) => setFormState({ ...formState, title: e.target.value })}
          placeholder="Post title"
          required
        />
        <textarea
          value={formState.content}
          onChange={(e) => setFormState({ ...formState, content: e.target.value })}
          placeholder="Post content"
          required
        />
        <input
          type="number"
          value={formState.userId}
          onChange={(e) => setFormState({ ...formState, userId: parseInt(e.target.value) })}
          placeholder="User ID"
          min="1"
        />
        <button type="submit">Create Post</button>
      </form>

      <div className="posts-table">
        <h2>Recent Posts</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Content</th>
              <th>User ID</th>
            </tr>
          </thead>
          <tbody>
            {data?.posts?.map((post) => (
              <tr key={post.id}>
                <td>{post.id}</td>
                <td>{post.title}</td>
                <td>{post.content}</td>
                <td>{post.userId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <NotificationContainer />
    </div>
  );
}

// Notification component
function NotificationContainer() {
  const [notifications, setNotifications] = useState([]);

  const showNotification = (message, type) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  // Make showNotification available globally in the component tree
  useEffect(() => {
    window.showNotification = showNotification;
    return () => {
      delete window.showNotification;
    };
  }, []);

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div key={notification.id} className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      ))}
    </div>
  );
}

export default App;
