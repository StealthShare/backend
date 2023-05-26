import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import express, {
  Express,
  Request,
  Response,
  NextFunction,
} from "express";

export interface CustomRequest extends Request {
  address: string | JwtPayload;
}

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token =
    req.body.token || req.query.token || req.headers["x-access-token"];

  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const decoded = jwt.verify(token, "1234");
    console.log(decoded);
	(req as CustomRequest).address = (decoded as any).address;
  } catch (err) {
    return res.status(401).send("Invalid Token");
  }
  return next();
};
