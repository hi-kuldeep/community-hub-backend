# 🌐 Community Hub Backend

[![Node.js](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19.2-blue.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![REST API](https://img.shields.io/badge/API-REST-orange.svg?style=flat-square)](#)

This is the multi-user, relational mock backend for the **Community Hub** mobile application. Built using Node.js and Express, it provides stateful mock API endpoints, dynamically calculates relational statistics, and persists data locally using a lightweight JSON-based file database (`db.json`).

The live version of this backend is deployed at:  
👉 **[Deployed URL](https://community-hub-backend-hgxl.onrender.com/)**

---

## 🚀 Key Features

- **📂 Stateful Database**: Uses `db.json` to persist and manage users, communities, memberships, and posts.
- **🔗 Relational Statistics**:
  - Dynamically calculates whether a community has been `joined` by the requesting user.
  - Dynamically computes the `memberCount` for each community based on records in the memberships intermediate table.
  - Dynamically calculates the `postCount` for each community.
- **👤 Dynamic Registration**: Intercepts requests and registers new active users on the fly if the `x-user-id` header is unknown.
- **✍️ Populated Post Feeds**: Returns posts joined with their respective author details from the users table.
- **🔑 Mock Authentication**: Simulates a JWT token auth flow (expires in 1 hour) with password validation for registered users.

---

## 🛠️ Setup & Running Instructions

### Prerequisites
Make sure you have Node.js installed:
- **Node.js**: `v18.x` or `v20.x`
- **Yarn** or **npm**

### 1. Installation
Clone the repository, navigate into the directory, and install dependencies:

```bash
yarn install
# or
npm install
```

### 2. Run the Server
Launch the server in development mode:

```bash
yarn start
# or
npm start
```
By default, the server will run on: `http://localhost:3000`

---

## 🔑 Demo Credentials

To login and test the application, use one of the following mock accounts:

| User Type | Email | Password | Location |
| :--- | :--- | :--- | :--- |
| **Standard User 1** | `test@gmail.com` | `123456` | Dubai |
| **Standard User 2** | `sarah@example.com` | `555444333` | London |

---

## 📡 API Reference & Endpoints

All endpoints accept and return JSON. The authenticated user context is determined dynamically via the `x-user-id` request header.

### 1. Authentication & Profile

#### 🔓 User Login
Validate credentials and retrieve an authorization token.
* **Route**: `POST /users/login`
* **Body**:
  ```json
  {
    "email": "test@gmail.com",
    "password": "123456"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "token": "fake_jwt_token_1782273515751",
    "user": {
      "id": "usr_test",
      "name": "Test User",
      "email": "test@gmail.com",
      "avatar": "https://randomuser.me/api/portraits/men/1.jpg",
      "location": "Dubai"
    },
    "expiresAt": 1782277115751
  }
  ```

#### 👤 Update Profile
Updates the profile details of the active user.
* **Route**: `PATCH /users/profile`
* **Headers**: `x-user-id: usr_test`
* **Body**:
  ```json
  {
    "name": "Updated Name",
    "location": "Abu Dhabi"
  }
  ```
* **Response (200 OK)**: Returns the updated user object.

---

### 2. Communities

#### 📋 List Communities
Retrieve all communities with search, sorting, and pagination.
* **Route**: `GET /communities`
* **Headers**: `x-user-id: usr_test`
* **Query Parameters**:
  - `search`: *string* (filters by name/description, case-insensitive)
  - `sort`: *string* (`name_asc` | `name_desc` | `members_desc`)
  - `page`: *number* (default: `1`)
  - `limit`: *number* (default: `10`)
* **Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "1",
        "name": "React Native Core",
        "description": "Discuss architecture, performance, and best practices...",
        "joined": true,
        "memberCount": 5,
        "postCount": 12
      }
    ],
    "nextPage": 2,
    "totalCount": 24
  }
  ```

#### 🔍 Get Community Details
Retrieve detailed information for a single community.
* **Route**: `GET /communities/:id`
* **Headers**: `x-user-id: usr_test`
* **Response (200 OK)**:
  ```json
  {
    "id": "1",
    "name": "React Native Core",
    "description": "Discuss architecture, performance, and best practices...",
    "joined": true,
    "memberCount": 5,
    "postCount": 12
  }
  ```

#### ➕ Toggle Joined Status / Edit Community
Join or leave a community by toggling the `joined` state. Updates the memberships intermediate table statefully.
* **Route**: `PATCH /communities/:id`
* **Headers**: `x-user-id: usr_test`
* **Body**:
  ```json
  {
    "joined": true
  }
  ```
* **Response (200 OK)**: Returns the updated community object with recalculated dynamic attributes.

---

### 3. Posts

#### 💬 List Posts in a Community
Retrieve all posts published inside a specific community, with populated author objects.
* **Route**: `GET /posts`
* **Query Parameters**:
  - `communityId`: *string* (Required)
* **Response (200 OK)**:
  ```json
  [
    {
      "id": "post-1782273515751",
      "communityId": "1",
      "authorId": "usr_test",
      "title": "Optimistic Updates in React Query",
      "body": "Let's discuss how to configure mutational rollbacks...",
      "createdAt": "2026-06-24T12:00:00.000Z",
      "author": {
        "id": "usr_test",
        "name": "Test User",
        "email": "test@gmail.com",
        "avatar": "https://randomuser.me/api/portraits/men/1.jpg"
      }
    }
  ]
  ```

#### ✍️ Create a Post
Publishes a new post to a community under the authenticated user context.
* **Route**: `POST /posts`
* **Headers**: `x-user-id: usr_test`
* **Body**:
  ```json
  {
    "communityId": "1",
    "title": "New Post Title",
    "body": "This is the content of my post."
  }
  ```
* **Response (201 Created)**: Returns the newly created post populated with its author object.

---

## 🗄️ Database Architecture (`db.json`)

The server simulates a relational schema inside a single JSON database:

- `users`: Tracks registered users, credentials, locations, and avatars.
- `communities`: Tracks metadata (name, description) for communities.
- `memberships`: An intermediate junction array containing `{ userId, communityId }` records mapping user subscriptions statefully.
- `posts`: Tracks messages containing community and author relations.
