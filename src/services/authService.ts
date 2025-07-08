import pool from "../config/sql";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import {
  sendVerificationEmail,
  storeVerificationCode,
  verifyEmailCode,
} from "../mail/auth/signup";
import jwt from "jsonwebtoken";
import {
  User,
  CreateUserData,
  LoginData,
  PendingVerificationResult,
  AuthResult,
} from "../types/user";

export const checkEmailExists = async (email: string): Promise<boolean> => {
  const existingUserCheck = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return existingUserCheck.rows.length > 0;
};

export const checkPendingVerification = async (
  email: string
): Promise<PendingVerificationResult> => {
  const pendingVerificationCheck = await pool.query(
    "SELECT * FROM email_verification WHERE email = $1",
    [email]
  );

  if (pendingVerificationCheck.rows.length === 0) {
    return { exists: false };
  }

  const codeEntry = pendingVerificationCheck.rows[0];
  const currentTime = new Date();
  const codeCreatedAt = new Date(codeEntry.created_at);
  const timeDiff = currentTime.getTime() - codeCreatedAt.getTime();
  const secondsDiff = Math.floor(timeDiff / 1000);

  // Check if code is expired (15 minutes = 900 seconds)
  if (secondsDiff >= 900) {
    await pool.query("DELETE FROM email_verification WHERE email = $1", [
      email,
    ]);
    return { exists: false };
  }

  // Check if we're within cooldown period (1 minute = 60 seconds)
  if (secondsDiff < 60) {
    return {
      exists: true,
      timeRemaining: 60 - secondsDiff, // Return remaining seconds
    };
  }

  // Code exists but cooldown period has passed, allow resending
  return { exists: false };
};

export const sendVerificationCodeService = async (
  email: string
): Promise<void> => {
  const emailExists = await checkEmailExists(email);

  if (emailExists) {
    throw {
      status: 400,
      message: "EMAIL_EXIST",
    };
  }

  const pendingCheck = await checkPendingVerification(email);

  if (pendingCheck.exists) {
    throw {
      status: 429, // Changed from 400 to 429 (Too Many Requests)
      message: "VERIFICATION_CODE_ALREADY_SENT",
      timeRemaining: pendingCheck.timeRemaining,
    };
  }

  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  await storeVerificationCode(email, verificationCode);
  await sendVerificationEmail(email, verificationCode);
};

export const createUserWithVerification = async (
  userData: CreateUserData
): Promise<Omit<User, "password">> => {
  const { firstname, lastname, email, password, code } = userData;

  const isCodeValid = await verifyEmailCode(email, code);

  if (!isCodeValid) {
    throw {
      status: 400,
      message: "INVALID_VERIFICATION_CODE",
    };
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const userId = uuidv4();

  const newUser: User = {
    id: userId,
    firstname,
    lastname,
    email,
    password: hashedPassword,
    is_verified: true,
  };

  await pool.query(
    "INSERT INTO users (id, firstname, lastname, email, password, is_verified) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      newUser.id,
      newUser.firstname,
      newUser.lastname,
      newUser.email,
      newUser.password,
      newUser.is_verified,
    ]
  );

  await pool.query("DELETE FROM email_verification WHERE email = $1", [email]);

  const { password: _, ...userResponse } = newUser;
  return userResponse;
};

export const authenticateUser = async (
  loginData: LoginData
): Promise<AuthResult> => {
  const { email, password } = loginData;

  if (!email || !password) {
    throw {
      status: 400,
      message: "MISSING_CREDENTIALS",
    };
  }

  const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);

  if (userResult.rows.length === 0) {
    throw {
      status: 401,
      message: "INVALID_CREDENTIALS",
    };
  }

  const user: User = userResult.rows[0];
  const isPasswordValid = await bcrypt.compare(password, user.password!);

  if (!isPasswordValid) {
    throw {
      status: 401,
      message: "INVALID_CREDENTIALS",
    };
  }

  const { password: _, ...userWithoutPassword } = user;
  const JWT_SECRET = process.env.JWT_SECRET!;

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      admin: user.admin,
    },
    JWT_SECRET,
    {
      expiresIn: "24h",
    }
  );

  return {
    user: userWithoutPassword,
    token,
  };
};
