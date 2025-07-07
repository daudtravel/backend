import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface JWTPayload {
  [key: string]: any;
}

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const { authorization } = req.headers;

  if (!authorization) {
    res.status(401).json({ error: "Authorization header missing" });
    return;
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Token missing" });
    return;
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Attach user data to request object
    req.user = verified;

    // Pass control to next middleware/route handler
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
};

export default verifyToken;
