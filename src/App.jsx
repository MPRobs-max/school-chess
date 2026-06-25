
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { io } from "socket.io-client";
import { useState, useEffect, useRef } from "react";

// =====================
// SERVER CONNECTION
// This connects the website to your Node.js server.
// Your server must be running on port 5000.
// =====================
const socket = io(
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://school-chess-6maj.onrender.com"
);

function App() {
  // =====================
  // WEBSITE MEMORY / STATE
  // These remember information while the site is being used.
  // =====================

  // Stores the current chess game and board position.
  const [game, setGame] = useState(new Chess());

  // Stores the game code created by the server.
  const [gameCode, setGameCode] = useState("");

  // Stores the code typed into the "Enter game code" box.
  const [joinCode, setJoinCode] = useState("");

  // Stores messages shown on the page, such as "Check!" or "Game created."
  const [message, setMessage] = useState("");

  // Stores whether this player is white or black.
  const [playerColor, setPlayerColor] = useState("");

  // Controls which page is showing: "home" or "parents".
  const [page, setPage] = useState("home");
  const [showLearnMenu, setShowLearnMenu] =useState(false);

  //Stores moves to show in move panel
  const [moveHistory, setMoveHistory] = useState([]);


  //This is to make circles appear on squares that pieces can move to
  const [moveSquares, setMoveSquares] = useState({});

  //This will allow players to right click on pieces to have a ring appear around them
  const [markedSquares, setMarkedSquares] = useState({});
// This will allow players to click and click to move pieces
  const [selectedSquare, setSelectedSquare] = useState(null);

  //This adds the clock
  const [timeChoice, setTimeChoice] = useState(10);
  const [whiteTime, setWhiteTime] = useState(10 * 60);
  const [blackTime, setBlackTime] = useState(10 * 60);

  //This variable will track whether both players have joined
  const [gameStarted, setGameStarted] = useState(false);

  //This will bring back buttons for create game
  const [gameOver, setGameOver] = useState(false);

//This will allow click and click to promote pieces and give options
  const [pendingMove, setPendingMove]= useState(null);
  const [showPromotionChoice, setShowPromotionChoice] = useState(false);

 

  //This will scroll the moves panel down
  const movesRef = useRef(null);
  useEffect(() => {
  if (movesRef.current) {
    if (window.innerWidth <= 600) {
      movesRef.current.scrollLeft = movesRef.current.scrollWidth;
    } else {
      movesRef.current.scrollTop = movesRef.current.scrollHeight;
    }
  }
}, [moveHistory]);

  // =====================
  // SERVER MESSAGES
  // These listen for messages sent from the server.
  // =====================

  socket.off("gameCreated").on("gameCreated", (data) => {
      const chosenTime = data.timeChoice || timeChoice || 10;
    setGameCode(data.gameCode);
    setPlayerColor(data.color);
    setMessage("Game created.");
    setWhiteTime(data.whiteTime);
    setBlackTime(data.blackTime);
  });

  socket.off("gameJoined").on("gameJoined", (data) => {
    
     console.log("Black received timeChoice:", data.timeChoice);
    const chosenTime = data.timeChoice || timeChoice || 10;
    setGameCode(data.gameCode);
    setPlayerColor(data.color);
    setWhiteTime(data.whiteTime);
    setBlackTime(data.blackTime);
    setMessage("Joined game: You play the black pieces " + data.gameCode);
  });

socket.off("clockUpdate").on("clockUpdate",(data)=>{
  setWhiteTime(data.whiteTime);
  setBlackTime(data.blackTime);
});

  socket.off("message").on("message", (msg) => {
    setMessage(msg);

    if (msg === "Both players joined. Game started!") {
      setGameStarted(true);
    }
      if (
    msg.includes("resigned") ||
    msg.includes("Checkmate") ||
    msg.includes("Time is up")
  ) {
    setGameStarted(false);
    setGameOver(true);
    setGameCode("");
    setMoveHistory([]);
    }
  });

  // When the other player moves, the server sends the new board position here.
  socket.off("newPosition").on("newPosition", (data) => {
    
    if (typeof data === "string") {

    const newGame = new Chess(data);
    setGame(newGame);
    return;
  }

  const newGame = new Chess(data.fen);
  setGame(newGame);
  setMoveHistory(data.history ||[]);
});

  // =====================
  // CREATE GAME BUTTON
  // This runs when someone clicks "Create Game".
  // =====================
  function createGame() {
    setGame (new Chess());
    setMoveHistory([]);
    setWhiteTime(timeChoice * 60);
    setBlackTime(timeChoice * 60);
    socket.emit("createGame", timeChoice);
  }

  // =====================
  // JOIN GAME BUTTON
  // This runs when someone enters a code and clicks "Join Game".
  // =====================
  function joinGame() {
    setGame(new Chess());
    setMoveHistory([]);
    setMessage("");
    setGameStarted(false);
    socket.emit("joinGame", joinCode.toUpperCase());
  }

  //This will make circles appear on the squares that pieces can move to
function showLegalMoves(square) {
  const piece = game.get(square);

  if (
    piece &&
    ((playerColor === "white" && piece.color === "w") ||
      (playerColor === "black" && piece.color === "b"))
  ) {
    setSelectedSquare(square);

    const moves = game.moves({
      square: square,
      verbose: true,
    });

    const newSquares = {};

    moves.forEach((move) => {
      const isCapture = game.get(move.to);

      newSquares[move.to] = {
        background: isCapture
          ? "radial-gradient(circle, transparent 55%, rgba(80,80,80,0.5) 56%, rgba(80,80,80,0.5) 70%, transparent 71%)"
          : "radial-gradient(circle, rgba(80,80,80,0.35) 25%, transparent 26%)",
      };
    });

    setMoveSquares(newSquares);
    return;
  }

  if (selectedSquare) {
    const success = movePiece(selectedSquare, square);

    if (success) {
      setSelectedSquare(null);
      setMoveSquares({});
      return;
    }
  }

  setSelectedSquare(null);
  setMoveSquares({});
}

//allows right click
function handleSquareRightClick(square) {
  setMarkedSquares((current) => {
    const updated = { ...current };

    if (updated[square]) {
      delete updated[square];
    } else {
      updated[square] = {
        boxShadow: "inset 0 0 0 4px #50c878",
        borderRadius: "50%",
      };
    }

    return updated;
  });
}

//This is to allow promotion to optional pieces after click and click with pawn
function isPromotionMove(sourceSquare, targetSquare) {
  const piece = game.get(sourceSquare);

  if (!piece || piece.type !== "p") {
    return false;
  }

  return (
    (piece.color === "w" && targetSquare[1] === "8") ||
    (piece.color === "b" && targetSquare[1] === "1")
  );
}

  // =====================
  // MOVING PIECES
  // This runs every time a player tries to move a piece.
  // =====================
  function movePiece(sourceSquare, targetSquare, isDragMove = false) {
    if (!isDragMove && isPromotionMove(sourceSquare, targetSquare)) {
    setPendingMove({
      from: sourceSquare,
      to: targetSquare,
    });

    setShowPromotionChoice(true);
    return false;
  }
  if (!gameStarted) {
    return false;
  }

  if (whiteTime === 0 || blackTime === 0) {
    return false;
  }

  const piece = game.get(sourceSquare);

  if (!piece) {
    return false;
  }

  if (playerColor === "white" && piece.color !== "w") {
    return false;
  }

  if (playerColor === "black" && piece.color !== "b") {
    return false;
  }

  const gameCopy = new Chess(game.fen());

  const move = gameCopy.move({
    from: sourceSquare,
    to: targetSquare,
    promotion: "q",
  });

  if (move === null) {
    return false;
  }

  if (!move) {
    setPendingMove(null);
    setShowPromotionChoice(false);
    return;
  }

  setGame(gameCopy);
  setMoveHistory(gameCopy.history());
  setMoveSquares({});
  setSelectedSquare(null);
  setPendingMove(null);
  setShowPromotionChoice(false);

  socket.emit("move", {
    gameCode,
    move,
  });

  return true;
}

function promotePawn(piece) {
  if (!pendingMove) return;

  const gameCopy = new Chess(game.fen());

  const move = gameCopy.move({
    from: pendingMove.from,
    to: pendingMove.to,
    promotion: piece,
  });

  if (!move) {
  setPendingMove(null);
  setShowPromotionChoice(false);
  return false;
}

  setGame(gameCopy);
  setMoveHistory(gameCopy.history());
  setMoveSquares({});
  setSelectedSquare(null);
  setPendingMove(null);
  setShowPromotionChoice(false);

  if (gameCopy.isCheckmate()) {
    setMessage(
      gameCopy.turn() === "w"
        ? "Checkmate! White has lost."
        : "Checkmate! Black has lost."
    );
  } else if (gameCopy.inCheck()) {
    setMessage(
      gameCopy.turn() === "w"
        ? "White is in check!"
        : "Black is in check!"
    );
  } else {
    setMessage("");
  }

  socket.emit("move", {
    gameCode,
    move,
  });

  return true;
}
    function formatTime (seconds){
      const minutes = Math.floor(seconds /60);
      const secs = seconds % 60;

      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }

    const boardStyles = {
  ...moveSquares,
  ...markedSquares,
};

const promotionButtonStyle = {
  fontSize: "48px",
  width: "80px",
  height: "80px",
  border: "none",
  backgroundColor: "white",
  cursor: "pointer",
};

  return (
    <>
      {/* =====================
          TOP GREEN MENU BAR
          This is the bar at the very top of the website.
          It contains the Home and For Parents buttons.
      ===================== */}
      <div
        style={{
          padding: "20px",
          width: "100%",
          boxSizing: "border-box",
          backgroundColor: "#50c878",
          display: "flex",
          gap: "30px",
          justifyContent: "flex-end",
          fontFamily: "Arial, sans-serif",
          alignItems: "center",
        }}
      >
        <div
  onClick={() => setPage("home")}
  style={{
    color: "white",
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "normal",
  }}
>
  Home
</div>

{/* LEARN MENU */}
<div
  style={{ position: "relative", 
  
  }}
  onMouseEnter={() => setShowLearnMenu(true)}
  onMouseLeave={() => setShowLearnMenu(false)}
>
  <div
    style={{
      color: "white",
      cursor: "pointer",
      fontSize: "22px",
      fontWeight: "normal",
    }}
  >
    Learn
  </div>

  {showLearnMenu && (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: "0",
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "6px",
        minWidth: "180px",
        zIndex: 1000,
      }}
    >
      <div
        onClick={() => setPage("whiteOpening")}
        style={{
          padding: "10px",
          cursor: "pointer",
        }}
      >
        White Opening
      </div>

      <div
        onClick={() => setPage("blackOpening")}
        style={{
          padding: "10px",
          cursor: "pointer",
        }}
      >
        Black Opening
      </div>
    </div>
  )}
</div>

<div
  onClick={() => setPage("parents")}
  style={{
    color: "white",
    cursor: "pointer",
    fontSize: "22px",
    fontWeight: "normal",
  }}

  
>
  For Parents
</div>
      </div>

      {/* =====================
          HOME PAGE
          This page contains the chessboard and game controls.
      ===================== */}
      {page === "home" && (
        <div
        className="home-layout"
          style={{
            padding: "20px",
            display: "flex",
            gap: "50px",
            alignItems: "flex-start",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {/* =====================
              LEFT SIDE PANEL
              This is the left side of the page.
              It contains:
              - site title
              - move list
              - create/join game section
              - messages
              - player colour
              - game code
          ===================== */}
          <div
          className="left-panel"
            style={{
              
              width: "420px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              height: "85vh",
            }}
          >
            {/* SITE TITLE */}
            <h1
  className={gameStarted ? "game-title-playing" : ""}
  style={{
    fontSize: "48px",
    marginTop: "0",
    whiteSpace: "nowrap",
    marginBottom: "20px",
  }}
            >
              Mr Roberts' Chess site
            </h1>

            {/* =====================
                MOVE NOTATION PANEL
                This shows the moves as the game is played.
                Example:
                1. e4 e5
                2. Nf3 Nc6
            ===================== */}
            <div
            className="moves-panel"
            ref={movesRef}
              style={{
                marginTop: "20px",
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "18px",
              }}
            >
              <h3 style={{ marginTop: "0" }}>Moves</h3>

              {moveHistory.length === 0 && <p>No moves yet.</p>}

             <div className="moves-list" >
  {moveHistory.map((move, index) =>
    index % 2 === 0 ? (
      <div className="move-pair" key={index}>
        {Math.floor(index / 2) + 1}. {move}{" "}
        {moveHistory[index + 1] || ""}
      </div>
    ) : null
  )}
</div>
            </div>

            {/* =====================
                BOTTOM LEFT GAME CONTROLS
                This section is pushed to the bottom of the left panel.
                It contains:
                - Create Game button
                - Join Game input
                - messages
                - player colour
                - game code
            ===================== */}
            <div style={{ marginTop: "auto" }}>
              {/* =====================
    GAME RESULT MESSAGE
===================== */}
{message && (
  <div
    style={{
      fontSize: "28px",
      color: "#cc4444",
      marginTop: "30px",    
      marginBottom: "15px",
    }}
  >
    {message}
  </div>
)}
              {!gameCode && (
                <>
                
            <label>
              Game time:
            <select
              value={timeChoice}
              onChange={(e) => setTimeChoice(Number(e.target.value))}
              style={{
              fontSize: "20px",
              padding: "10px",
              marginLeft: "10px",
          }}
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
            </label>

              <br />
              <br />

                  <button
                    style={{
                      fontSize: "20px",
                      padding: "12px 24px",
                    }}
                    onClick={createGame}
                  >
                    Create Game
                  </button>

                  <br />
                  <br />

                  <input
                    style={{
                      fontSize: "20px",
                      padding: "12px",
                      width: "220px",
                    }}
                    placeholder="Enter game code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />

                  <button
                    style={{
                      fontSize: "20px",
                      padding: "12px 24px",
                    }}
                    onClick={joinGame}
                  >
                    Join Game
                  </button>
                </>
              )}

              

              {/* PLAYER COLOUR MESSAGE */}
              {playerColor && (
  <h3 className={gameStarted ? "player-colour-playing" : ""}>
    You play the {playerColor} pieces
  </h3>
)}

              {/* GAME CODE DISPLAY */}
              {gameCode && !gameStarted && 
                <h2 className="game-code-display">Game Code: {gameCode}</h2>
                }

                

              {/*TURN INDICATOR*/}
              {gameCode && (
                <div
                style={{
                  fontSize: "24px",
                  marginTop: "15px",
                  padding: "10px",
                  border :"1px solid #ccc",
                  borderRadius: "8px",
                }}
                >
                  <div>White: {formatTime(whiteTime)}</div>
                  <div>Black: {formatTime(blackTime)}</div>
                <h3 className="turn-indicator">
                  {game.turn() === "w" ? "White to move" : "Black to move"}
                </h3>
                <button
  onClick={() => {
  socket.emit("resign", {
    gameCode,
    playerColor,
  });
}}
  style={{
    fontSize: "18px",
    padding: "8px 16px",
    marginTop: "10px",
    backgroundColor: "#cc4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  }}
>
  Resign
</button>
                </div>
              )}
            </div>
          </div>



          {/* =====================
              CHESS BOARD SECTION
              This is the actual chessboard.
              The board flips if the player is black.
          ===================== */}
          <div
          className="board-area"
            style={{
              width: "85vh",
              maxWidth: "calc(100vw - 520px)",
              position:"relative",
            }}
          >

            {showPromotionChoice && (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.25)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 20,
      borderRadius: "8px",
    }}
  >
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 8px 25px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button onClick={() => promotePawn("q")} style={promotionButtonStyle}>♕</button>
      <button onClick={() => promotePawn("r")} style={promotionButtonStyle}>♖</button>
      <button onClick={() => promotePawn("b")} style={promotionButtonStyle}>♗</button>
      <button onClick={() => promotePawn("n")} style={promotionButtonStyle}>♘</button>
    </div>
  </div>
)}
            <Chessboard
              position={game.fen()}
              boardOrientation={playerColor === "black" ? "black" : "white"}
              onPieceDrop={(sourceSquare, targetSquare) => {
                return movePiece(sourceSquare, targetSquare, true);
}}
              onSquareClick={showLegalMoves}
              customSquareStyles={boardStyles}
              onSquareRightClick={handleSquareRightClick}
            />
          </div>
        </div>
      )}

      {/* =====================
          FOR PARENTS PAGE
          This appears when the user clicks "For Parents".
          You can edit the text in this section.
      ===================== */}
      {page === "parents" && (
        <div
          style={{
            padding: "30px",
            maxWidth: "800px",
            margin: "0 auto",
            textAlign: "center",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <h1>For Parents</h1>

          <p>
            I created this website for my chess club pupils at Great Waltham
            Junior School. We have been using lichess but anybody in the world
            can use that website. <br /></p>
            <hr/>
           <p> I made this website so the children can play each other in a safe environment.
          </p>

          <hr />

          <p>Some things to consider.</p>

          <hr/>

          <p>1. There will never be a chat function.</p>
          <p>2. No games will be saved.</p>
          <p>3. There are no profiles to be created.</p>
          <p>4. Your children will never be asked for information.</p>
          <p>5. This website will always be free.</p>
         
        </div>

      )}

      {page === "whiteOpening" && (
  <div
    style={{
      padding: "30px",
      maxWidth: "800px",
      margin: "0 auto",
      textAlign: "center",
      fontFamily: "Arial, sans-serif",
    }}
  >
    <h1>White Opening</h1>
    <h2>Coming Soon</h2>
  </div>
)}

{page === "blackOpening" && (
  <div
    style={{
      padding: "30px",
      maxWidth: "800px",
      margin: "0 auto",
      textAlign: "center",
      fontFamily: "Arial, sans-serif",
    }}
  >
    <h1>Black Opening</h1>
    <h2>Coming Soon</h2>
  </div>
)}
    </>
  );
}

export default App;
