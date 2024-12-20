import jwt from "jsonwebtoken";
import { Request, NextFunction } from "express";

interface JWTPayload {
  [key: string]: any;
}

const verifyToken = (req: Request, res: any) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    return res.status(200).json({ 
      message: "Token verified successfully", 
      user: verified 
    });
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export default verifyToken;