import pool from "../config/sql";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from 'uuid';
import { sendVerificationEmail, storeVerificationCode, verifyEmailCode } from "../mail";
import { Request, Response } from "express";
import jwt from 'jsonwebtoken';

export const sendVerificationCode = async (request: Request, response: Response): Promise<void> => {
  try {
      const { email } = request.body;
      const existingUserCheck = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
      );
      
      if (existingUserCheck.rows.length > 0) {
         response.status(400).json({ message: 'EMAIL_EXIST' });
         return;
          
      }

      const pendingVerificationCheck = await pool.query(
          'SELECT * FROM email_verification WHERE email = $1',
          [email]
      );

      if (pendingVerificationCheck.rows.length > 0) {
          const codeEntry = pendingVerificationCheck.rows[0];
          const currentTime = new Date();
          const codeCreatedAt = new Date(codeEntry.created_at);
          const timeDiff = currentTime.getTime() - codeCreatedAt.getTime();
          const minutesDiff = timeDiff / (1000 * 60);

          if (minutesDiff < 15) {
            response.status(400).json({
                  message: 'VERIFICATION_CODE_ALREADY_SENT',
                  timeRemaining: Math.ceil(15 - minutesDiff)
              });
            return;
               
          } else {
              await pool.query(
                  'DELETE FROM email_verification WHERE email = $1',
                  [email]
              );
          }
      }

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      await storeVerificationCode(email, verificationCode);
      await sendVerificationEmail(email, verificationCode);

      response.status(201).json({
          message: 'CODE_SEND',
          email: email
      });
      return;
       


  } catch (error) {
      console.error('Signup error:', error);
     
      response.status(500).json({
          message: 'Error in signup process',
          details: error instanceof Error ? error.message : error
      });
      return;
    
     
  }
};

export const createAndVerify = async (request: Request, response: Response): Promise<void> => {
  try {
    const { firstname, lastname, email, password, code } = request.body;
    const isCodeValid = await verifyEmailCode(email, code);

    if (!isCodeValid) {
     response.status(400).json({ message: 'INVALID_VERIFICATION_CODE' });
     return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();

    const newUser = {
      id: userId,
      firstname,
      lastname,
      email,
      password: hashedPassword,
      is_verified: true 
    };

    await pool.query(
      'INSERT INTO users (id, firstname, lastname, email, password, is_verified) VALUES ($1, $2, $3, $4, $5, $6)',
      [newUser.id, newUser.firstname, newUser.lastname, newUser.email, newUser.password, newUser.is_verified]
    );
    await pool.query(
      'DELETE FROM email_verification WHERE email = $1',
      [email]
    );

    const { password: _, ...userResponse } = newUser;
    
    response.status(201).json({
      user: userResponse,
      message: 'Email verified and user created successfully.'
    });
    return

  } catch (error) {
    console.error('Email verification error:', error);
    response.status(500).json({ 
      message: 'Error in email verification', 
      details: error instanceof Error ? error.message : error 
    });
    return;
  }
};


export const signin = async (request: Request, response: Response): Promise<void> => {
  try {
      const { email, password } = request.body;
      if (!email || !password) {
          response.status(400).json({
              message: 'MISSING_CREDENTIALS'
          });
          return;
      }

      const userResult = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
      );

      if (userResult.rows.length === 0) {
          response.status(401).json({
              message: 'INVALID_CREDENTIALS'
          });
          return;
      }

      const user = userResult.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
          response.status(401).json({
              message: 'INVALID_CREDENTIALS'
          });
          return;
      }

     
      const { password: _, ...userWithoutPassword } = user;
      const JWT_SECRET = process.env.JWT_SECRET!; 
       
      const token = jwt.sign(
        { 
            userId: user.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname
            
        },
        JWT_SECRET,
        { 
            expiresIn: '24h'  
        }
    );

      response.status(200).json({
          message: 'LOGIN_SUCCESS',
          user: userWithoutPassword,
          token: token
      });
      return;

  } catch (error) {
      console.error('Login error:', error);
      response.status(500).json({
          message: 'Error during login process',
          details: error instanceof Error ? error.message : error
      });
      return;
  }
};


const createTableIfNotExist = async () => {
  const userQuery = `
      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          firstname VARCHAR(255) NOT NULL,
          lastname VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
  `;

  try {
      await pool.query(userQuery);
      console.log("User table checked/created successfully");
  } catch (error) {
      console.error("Error creating users table:", error);
  }
};

const createEmailVerificationTableIfNotExist = async () => {
  const query = `
      CREATE TABLE IF NOT EXISTS email_verification (
          email VARCHAR(100) PRIMARY KEY,
          code VARCHAR(6) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
  `;

  try {
      await pool.query(query);
      console.log('Email verification table checked/created successfully');
  } catch (error) {
      console.error('Error creating email verification table:', error);
  }
};

(async () => {
  await createTableIfNotExist();
  await createEmailVerificationTableIfNotExist();
})();




