const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const cors = require("cors");

// =====================
// BASIC SERVER SETUP
// =====================
const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// =====================
// STORES ALL ACTIVE GAMES
// Each game code points to one chess game.
// =====================
const games = {};

// =====================
// CREATE A RANDOM GAME CODE
// Example: ABC12
// =====================
function makeGameCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// =====================
// SEND CLOCK TIMES TO BOTH PLAYERS
// =====================
function sendClockUpdate(gameCode) {
  const game = games[gameCode];

  if (!game) return;

  io.to(gameCode).emit("clockUpdate", {
    whiteTime: game.whiteTime,
    blackTime: game.blackTime,
  });
}

// =====================
// START THE SERVER CLOCK
// The server controls the timer for both players.
// =====================
function startClock(gameCode) {
  const game = games[gameCode];

  if (!game) return;

  if (game.clockInterval) {
    clearInterval(game.clockInterval);
  }

  game.clockInterval = setInterval(() => {
    if (game.gameOver) {
      clearInterval(game.clockInterval);
      return;
    }

    if (game.chess.turn() === "w") {
      game.whiteTime = Math.max(game.whiteTime - 1, 0);
    } else {
      game.blackTime = Math.max(game.blackTime - 1, 0);
    }

    sendClockUpdate(gameCode);

    if (game.whiteTime === 0) {
      game.gameOver = true;
      clearInterval(game.clockInterval);
      io.to(gameCode).emit("message", "Time is up! White has lost. Black wins!");
    }

    if (game.blackTime === 0) {
      game.gameOver = true;
      clearInterval(game.clockInterval);
      io.to(gameCode).emit("message", "Time is up! Black has lost. White wins!");
    }
  }, 1000);
}

// =====================
// WHEN A PLAYER CONNECTS
// =====================

io.on("connection", (socket) => {
  console.log("A player connected");

  // =====================
  // CREATE GAME
  // White creates the game and chooses the time.
  // =====================
  socket.on("createGame", (timeChoice) => {
    const gameCode = makeGameCode();
    const startingTime = timeChoice * 60;

    games[gameCode] = {
      chess: new Chess(),
      white: socket.id,
      black: null,
      timeChoice: timeChoice,
      whiteTime: startingTime,
      blackTime: startingTime,
      gameOver: false,
      clockInterval: null,
    };

    socket.join(gameCode);

    socket.emit("gameCreated", {
      gameCode: gameCode,
      color: "white",
      timeChoice: timeChoice,
      whiteTime: startingTime,
      blackTime: startingTime,
    });
  });

  // =====================
  // JOIN GAME
  // Black joins using the game code.
  // =====================
  socket.on("joinGame", (gameCode) => {
    const game = games[gameCode];

    if (!game) {
      socket.emit("message", "Game not found");
      return;
    }

    if (game.black) {
      socket.emit("message", "Game is already full");
      return;
    }

    game.black = socket.id;
    socket.join(gameCode);

    socket.emit("gameJoined", {
      gameCode: gameCode,
      color: "black",
      timeChoice: game.timeChoice,
      whiteTime: game.whiteTime,
      blackTime: game.blackTime,
    });

    io.to(gameCode).emit("message", "Both players joined. Game started!");

    sendClockUpdate(gameCode);
    startClock(gameCode);
  });

  // =====================
  // RESIGN
  // Sends the resignation message to both players.
  // =====================
  socket.on("resign", ({ gameCode, playerColor }) => {
    const game = games[gameCode];

    if (!game) return;

    game.gameOver = true;

    if (game.clockInterval) {
      clearInterval(game.clockInterval);
    }

    io.to(gameCode).emit(
      "message",
      playerColor === "white"
        ? "White resigned. Black wins!"
        : "Black resigned. White wins!"
    );
  });

  // =====================
  // MOVE PIECE
  // Checks the move, updates the board, and sends it to both players.
  // =====================
  socket.on("move", ({ gameCode, move }) => {
    const game = games[gameCode];

    if (!game || game.gameOver) return;

    try {
      const result = game.chess.move(move);

      if (result) {
        io.to(gameCode).emit("newPosition", {
          fen: game.chess.fen(),
          history: game.chess.history(),
        });

        if (game.chess.isCheckmate()) {
          game.gameOver = true;

          if (game.clockInterval) {
            clearInterval(game.clockInterval);
          }

          io.to(gameCode).emit(
            "message",
            game.chess.turn() === "w"
              ? "Checkmate! White has lost."
              : "Checkmate! Black has lost."
          );
        } else if (game.chess.inCheck()) {
          io.to(gameCode).emit(
            "message",
            game.chess.turn() === "w"
              ? "White is in check!"
              : "Black is in check!"
          );
        } else {
          io.to(gameCode).emit("message", "");
        }
      }
    } catch {
      socket.emit("message", "That move is not allowed");
    }
  });

  socket.on("disconnect", () => {
    for (const gameCode in games) {
      const game = games[gameCode];

      if (!game || game.gameOver) continue;

      if (game.white === socket.id || game.black === socket.id) {
        game.gameOver = true;

        if (game.clockInterval) {
          clearInterval(game.clockInterval);
        }

        const winner = game.white === socket.id ? "Black" : "White";

        io.to(gameCode).emit(
          "message",
          `${winner} wins! The other player left the game.`
        );

        break;
      }
    }
  });
});

// =====================
// START SERVER
// =====================
server.listen(5000, () => {
  console.log("Chess server running on port 5000");
});
