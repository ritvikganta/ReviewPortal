import React, { useState, useEffect } from "react";
import "./ReviewPortal.css";

const BASE_URL = "https://24btc08zqk.execute-api.us-west-2.amazonaws.com/prod";

const credentials = {
  username: "cm9tYW4ucnViYW55a0Bvbml4LXN5c3RlbXMuY29t",
  password: "ciMxMTExMTE="
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
        const res = await fetch(`${BASE_URL}/users/auth/get-id-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          mode: "cors",              
          credentials: "include"      
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

  const listUsersforReview = async (key = null) => {
    if (!idToken) return;

    updateStatus("Loading users for review...");
    try {
      const url = `${BASE_URL}/verifications/listUsersForReview?limit=10${
        key ? `&lastEvaluatedKey=${key}` : ""
      }`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`
        },
        mode: "cors",               
        credentials: "include"     
      });

      if (!res.ok) throw new Error("Error fetching users");

      const data = await res.json();
      const newUsers = data.users;

      const usersWithSignedUrls = await Promise.all(
        newUsers.map(async (user) => {
          if (user.idDocumentKeys && user.idDocumentKeys.length > 0) {
            try {
              const presignedRes = await fetch(
                `${BASE_URL}/verifications/getSignedImageUrls`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ userId: user.userId }),
                  mode: "cors",            
                  credentials: "include"   
                }
              );

              if (presignedRes.ok) {
                const presignedData = await presignedRes.json();
                user.docSignedUrls = presignedData.signedUrls || [];
              } else {
                console.error(
                  "Failed to get signed URLs for user",
                  user.userId
                );
                user.docSignedUrls = [];
              }
            } catch (err) {
              console.error(
                "Error fetching docSignedUrls for user",
                user.userId,
                err
              );
              user.docSignedUrls = [];
            }
          } else {
            user.docSignedUrls = [];
          }
          return user;
        })
      );

      // Merge these new users into the existing array, filtering duplicates
      setUsers((prevUsers) => {
        const combined = [...prevUsers];
        usersWithSignedUrls.forEach((user) => {
          if (!combined.some((existing) => existing.userId === user.userId)) {
            combined.push(user);
          }
        });
        return combined;
      });

      setNextKey(data.nextKey);
      updateStatus("Users loaded successfully.", true);
    } catch (err) {
      console.error("Fetch error (loadUsersForReview):", err);
      updateStatus("Failed to load users.", false);
    }
  };

  /**
   * Convert "YYYY-MM-DD" => "Month Day, Year" 
   * to avoid off-by-one date issues.
   */
  const formatDateOfBirth = (dobStr) => {
    if (!dobStr) return "";
    const [year, month, day] = dobStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  /**
   * If "accepted", set newStatus = "Verified".
   * If "rejected", set newStatus = "action_required".
   */
  const updateVerificationStatus = async (userId, status, notes = "") => {
    if (!idToken) return;

    const newStatus = status === "accepted" ? "Verified" : "action_required";
    console.log(`Updating user ${userId} => ${newStatus}, notes: "${notes}"`);

    const payload = {
      userId,
      newStatus,
      reviewerName,
      notes,
      description: ""
    };

    console.log("Request payload:", payload);

    try {
      const res = await fetch(`${BASE_URL}/verifications/updateVerificationStatus`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(payload),
        mode: "cors",               // <--- CORS
        credentials: "include"      // <--- cookies
      });

      console.log("Response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Server error response:", errorData);
        throw new Error("Error updating verification status");
      }

      const data = await res.json();
      console.log("Update response:", data);
      updateStatus("Verification status updated successfully.", true);

      // Locally update the user's item to reflect new status & notes.
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.userId === userId
            ? { ...u, verificationStatus: newStatus, notes }
            : u
        )
      );
    } catch (err) {
      console.error("Update error (updateVerificationStatus):", err);
      updateStatus("Failed to update verification status.", false);
    }

    // Reset local radio/notes
    setUserStates((prevStates) => ({
      ...prevStates,
      [userId]: { selectedStatus: "", notes: "" }
    }));
  };

  const handleStatusChange = (userId, status) => {
    setUserStates((prevStates) => ({
      ...prevStates,
      [userId]: {
        ...prevStates[userId],
        selectedStatus: status
      }
    }));
  };

  const handleNotesChange = (userId, notes) => {
    setUserStates((prevStates) => ({
      ...prevStates,
      [userId]: {
        ...prevStates[userId],
        notes
      }
    }));
  };

  /**
   * "Active" => verificationStatus === "pending"
   * "Completed" => verificationStatus !== "pending"
   */
  const filteredUsers = users.filter((user) => {
    if (activeTab === "active") {
      return user.verificationStatus === "pending";
    } else {
      return user.verificationStatus !== "pending";
    }
  });

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

      {filteredUsers.map((user) => {
        const dobFormatted = formatDateOfBirth(user.dateOfBirth);
        const isPending = user.verificationStatus === "pending";

        return (
          <div key={user.userId} className="user-card">
            <h3>{`${user.firstName} ${user.lastName}`}</h3>
            <p>User Type: {user.userType}</p>
            <p>Verification Status: {user.verificationStatus}</p>
            {user.organization && <p>Organization: {user.organization}</p>}
            {dobFormatted && <p>Date of Birth: {dobFormatted}</p>}
            {user.notes && <p>Notes by Reviewer: {user.notes}</p>}

            {/* user.docSignedUrls => presigned GET URLs from getSignedImageUrls API */}
            {user.docSignedUrls && user.docSignedUrls.length > 0 && (
              <div style={{ display: "flex", gap: "1rem", margin: "8px 0" }}>
                {user.docSignedUrls.map((url, idx) => (
                  <img
                    key={`${user.userId}-doc-${idx}`}
                    src={url}
                    alt="ID Document"
                    style={{ width: 100, height: 100, objectFit: "cover" }}
                    onError={(e) => {
                      console.error(
                        "Image load error for user:",
                        user.userId,
                        "URL:",
                        url
                      );
                      e.target.onerror = null;
                      e.target.src = "default-image-url";
                    }}
                  />
                ))}
              </div>
            )}

            <div className="verification-actions">
              {isPending ? (
                <>
                  <label>
                    <input
                      type="radio"
                      name={`status-${user.userId}`}
                      value="accepted"
                      checked={
                        userStates[user.userId]?.selectedStatus === "accepted"
                      }
                      onChange={() =>
                        handleStatusChange(user.userId, "accepted")
                      }
                    />
                    Accept
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`status-${user.userId}`}
                      value="rejected"
                      checked={
                        userStates[user.userId]?.selectedStatus === "rejected"
                      }
                      onChange={() =>
                        handleStatusChange(user.userId, "rejected")
                      }
                    />
                    Reject
                  </label>
                  {userStates[user.userId]?.selectedStatus === "rejected" && (
                    <textarea
                      placeholder="Additional notes (required for rejection)"
                      value={userStates[user.userId]?.notes || ""}
                      onChange={(e) =>
                        handleNotesChange(user.userId, e.target.value)
                      }
                    />
                  )}
                  <button
                    onClick={() =>
                      updateVerificationStatus(
                        user.userId,
                        userStates[user.userId]?.selectedStatus,
                        userStates[user.userId]?.notes
                      )
                    }
                    disabled={
                      !reviewerName ||
                      (userStates[user.userId]?.selectedStatus === "rejected" &&
                        !userStates[user.userId]?.notes)
                    }
                  >
                    Submit
                  </button>
                </>
              ) : (
                <p style={{ fontStyle: "italic" }}>
                  This request is already {user.verificationStatus}. No further
                  action allowed.
                </p>
              )}
            </div>
          </div>
        );
      })}

      {nextKey && (
        <button onClick={() => loadUsersForReview(nextKey)}>Load More</button>
      )}
    </div>
  );
};

export default ReviewPortal;
