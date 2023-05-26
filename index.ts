import express, { Express, Request, Response } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
const app: Express = express();
import cors from "cors";
import { CustomRequest, verifyToken } from "./middleware/auth";
const port = process.env.PORT ?? 4000;

const bodyParser = require("body-parser");

const generateNonce = (): string => {
  const nonce = crypto.randomBytes(32).toString("hex");
  return nonce;
};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/:address/getNonce", (req: Request, res: Response) => {
  const address = req.params.address;
  const nonce = generateNonce();

  res.json({ seed: nonce });
});

app.get("/verify", verifyToken, (req: Request, res: Response) => {

  

  res.json({address: (req as CustomRequest).address});

  
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

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
