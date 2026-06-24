const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "./db.json");

app.use(cors());
app.use(express.json());

// Helper to read database content
const readDatabase = () => {
  try {
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading db.json:", error);
    return { users: [], communities: [], memberships: [], posts: [] };
  }
};

// Helper to write database content
const writeDatabase = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to db.json:", error);
  }
};

/**
 * Helper to resolve the authenticated userId from request headers
 * and dynamically register them in db.json if they don't exist yet.
 */
const getUserIdAndUpsert = (req, db) => {
  const userId = req.headers["x-user-id"] || "usr_test";

  db.users = db.users || [];
  let user = db.users.find((u) => u.id === userId);

  if (!user) {
    const cleanName = userId.includes("@")
      ? userId.split("@")[0]
      : userId.startsWith("usr_")
        ? `User_${userId.slice(4, 8)}`
        : userId;

    user = {
      id: userId,
      name: cleanName,
      email: userId.includes("@") ? userId : `${userId}@example.com`,
      avatar: `https://randomuser.me/api/portraits/lego/${Math.floor(
        Math.random() * 9,
      )}.jpg`,
      location: "Dubai",
    };

    db.users.push(user);
    writeDatabase(db);
    console.log(`[Mock Server] Dynamic registration of active user: ${userId}`);
  }

  return userId;
};

/**
 * GET /communities
 * Query Parameters:
 *  - search: string (matches name or description case-insensitively)
 *  - sort: string ('name_asc' | 'name_desc' | 'members_desc')
 *  - page: number (default 1)
 *  - limit: number (default 10)
 */
app.get("/communities", (req, res) => {
  const db = readDatabase();
  const userId = getUserIdAndUpsert(req, db);

  let communities = (db.communities || []).map((c) => {
    // 1. Dynamically calculate joined status from memberships table for this specific user
    const isJoined = (db.memberships || []).some(
      (m) => m.userId === userId && m.communityId === c.id,
    );
    // 2. Dynamically calculate genuine memberCount (strictly count matching records in memberships table)
    const finalMemberCount = (db.memberships || []).filter(
      (m) => m.communityId === c.id,
    ).length;
    // 3. Dynamically calculate genuine postCount (posts table count matching this communityId)
    const postCount = (db.posts || []).filter(
      (p) => p.communityId === c.id,
    ).length;

    return {
      ...c,
      joined: isJoined,
      memberCount: finalMemberCount,
      postCount: postCount,
    };
  });

  // 1. Search Filter
  const search = (req.query.search || "").toString().trim().toLowerCase();
  if (search) {
    communities = communities.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(search) ||
        (c.description || "").toLowerCase().includes(search),
    );
  }

  // 2. Sorting
  const sort = req.query.sort || "name_asc";
  communities.sort((a, b) => {
    if (sort === "name_desc") {
      return (b.name || "").localeCompare(a.name || "");
    } else if (sort === "members_desc") {
      return (b.memberCount || 0) - (a.memberCount || 0);
    } else {
      // Default: name_asc
      return (a.name || "").localeCompare(b.name || "");
    }
  });

  // 3. Pagination
  const totalCount = communities.length;
  const page = parseInt(req.query.page || "1", 10);
  const limit = parseInt(req.query.limit || "10", 10);

  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const sliced = communities.slice(startIndex, endIndex);

  const hasMore = endIndex < totalCount;
  const nextPage = hasMore ? page + 1 : undefined;

  // Return the paginated response structure directly
  return res.json({
    data: sliced,
    nextPage,
    totalCount,
  });
});

/**
 * GET /communities/:id
 * Retrieves detailed info for a single community
 */
app.get("/communities/:id", (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  const userId = getUserIdAndUpsert(req, db);

  const community = (db.communities || []).find((c) => c.id === id);
  if (!community) {
    return res
      .status(404)
      .json({ message: `Community with ID ${id} not found.` });
  }

  // Calculate stats and membership status dynamically
  const isJoined = (db.memberships || []).some(
    (m) => m.userId === userId && m.communityId === id,
  );
  const finalMemberCount = (db.memberships || []).filter(
    (m) => m.communityId === id,
  ).length;
  const postCount = (db.posts || []).filter((p) => p.communityId === id).length;

  return res.json({
    ...community,
    joined: isJoined,
    memberCount: finalMemberCount,
    postCount: postCount,
  });
});

/**
 * PATCH /communities/:id
 * Toggles a community joined status statefully for this specific user by updating the memberships table
 */
app.patch("/communities/:id", (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  const userId = getUserIdAndUpsert(req, db);
  const communities = db.communities || [];
  const memberships = db.memberships || [];

  const communityIndex = communities.findIndex((c) => c.id === id);
  if (communityIndex === -1) {
    return res
      .status(404)
      .json({ message: `Community with ID ${id} not found.` });
  }

  const community = communities[communityIndex];

  // Handle joined toggle dynamically inside memberships intermediate table for the user
  if (req.body.joined !== undefined) {
    const isJoined = req.body.joined;
    const membershipIndex = memberships.findIndex(
      (m) => m.userId === userId && m.communityId === id,
    );

    if (isJoined && membershipIndex === -1) {
      // Add membership link
      memberships.push({ userId, communityId: id });
    } else if (!isJoined && membershipIndex !== -1) {
      // Remove membership link
      memberships.splice(membershipIndex, 1);
    }
  }

  // Update other community attributes if passed
  const { joined, ...otherProps } = req.body;
  const updatedCommunity = {
    ...community,
    ...otherProps,
  };

  communities[communityIndex] = updatedCommunity;
  writeDatabase({ ...db, communities, memberships });

  // Dynamically calculate values for response
  const finalMemberCount = memberships.filter(
    (m) => m.communityId === id,
  ).length;
  const postCount = (db.posts || []).filter((p) => p.communityId === id).length;

  // Calculate and return updated community object with dynamic attributes
  return res.json({
    ...updatedCommunity,
    joined: memberships.some(
      (m) => m.userId === userId && m.communityId === id,
    ),
    memberCount: finalMemberCount,
    postCount: postCount,
  });
});

/**
 * GET /posts
 * Query Parameters:
 *  - communityId: string (required)
 */
app.get("/posts", (req, res) => {
  const db = readDatabase();
  const communityId = req.query.communityId;

  if (!communityId) {
    return res
      .status(400)
      .json({ message: "Missing required query parameter: communityId" });
  }

  const posts = (db.posts || []).filter((p) => p.communityId === communityId);

  // Map each post to include corresponding author details from users table
  const populatedPosts = posts.map((post) => {
    let author = (db.users || []).find((u) => u.id === post.authorId);
    if (!author) {
      author = {
        id: post.authorId,
        name: `User_${post.authorId.slice(4, 8)}`,
        email: `${post.authorId}@example.com`,
        avatar: "https://randomuser.me/api/portraits/lego/1.jpg",
      };
    }
    return {
      ...post,
      author: {
        id: author.id,
        name: author.name,
        email: author.email,
        avatar: author.avatar,
      },
    };
  });

  return res.json(populatedPosts);
});

/**
 * POST /posts
 * Adds a new post to the community with author relation resolving to current user
 */
app.post("/posts", (req, res) => {
  const db = readDatabase();
  const userId = getUserIdAndUpsert(req, db);
  const { communityId, title, body } = req.body;

  if (!communityId || !title || !body) {
    return res.status(400).json({
      message: "Missing required fields: communityId, title, or body",
    });
  }

  const newPost = {
    id: `post-${Date.now()}`,
    communityId,
    authorId: userId,
    title,
    body,
    createdAt: new Date().toISOString(),
  };

  const posts = db.posts || [];
  posts.push(newPost);
  writeDatabase({ ...db, posts });

  const author = (db.users || []).find((u) => u.id === userId);
  const populatedPost = {
    ...newPost,
    author: author
      ? {
          id: author.id,
          name: author.name,
          email: author.email,
          avatar: author.avatar,
        }
      : null,
  };

  return res.status(201).json(populatedPost);
});

/**
 * POST /users/login
 * Validates/registers a user and returns authentication token with expiration details
 */
app.post("/users/login", (req, res) => {
  const db = readDatabase();
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  // Generate deterministic ID from email for persistent mock tracking
  const username = email.split("@")[0];
  const userId = `usr_${username}`;

  db.users = db.users || [];
  let user = db.users.find((u) => u.id === userId || u.email === email);

  if (!user) {
    console.log(`[Mock Server] Login attempt for unregistered email: ${email}`);
    return res.status(401).json({ message: "User not found." });
  } else {
    // If the user exists, validate their password only if they have a password field configured in the database
    if (user.password && password !== user.password) {
      console.log(
        `[Mock Server] Incorrect password attempt for user: ${email}`,
      );
      return res
        .status(401)
        .json({ message: "Incorrect password. Please try again." });
    }
  }

  const token = `fake_jwt_token_${Date.now()}`;
  const expiresAt = Date.now() + 3600 * 1000; // Token valid for 1 hour
  // const expiresAt = Date.now() + 30 * 1000; // Token valid for 30 seconds

  return res.json({
    token,
    user,
    expiresAt,
  });
});

/**
 * PATCH /users/profile
 * Updates the current user's profile details in the database
 */
app.patch("/users/profile", (req, res) => {
  const db = readDatabase();
  const userId = getUserIdAndUpsert(req, db);

  const userIndex = db.users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found." });
  }

  const updatedUser = {
    ...db.users[userIndex],
    ...req.body,
  };

  db.users[userIndex] = updatedUser;
  writeDatabase(db);

  console.log(`[Mock Server] Updated user profile for: ${userId}`);
  return res.json(updatedUser);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[Mock Server] Relational multi-user mock server is running on http://localhost:${PORT}`,
  );
});
