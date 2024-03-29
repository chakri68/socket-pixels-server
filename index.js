import Fastify from "fastify";
import socketioServer from "fastify-socket.io";
import cors from "@fastify/cors";
import { find, getLocalDatabase, insertOne } from "./lib/db/tingodb.js";
import ObjectID from "tingodb/lib/ObjectId.js";
import { RoomHandler } from "./lib/room-utils.js";
import fs from "fs";

const public_ip = process.env.PUBLIC_IP;
const port = process.env.PORT;

const dataDir = "./data/tingo";

// Check if the data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("Created data directory");
}

let db = getLocalDatabase(dataDir);
let roomCollection = db.collection("rooms");

const app = Fastify({
  logger: true,
});

app.register(socketioServer, {
  cors: {
    origin: "*",
  },
});
app.register(cors, {
  origin: "*",
});

app.get("/", (request, response) => {
  // app.io.emit("Hello World!");
  console.log({ ip: request.socket.remoteAddress });
  console.log("OI");
  return { data: "Hello World!", err: null };
});

app.post("/createroom", async (request, response) => {
  console.log({ body: request.body });
  let reqBody = JSON.parse(request.body);
  let newRoom = await insertOne(roomCollection, {
    // TODO: Add default values to these
    /// TODO: Add type checking here to check if all the colors are valid
    colors: reqBody.colors,
    pixels: {},
    users: {},
    gridSize: { row: reqBody.gridSize.row, column: reqBody.gridSize.column },
    expiresAt: new Date(),
    timeout: reqBody.timeout,
  });
  if (!newRoom) {
    console.info("Save unsuccessful");
    return { success: false, data: null };
  }
  new RoomHandler(
    app.io.of(`/room/${newRoom._id}`),
    newRoom,
    roomCollection
  ).handle();
  return {
    success: true,
    data: { roomId: newRoom._id, expiresAt: newRoom.expiresAt },
  };
});

app.ready(async (err) => {
  if (err) throw err;
  let rooms = await find(roomCollection, {});
  // Start workflow for previous rooms
  rooms.forEach((room) => {
    new RoomHandler(
      app.io.of(`/room/${room._id}`),
      room,
      roomCollection
    ).handle();
  });
});

app.listen(port || 3000, public_ip || "0.0.0.0");
