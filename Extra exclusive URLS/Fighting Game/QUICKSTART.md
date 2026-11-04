# Quick Start Guide

## Getting Started

The server is already running! Open your browser and navigate to:

```
http://localhost:3000
```

## Test the Game

### Test Local 2-Player Mode (Immediately)

1. Open http://localhost:3000 in your browser
2. Press **ESC** key
3. Click **LOCAL PLAY**
4. Play with two players on the same keyboard:
   - **Red**: A/D = Move, W = Jump, S = Punch, Left Shift = Kick
   - **Blue**: Arrows = Move, Up = Jump, Down = Punch, Right Shift = Kick

### Test Multiplayer Mode

You'll need **two browser windows** (or two different computers):

**Window 1:**
1. Open http://localhost:3000
2. Press **ESC**
3. Click **MULTIPLAYER**
4. Click **REGISTER**
5. Enter username: `player1`, password: `test123`
6. Click **REGISTER** button
7. Wait in the lobby

**Window 2:**
1. Open http://localhost:3000 in a new window (or incognito mode)
2. Press **ESC**
3. Click **MULTIPLAYER**
4. Click **REGISTER**
5. Enter username: `player2`, password: `test123`
6. Click **REGISTER** button
7. You should see `player1` in the user list
8. Click **Challenge** next to `player1`

**Back to Window 1:**
1. You'll see a duel notification from `player2`
2. Click **Accept**

**Both Players:**
- Game starts automatically
- Use the same controls: Arrows, Space (punch), Shift (kick)
- Health bars show your usernames
- Fight until someone's health reaches 0!

## Controls Reference

### ESC Menu
- Press **ESC** at any time to open the menu
- **LOCAL PLAY**: Start a local 2-player game
- **MULTIPLAYER**: Access online multiplayer
- **RESUME**: Return to current game

### Local Mode Controls
- **Red Fighter**: WASD + S (punch) + Left Shift (kick)
- **Blue Fighter**: Arrow Keys + Down (punch) + Right Shift (kick)

### Multiplayer Controls (Both Players)
- **Arrow Left/Right**: Move
- **Arrow Up**: Jump
- **Space**: Punch
- **Shift**: Kick

## Server Management

### Check Server Status
```bash
ps aux | grep "node server/server.js"
```

### View Server Logs
```bash
cat /tmp/claude-1000/-home-zach-Coding-Projects-Fighting-Game/tasks/bd9b1c9.output
```

### Stop the Server
```bash
pkill -f "node server/server.js"
```

### Restart the Server
```bash
npm start
```

## Troubleshooting

### Can't Connect to Server
- Make sure the server is running: `npm start`
- Check http://localhost:3000 is accessible
- Look for errors in browser console (F12)

### Registration Fails
- Username must be 3-20 alphanumeric characters
- Password must be at least 6 characters
- Username must be unique

### Players Can't See Each Other
- Both players must be logged in
- Refresh the lobby (type something in search box then clear it)
- Check both players are in the lobby modal

### Game Desyncs
- This shouldn't happen as the server is authoritative
- If it does, refresh both browsers and try again

## What's Next?

- Play multiple rounds and watch your wins/losses track
- Test disconnect handling (close one player's browser mid-game)
- Try with friends on different computers (use your IP address instead of localhost)
- Customize the game constants in `shared/constants.js`

## Architecture Highlights

- **Client-Side Prediction**: Your inputs are applied immediately for smooth gameplay
- **Server Authority**: Server validates all actions and is the source of truth
- **60 FPS Server**: Game state updates 60 times per second
- **Real-Time Sync**: Socket.io keeps both players in sync

Have fun! 🥊
