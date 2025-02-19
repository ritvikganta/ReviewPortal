import React, { useState, useEffect } from "react";
import CryptoJS from "crypto-js";
import "./ReviewPortal.css";

const BASE_URL = "https://24btc08zqk.execute-api.us-west-2.amazonaws.com/prod";
const SECRET_KEY = "4UkZ5SwheeMHyLyf8SGyRwdJWoRVItuOxH9VcjiG990UGLyCE0Zo9xeZ23ZxOCoT"; 

// Use CryptoJS to encrypt payload
const encryptPayload = (text) => {
  // Derive a 256-bit key using SHA-256
  const key = CryptoJS.SHA256(SECRET_KEY);
  // Generate a random 16-byte IV
  const iv = CryptoJS.lib.WordArray.random(16);
  // Encrypt the text using AES-256 in CBC mode with PKCS7 padding
  const encrypted = CryptoJS.AES.encrypt(text, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // Get the ciphertext as a hex string
  const encryptedHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
  // Get the IV as a hex string
  const ivHex = iv.toString(CryptoJS.enc.Hex);
  // Concatenate IV and ciphertext with a colon
  return ivHex + ":" + encryptedHex;
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
        const encryptedUsername = encryptPayload("1853f15511ba556d7a4c10738abcc6bb:8b8e2e513b65a6d3f732a0f88570d2d482b960d254df27a28e987bc30aeea473");
        const encryptedPassword = encryptPayload("7f6da1cc8094a20a48a156f311b8ee8a:d71471f6f9cf87e4929d660de59de23c");

        const res = await fetch(`${BASE_URL}/users/auth/get-id-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "1853f15511ba556d7a4c10738abcc6bb:8b8e2e513b65a6d3f732a0f88570d2d482b960d254df27a28e987bc30aeea473",
            password: "7f6da1cc8094a20a48a156f311b8ee8a:d71471f6f9cf87e4929d660de59de23c",
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
      listUsersForReview();
    }
  }, [idToken]);

  const updateStatus = (message, success = true) => {
    setStatus({ message, success });
  };

  const listUsersForReview = async (key = null) => {
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
      console.error("Fetch error (listUsersForReview):", err);
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
        <button onClick={() => listUsersForReview()} disabled={!idToken}>
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
        <button onClick={() => listUsersForReview(nextKey)}>Load More</button>
      )}
    </div>
  );
};

export default ReviewPortal;
