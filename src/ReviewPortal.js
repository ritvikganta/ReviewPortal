import React, { useState, useEffect } from "react";
import crypto from "crypto";
import "./ReviewPortal.css";

const BASE_URL = "https://24btc08zqk.execute-api.us-west-2.amazonaws.com/prod";
const SECRET_KEY = "4UkZ5SwheeMHyLyf8SGyRwdJWoRVItuOxH9VcjiG990UGLyCE0Zo9xeZ23ZxOCoT"; 

const encryptPayload = (text) => {
  const key = crypto.createHash("sha256").update(SECRET_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
};

const ReviewPortal = () => {
  const [idToken, setIdToken] = useState(null);
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState([]);
  const [nextKey, setNextKey] = useState(null);
  const [userStates, setUserStates] = useState({});
  const [activeTab, setActiveTab] = useState("active");
  const [reviewerName, setReviewerName] = useState("");

  useEffect(() => {
    const fetchTokenOnMount = async () => {
      updateStatus("Fetching ID token...");
      try {
        const encryptedUsername = encryptPayload("cm9tYW4ucnViYW55a0Bvbml4LXN5c3RlbXMuY29t");
        const encryptedPassword = encryptPayload("ciMxMTExMTE=");

        const res = await fetch(`${BASE_URL}/auth/get-id-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: encryptedUsername,
            password: encryptedPassword,
          }),
          mode: "cors",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Error fetching ID token: ${res.statusText}`);
        }

        const data = await res.json();
        setIdToken(data.idToken);
        updateStatus("ID token fetched successfully.", true);
      } catch (err) {
        console.error("Fetch error (getIdToken):", err);
        updateStatus("Failed to fetch ID token.", false);
      }
    };

    fetchTokenOnMount();
  }, []);

  useEffect(() => {
    if (idToken) {
      loadUsersForReview();
    }
  }, [idToken]);

  const updateStatus = (message, success = true) => {
    setStatus({ message, success });
  };

  const loadUsersForReview = async (key = null) => {
    if (!idToken) return;

    updateStatus("Loading users for review...");
    try {
      const url = `${BASE_URL}/verifications?limit=10${
        key ? `&lastEvaluatedKey=${key}` : ""
      }`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        mode: "cors",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Error fetching users");

      const data = await res.json();
      const newUsers = data.users;

      setUsers((prevUsers) => {
        const combined = [...prevUsers, ...newUsers];
        const uniqueUsers = Array.from(
          new Set(combined.map((user) => user.userId))
        ).map((userId) => combined.find((user) => user.userId === userId));
        return uniqueUsers;
      });

      setNextKey(data.nextKey);
      updateStatus("Users loaded successfully.", true);
    } catch (err) {
      console.error("Fetch error (loadUsersForReview):", err);
      updateStatus("Failed to load users.", false);
    }
  };

  const updateUserVerificationEntry = async (userId, status, notes = "") => {
    if (!idToken) return;

    const newStatus = status === "accepted" ? "Verified" : "action_required";
    console.log(`Updating user ${userId} => ${newStatus}, notes: "${notes}"`);

    const payload = {
      newStatus,
      reviewerName,
      notes,
    };

    try {
      const res = await fetch(`${BASE_URL}/verifications/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
        mode: "cors",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Error updating verification status");

      updateStatus("Verification status updated successfully.", true);

      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.userId === userId
            ? { ...u, verificationStatus: newStatus, notes }
            : u
        )
      );
    } catch (err) {
      console.error("Update error (updateUserVerificationEntry):", err);
      updateStatus("Failed to update verification status.", false);
    }
  };

  return (
    <div className="container">
      <h1>Review Portal</h1>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          <strong>Reviewer Name: </strong>
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </label>
      </div>

      <div className="action-buttons">
        <button onClick={() => loadUsersForReview()} disabled={!idToken}>
          Load Users for Review
        </button>
      </div>

      <div className="tabs">
        <button
          onClick={() => setActiveTab("active")}
          className={activeTab === "active" ? "active" : ""}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={activeTab === "completed" ? "active" : ""}
        >
          Completed
        </button>
      </div>

      {status && (
        <div style={{ color: status.success ? "green" : "red" }}>
          {status.message}
        </div>
      )}

      {users.map((user) => (
        <div key={user.userId} className="user-card">
          <h3>{`${user.firstName} ${user.lastName}`}</h3>
          <p>User Type: {user.userType}</p>
          <p>Verification Status: {user.verificationStatus}</p>

          <div className="verification-actions">
            {user.verificationStatus === "pending" ? (
              <>
                <button
                  onClick={() =>
                    updateUserVerificationEntry(user.userId, "accepted")
                  }
                >
                  Accept
                </button>
                <button
                  onClick={() =>
                    updateUserVerificationEntry(user.userId, "rejected")
                  }
                >
                  Reject
                </button>
              </>
            ) : (
              <p style={{ fontStyle: "italic" }}>
                This request is already {user.verificationStatus}.
              </p>
            )}
          </div>
        </div>
      ))}

      {nextKey && (
        <button onClick={() => loadUsersForReview(nextKey)}>Load More</button>
      )}
    </div>
  );
};

export default ReviewPortal;
