import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: ["https://neoshare.pages.dev", "http://localhost:5173/"],
        credentials: true
    }
});

const rooms = new Map();

function generateCode() {
    let code;
    let attempts = 0;
    do {
        code = Math.floor(10000000 + Math.random() * 90000000).toString();
        attempts++;
        if (attempts > 10) throw new Error("Failed to generate unique code");
    } while (rooms.has(code));
    return code;
}

function clearRoom(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const payload = {
        title: "Connection Error",
        description: "Room Destroyed"
    };
    if (room.sender && room.sender.connected) room.sender.emit("room-destroyed", payload);
    if (room.receiver && room.receiver.connected) room.receiver.emit("room-destroyed", payload);

    if (room.timeout) clearTimeout(room.timeout);
    rooms.delete(roomCode);
    console.log(`Room ${roomCode} destroyed.`);
}

io.on("connection", (socket) => {
    socket.data.role = null;
    socket.data.roomCode = null;

    socket.on("generate", () => {
        try {
            const code = generateCode();
            const timeout = setTimeout(() => {
                console.log(`Room ${code} timed out`);
                clearRoom(code);
            }, 5 * 60 * 1000); // 5 mins

            rooms.set(code, {
                sender: socket,
                receiver: null,
                pendingSignals: [],
                timeout,
                createdAt: Date.now(),
                state: "waiting"
            });

            socket.data.role = "sender";
            socket.data.roomCode = code;
            socket.emit("code", code);
            console.log(`Room created: ${code}`);
        } catch (err) {
            console.error("generate error", err);
            socket.emit("error", { title: "Server Error", description: "Could not generate code" });
        }
    });

    socket.on("join", (code) => {
        const room = rooms.get(code);
        if (!room) {
            socket.emit("error", { title: "Connection Error", description: "Invalid Code" });
            return;
        }
        if (room.receiver) {
            socket.emit("error", { title: "Connection Error", description: "Room Is Full" });
            return;
        }
        if (Date.now() - room.createdAt > 5 * 60 * 1000) {
            socket.emit("error", { title: "Connection Error", description: "Code Has Expired" });
            clearRoom(code);
            return;
        }

        if (room.timeout) {
            clearTimeout(room.timeout);
            delete room.timeout;
        }

        room.receiver = socket;
        room.state = "connected";
        socket.data.role = "receiver";
        socket.data.roomCode = code;

        if (room.pendingSignals && room.pendingSignals.length > 0) {
            for (const item of room.pendingSignals) {
                if (item.target === "sender" && room.sender && room.sender.connected) {
                    room.sender.emit("signal", item.data);
                } else if (item.target === "receiver" && room.receiver && room.receiver.connected) {
                    room.receiver.emit("signal", item.data);
                }
            }
            room.pendingSignals = [];
        }

        if (room.sender && room.sender.connected) {
            room.sender.emit("peer-joined", {
                title: "Receiver Connected",
                description: "Your peer has successfully joined."
            });
        }
        socket.emit("joined", {
            title: "Connected to sender",
            description: "Your peer has successfully joined."
        });

        console.log(`Receiver joined room ${code}`);
    });

    socket.on("leave-room", () => {
        const roomCode = socket.data.roomCode;
        if (roomCode) {
            console.log(`User leaving room ${roomCode}`);
            clearRoom(roomCode);
            socket.data.roomCode = null;
            socket.data.role = null;
        }
    });

    socket.on("disconnect", () => {
        const code = socket.data.roomCode;
        if (code) {
            console.log(`Peer disconnected from room ${code}`);
            clearRoom(code);
        }
    });

    socket.on("signal", (payload) => {
        try {
            const roomCode = socket.data.roomCode;
            if (!roomCode) return;
            const room = rooms.get(roomCode);
            if (!room) return;

            if (!payload || typeof payload !== "object" || !payload.type) return;

            const fromRole = socket.data.role;
            const targetRole = fromRole === "sender" ? "receiver" : "sender";

            if (payload.type === "offer" || payload.type === "answer") {
                if (!payload.sdp || payload.sdp.length > 200 * 1024) return; // too big
            } else if (payload.type === "ice") {
                if (!payload.candidate || payload.candidate.candidate.length > 4 * 1024) return;
            }

            const targetSocket = targetRole === "sender" ? room.sender : room.receiver;

            if (targetSocket && targetSocket.connected) {
                targetSocket.emit("signal", payload);
            } else {
                room.pendingSignals = room.pendingSignals || [];
                room.pendingSignals.push({ target: targetRole, data: payload });
            }
        } catch (err) {
            console.error("signal handler error", err);
        }
    });
});

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Socket.io signaling server running on ${PORT}`);
});
