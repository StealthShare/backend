import express, { Express, Request, Response } from "express";
import { ethers } from "ethers";

import jwt from "jsonwebtoken";
import crypto from "crypto";
const app: Express = express();
import cors from "cors";
import { CustomRequest, verifyToken } from "./middleware/auth";
import { ERC1155_ABI } from "./abi/erc1155";
import { MARKET_ADDRESS, MINTER_CONTRACT_ADDRESS } from "./constants";
import { MARKET_ABI } from "./abi/market";
import { OWNABLE_ABI } from "./abi/ownable";
import { MINTER_ABI } from "./abi/minter";
import { makeFileObjects } from "./utils";
import { File } from "buffer";
const port = process.env.PORT ?? 4000;
var fileupload = require("express-fileupload");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { Web3Storage, getFilesFromPath } = require("web3.storage");
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

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

const storage = new Web3Storage({ token: process.env.IPFS_TOKEN });

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

export const generateNonce = (): string => {
  const nonce = crypto.randomBytes(32).toString("hex");
  return nonce;
};

const provider = new ethers.JsonRpcProvider(
 "https://rpc.testnet.mantle.xyz"

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

  res.json({ seed: process.env.IPFS_TOKEN });
});

app.post("/uploadToIPFS", async (req: any, res: Response) => {
  try {
    const photoFilename =
      generateNonce() + "." + req.files.file.name.split(".")[1];

    const y = fs.writeFileSync(
      "./images/" + photoFilename,
      req.files.file.data
    );
    let rawdataImage = await getFilesFromPath("./images/" + photoFilename);

    const cid2 = await storage.put(rawdataImage);

    const data = {
      description: req.body.description,
      image: `https://ipfs.io/ipfs/${cid2}/${photoFilename}`,
      name: req.body.name,
      tags: JSON.parse(req.body.tags),
      attributes: [
        {
          trait_type: "Type",
          value: req.body.type
        }
      ]
    };

    const filename = generateNonce() + ".json";

    const x = fs.writeFileSync("./metadata/" + filename, JSON.stringify(data));
    let rawdata = await getFilesFromPath("./metadata/" + filename);

    const cid = await storage.put(rawdata);

    fs.unlinkSync("./images/" + photoFilename);
    fs.unlinkSync("./metadata/" + filename);

    return res.json(`https://ipfs.io/ipfs/${cid}/${filename}`);
  } catch (error) {
    res.status(500).send("Internal error");
  }
});

app.get(
  "/:token/download",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const token = req.params.token;

      const contract = new ethers.Contract(
        MINTER_CONTRACT_ADDRESS,
        ERC1155_ABI,
        provider
      );

      const balance = await contract.balanceOf(
        (req as CustomRequest).address,
        token
      );

      if (balance <= 0) return res.status(400).send("No token");

      try {
        const r = await client
          .db("db")
          .collection("files")
          .findOne({ token: token }, (err: any, res: any) => {
            console.log(res);
          });

        var buf = Buffer.from(r.files.data.toString(), "base64");

        return res
          .status(200)
          .json({ files: r.files.data, filename: r.files.name });
      } catch (err) {
        console.log(err);
        res.status(500).send("server error");
      }

      res.json({ balance: Number(balance) });
    } catch (error) {}
  }
);

app.post("/:token/uploadFile", verifyToken, async (req: any, res: Response) => {
  try {
    const token = req.params.token;
    const files = req.files;

    const contract = new ethers.Contract(
      MINTER_CONTRACT_ADDRESS,
      MINTER_ABI,
      provider
    );
    const minter = await contract.minter(Number(token));

    if ((req as CustomRequest).address.toLowerCase() != minter.toLowerCase()) {
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
  } catch (err) {
    console.log(err);
  }
});

app.post("/:token/uploadFile", verifyToken, async (req: any, res: Response) => {
  const token = req.params.token;
  const files = req.files;

  const contract = new ethers.Contract(
    MINTER_CONTRACT_ADDRESS,
    MINTER_ABI,
    provider
  );

  const minter = await contract.minter(token);

  if ((req as CustomRequest).address.toLowerCase() != minter.toLowerCase()) {
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

app.get("/listings", async (req: Request, res: Response) => {
  //const token = req.params.token;

  try {
    const r = await client
      .db("db")
      .collection("listings")
      .find({})
      .toArray((err: any, res: any) => {
        console.log(res);
      });
    return res.status(200).json({ listings: r });

    //return res.status(400).send("Listing already exists");
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

try {
  packageContract.on(
    "NewListing(address, uint256, string, uint256, uint256)",
    async (
      user: string,
      token: number,
      uri: string,
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
        const response = await axios.get(uri);

        const f = await client
          .db("db")
          .collection("files")
          .findOne({ token: token.toString() }, (err: any, res: any) => {
            console.log(res);
          });

        const listings = await client
          .db("db")
          .collection("listings")
          .findOne({ token: token.toString() }, (err: any, res: any) => {
            console.log(res);
          });
        if (listings === null) {
          await client
            .db("db")
            .collection("listings")
            .insertOne({
              user: user,
              token: token.toString(),
              price: price,
              type: response.data.attributes[0].value ?? "File",
              tags: response.data.tags ?? [],
              name: response.data.name ?? "StealthShare File",
              image: response.data.image ?? "StealthShare File Image",
              description:
                response.data.description ?? "StealthShare File Description",
              size: f.files.size
            });
        }
      } catch (err) {
        console.log(err);
      }
    }
  );
} catch (error) {}

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
