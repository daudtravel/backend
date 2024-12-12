
import { Strategy } from "passport-local";
import bcrypt from 'bcrypt';
import passport from "passport" 
import pool from "../config/sql";
 
export default passport.use(new Strategy(
  {
    usernameField: "email",
    passwordField: "password"
  },
  async (email, password, done) => {
    try {
      const userResult = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        return done(null, false, { message: 'EMAIL_NOT_EXIST' });
      }

      const user = userResult.rows[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return done(null, false, { message: 'INCORRECT_PASSWORD' });
      }
      const { password: _, ...userWithoutPassword } = user;
      return done(null, userWithoutPassword);

    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const userResult = await pool.query(
      'SELECT id, email, firstname, lastname FROM users WHERE id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      return done(new Error('User not found'));
    }
    
    done(null, userResult.rows[0]);
  } catch (error) {
    done(error);
  }
});