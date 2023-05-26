import express, { Express, Request, Response } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
const app: Express = express();
import cors from "cors";
import { CustomRequest, verifyToken } from "./middleware/auth";
import { ERC1155_ABI } from "./abi/erc1155";
import { OWNABLE_ABI } from "./abi/ownable";
const port = process.env.PORT ?? 4000;
const { MongoClient, ServerApiVersion } = require("mongodb");
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

    res.json({ balance: Number(balance) });
  }
);

app.post(
  "/:token/uploadFile",
  verifyToken,
  async (req: Request, res: Response) => {
    const token = req.params.token;
    const files = req.body.files;

    const contract = new ethers.Contract(token, OWNABLE_ABI, provider);

    const owner = await contract.owner();

    if ((req as CustomRequest).address != owner) {
      return res.status(401).send("You are not token owner");
    }

    //TODO: add files to database
    try {
      const data = files.map((file: any) => {
        return { file: file, id: token };
      });
      await client
        .db("db")
        .collection("files")
        .insertMany(data, (err: any, res: any) => {
          if (err) throw err;
          console.log("1 document inserted");
        });
    } catch (err) {
      res.status(500).send("server error");
    } finally {
      res.status(200).send("Success!");
    }
  }
);

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

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
