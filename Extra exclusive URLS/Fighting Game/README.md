# Multiplayer Fighting Game

A 2D stick figure fighting game with both local 2-player and online multiplayer modes.

## Features

- **Local 2-Player Mode**: Play with a friend on the same keyboard
- **Online Multiplayer**: Challenge players online with real-time gameplay
- **User Authentication**: Register and login to track your wins/losses
- **Matchmaking Lobby**: Search for players and send duel requests
- **Authoritative Server**: Server-side physics and collision detection

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## How to Play

### Local Mode

1. Press **ESC** to open the menu
2. Click **LOCAL PLAY**
3. Two players share the keyboard:
   - **Red Player**: A/D = Move, W = Jump, S = Punch, Left Shift = Kick
   - **Blue Player**: Arrow Keys = Move, Up Arrow = Jump, Down Arrow = Punch, Right Shift = Kick

### Multiplayer Mode

1. Press **ESC** to open the menu
2. Click **MULTIPLAYER**
3. Register a new account or login with existing credentials
4. In the lobby:
   - View online players
   - Search for specific users
   - Click **Challenge** to send a duel request
5. Accept incoming duel requests
6. Play the game:
   - **Arrow Keys**: Move left/right
   - **Up Arrow**: Jump
   - **Space**: Punch
   - **Shift**: Kick

## Game Controls

### Local Mode
- **Red Fighter**:
  - Move: A (left), D (right)
  - Jump: W
  - Punch: S
  - Kick: Left Shift

- **Blue Fighter**:
  - Move: Arrow Left/Right
  - Jump: Arrow Up
  - Punch: Arrow Down
  - Kick: Right Shift

### Multiplayer Mode (Both Players)
- Move: Arrow Left/Right
- Jump: Arrow Up
- Punch: Space
- Kick: Shift

## Architecture

### Client (`/client`)
- `game.js` - Core game logic, rendering, and physics (client-side prediction)
- `multiplayer.js` - Socket.io client, authentication, and lobby management
- `styles.css` - All CSS styling

### Server (`/server`)
- `server.js` - Express + Socket.io server
- `auth.js` - User authentication with bcrypt
- `database.js` - SQLite database operations
- `matchmaking.js` - Lobby and duel request management
- `gameRoom.js` - Authoritative game state with 60 FPS game loop

### Shared (`/shared`)
- `constants.js` - Game constants used by both client and server

## Technology Stack

- **Frontend**: Vanilla JavaScript, Canvas API, Socket.io Client
- **Backend**: Node.js, Express, Socket.io
- **Database**: SQLite with better-sqlite3
- **Authentication**: bcrypt for password hashing

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password_hash` - Bcrypt hashed password
- `wins` - Total wins
- `losses` - Total losses
- `created_at` - Registration timestamp

### Active Sessions Table
- `session_id` - Session token
- `user_id` - Foreign key to users
- `socket_id` - Current socket connection
- `last_active` - Last activity timestamp

## Testing

### Test Local Mode
1. Open the game
2. Press ESC
3. Click LOCAL PLAY
4. Verify both players can move and fight

### Test Multiplayer
1. Start the server: `npm start`
2. Open two browser windows (or two different browsers)
3. In each window, register different users
4. In one window, challenge the other user
5. Accept the duel in the second window
6. Play the game and verify synchronization

### Test Scenarios
- ✅ User registration with unique usernames
- ✅ User login with valid credentials
- ✅ Lobby displays online users
- ✅ Duel requests sent and received
- ✅ Game synchronization (both players see same state)
- ✅ Health reduction on successful attacks
- ✅ Game ends when health reaches 0
- ✅ Disconnect handling (opponent leaves mid-game)

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, set a different port:
```bash
PORT=3001 npm start
```

### Database Issues
Delete the database file to reset:
```bash
rm users.db users.db-shm users.db-wal
```

### Socket.io Connection Issues
- Ensure the server is running
- Check browser console for errors
- Verify no firewall blocking WebSocket connections

## Development

The game uses client-side prediction for smooth gameplay:
- Client immediately applies player inputs locally
- Server validates and broadcasts authoritative state
- Client reconciles differences from server state

The server runs at 60 FPS and is the source of truth for:
- Player positions
- Health values
- Collision detection
- Game outcomes

## License

ISC
