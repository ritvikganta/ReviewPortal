import React, { useState } from "react";
import "./ReviewPortal.css"; // Create this CSS file for styles

const BASE_URL = "https://24btc08zqk.execute-api.us-west-2.amazonaws.com/prod";

const credentials = {
  username: "cm9tYW4ucnViYW55a0Bvbml4LXN5c3RlbXMuY29t",
  password: "ciMxMTExMTE="
};

const ReviewPortal = () => {
  const [idToken, setIdToken] = useState(null);
  const [response, setResponse] = useState("Select an action to start...");
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState([]);

  const updateStatus = (message, success = true) => {
    setStatus({ message, success });
  };

  const getIdToken = async () => {
    updateStatus("Fetching ID token...");
    try {
      const res = await fetch(`${BASE_URL}/users/auth/get-id-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        mode: "cors", // Added mode for CORS
        credentials: "include" // Added credentials
      });
      if (!res.ok) throw new Error("Error fetching ID token");

      const data = await res.json();
      setIdToken(data.idToken);
      updateStatus("ID token fetched successfully.", true);
      setResponse(`ID Token: ${data.idToken}`);
    } catch (err) {
      updateStatus("Failed to fetch ID token.", false);
      setResponse(`Error: ${err.message}`);
    }
  };

  const loadUsersForReview = async () => {
    updateStatus("Loading users for review...");
    try {
      const res = await fetch(`${BASE_URL}/verifications/getUsersForReview`, {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
        mode: "cors",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Error fetching users");

      const data = await res.json();
      setUsers(data);
      updateStatus("Users loaded successfully.", true);
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      updateStatus("Failed to load users.", false);
      setResponse(`Error: ${err.message}`);
    }
  };

  return (
    <div className="container">
      <h1>Review Portal</h1>
      <div className="action-buttons">
        <button onClick={getIdToken}>Get ID Token</button>
        <button onClick={loadUsersForReview} disabled={!idToken}>
          Load Users for Review
        </button>
      </div>
      <pre>{response}</pre>
      <div>
        {status && (
          <div style={{ color: status.success ? "green" : "red" }}>
            {status.message}
          </div>
        )}
      </div>
      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Name</th>
            <th>Verification Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, idx) => (
            <tr key={idx}>
              <td>{user.userId}</td>
              <td>{`${user.firstName} ${user.lastName}`}</td>
              <td>{user.verificationStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReviewPortal;
