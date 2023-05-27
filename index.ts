import express, { Express, Request, Response } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
const app: Express = express();
import cors from "cors";
import { CustomRequest, verifyToken } from "./middleware/auth";
import { ERC1155_ABI } from "./abi/erc1155";
import { MARKET_ADDRESS } from "./constants";
import { MARKET_ABI } from "./abi/market";
import { OWNABLE_ABI } from "./abi/ownable";
const port = process.env.PORT ?? 4000;
var fileupload = require("express-fileupload");
const { MongoClient, ServerApiVersion } = require("mongodb");
const fs = require("fs");
const uri =
  "mongodb+srv://user:user@cluster0.2dvtd3b.mongodb.net/?retryWrites=true&w=majority";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

const connect = async () => {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.log(error);
  }
};

const bodyParser = require("body-parser");

const generateNonce = (): string => {
  const nonce = crypto.randomBytes(32).toString("hex");
  return nonce;
};

const provider = new ethers.JsonRpcProvider(
  "https://matic-mumbai.chainstacklabs.com"
);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileupload());
app.use(express.urlencoded({ extended: true }));
connect();

app.get("/:address/getNonce", (req: Request, res: Response) => {
  const address = req.params.address;
  const nonce = generateNonce();

  res.json({ seed: nonce });
});

app.get(
  "/:token/download",
  verifyToken,
  async (req: Request, res: Response) => {
    const token = req.params.token;

    const contract = new ethers.Contract(token, ERC1155_ABI, provider);

    const balance = await contract.balanceOf((req as CustomRequest).address, 0);

    if (balance <= 0) return res.status(400).send("No token");

    try {
      const r = await client
        .db("db")
        .collection("files")
        .findOne({ token: token }, (err: any, res: any) => {
          console.log(res);
        });
      // console.log(r.files.data);
      // const file = fs.createWriteStream(r.files.name);
      // var buf = Buffer.from(r.files.data, "base64");
      // console.log(buf);
      // file.write(buf);
      // file.close();
    } catch (err) {
      console.log(err);
      res.status(500).send("server error");
    }

    res.json({ balance: Number(balance) });
  }
);

app.post("/:token/uploadFile", verifyToken, async (req: any, res: Response) => {
  const token = req.params.token;
  const files = req.files;

  const contract = new ethers.Contract(token, OWNABLE_ABI, provider);

  const owner = await contract.owner();

  if ((req as CustomRequest).address.toLowerCase() != owner.toLowerCase()) {
    return res.status(401).send("You are not token owner");
  }

  try {
    const f = await client
      .db("db")
      .collection("files")
      .findOne({ token: token }, (err: any, res: any) => {
        console.log(res);
      });
    if (f === null) {
      const r = await client
        .db("db")
        .collection("files")
        .insertOne(
          { files: files.file, token: token },
          (err: any, res: any) => {
            if (err) throw err;
          }
        );
      return res.status(200).send("Success!");
    }
    return res.status(400).send("Token already exists");
  } catch (err) {
    console.log(err);
    return res.status(500).send("server error");
  }
});

app.post(
  "/login",
  (
    req: Request<{ message: string; signedMessage: string; address: string }>,
    res: Response
  ) => {
    const { signedMessage, message, address } = req.body;
    const recoveredPublicKey = ethers.verifyMessage(message, signedMessage);

    if (recoveredPublicKey.toLowerCase() != address.toLowerCase()) {
      res.status(401).json({ error: "Invalid signer" });
    }

    const token = jwt.sign({ address }, "1234", { expiresIn: "1h" });

    res.json(token);
  }
);

app.get("/:token/listings", async (req: Request, res: Response) => {
  const token = req.params.token;

  try {
    const listings = await client
      .db("db")
      .collection("listings")
      .findOne({ token: token }, (err: any, res: any) => {
        console.log(res);
      });
    if (listings === null) {
      const r = await client
        .db("db")
        .collection("listings")
        .find({})
        .toArray((err: any, res: any) => {
          console.log(res);
        });
      console.log(r);
      return res.status(200).json({ listings: r });
    }
    return res.status(400).send("Listing already exists");
  } catch (err) {
    console.log(err);
    res.status(500).send("server error");
  }
});

const packageContract = new ethers.Contract(
  MARKET_ADDRESS,
  MARKET_ABI,
  provider
);

packageContract.on(
  "NewListing(address, address, string, uint256, uint256)",
  async (
    user: string,
    token: string,
    uri: number,
    price: number,
    supply: number
  ) => {
    console.log("New token listed.", "Event data:", {
      user,
      token,
      price,
      uri,
      supply
    });
    try {
      await client
        .db("db")
        .collection("listings")
        .insertOne({
          user: user,
          token: token,
          price: price,
          name: Math.floor(Math.random() * 1000).toString(),
          image: "https://picsum.photos/200",
          description: Math.floor(Math.random() * 1000).toString()
        });
    } catch (err) {
      console.log(err);
    }
  }
);

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
