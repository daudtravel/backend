import { Router } from "express";
import { createUser, getUserById, verifyEmail } from "../../handlers/users";
import { isAuthenticated } from "../../middlewares/auth";
import passport from "passport";
import pool from "../../config/sql";

const usersRouter = Router();

usersRouter.post("/api/login", (req, res, next) => {
  passport.authenticate("local", async (err: any, user: any, info: any) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      return res.status(401).json({ 
        message: info?.message || "Invalid credentials" 
      });
    }
    
    try {
      const verificationCheck = await pool.query(
        'SELECT is_verified FROM users WHERE email = $1',
        [user.email]
      );

      if (verificationCheck.rows.length === 0 || !verificationCheck.rows[0].is_verified) {
        return res.status(403).json({ 
          message: "Email not verified. Please verify your email first.",
          unverified: true
        });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        if (req.session && req.session.id) {
          req.sessionStore.get(req.session.id, (err, sessionData) => {
            if (err) {
              console.error('Error retrieving session:', err);
            }
            console.log('Session Data:', sessionData);
          });
        }
        
        return res.status(200).json({ 
          message: "Login successful", 
          
        });
      });
    } catch (verificationError) {
      console.error('Verification check error:', verificationError);
      return res.status(500).json({ 
        message: "Error during login verification" 
      });
    }
  })(req, res, next);
});

usersRouter.post("/api/signup", createUser);

usersRouter.get("/api/user/:id", isAuthenticated, getUserById);

usersRouter.get("/api/auth/status", (req: any, res: any) => {
  if (req.isAuthenticated()) {
    return res.status(200).json({
      isAuthenticated: true,
      user: req.user 
    });
  } else {
    return res.status(401).json({
      isAuthenticated: false,
      user: null
    });
  }
});

usersRouter.post("/api/verify-email", verifyEmail);


export default usersRouter;