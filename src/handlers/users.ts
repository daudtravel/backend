import pool from "../config/sql";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from 'uuid';
import { generateVerificationCode, sendVerificationEmail, storeVerificationCode, verifyEmailCode } from "../mail";
 
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
        console.error("Error creating table:", error);
    }
};

export const createEmailVerificationTableIfNotExist = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS email_verification (
      email VARCHAR(100) PRIMARY KEY,
      code VARCHAR(6) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  try {
    await pool.query(query);
    console.log('Email verification table checked/created successfully');
  } catch (error) {
    console.error('Error creating email verification table:', error);
  }
};

export const createUser = async (request: any, response: any) => {
  await createTableIfNotExist()
  await createEmailVerificationTableIfNotExist();

  try {
    const { email} = request.body;

    const existingUserCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUserCheck.rows.length > 0) {
      return response.status(400).json({ message: 'EMAIL_EXIST' });
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
        return response.status(400).json({ 
          message: 'VERIFICATION_CODE_ALREADY_SENT',
          timeRemaining: Math.ceil(15 - minutesDiff)
        });
      }

      await pool.query(
        'DELETE FROM email_verification WHERE email = $1',
        [email]
      );
    }
    const verificationCode = generateVerificationCode();
    
    await storeVerificationCode(email, verificationCode);
    await sendVerificationEmail(email, verificationCode);
    
    response.status(201).json({
      message: 'CODE_SEND',
      email: email
    });

  } catch (error) {
    console.error('Signup error:', error);
    response.status(500).json({ 
      message: 'Error in signup process', 
      details: error instanceof Error ? error.message : error 
    });
  }
};

export const verifyEmail = async (request: any, response: any) => {
  try {
    const { firstname, lastname, email, password, code } = request.body;
    const isCodeValid = await verifyEmailCode(email, code);

    if (!isCodeValid) {
      return response.status(400).json({ message: 'INVALID_VERIFICATION_CODE' });
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

  } catch (error) {
    console.error('Email verification error:', error);
    response.status(500).json({ 
      message: 'Error in email verification', 
      details: error instanceof Error ? error.message : error 
    });
  }
};

export const getUserById = async (req: any, res: any) => {
  try {
    if (req.user && req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};