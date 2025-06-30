import { Request, Response } from "express";
import * as authService from "../services/authService";

export const sendVerificationCode = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { email } = request.body;

    await authService.sendVerificationCodeService(email);

    response.status(201).json({
      message: "CODE_SEND",
      email: email,
    });
  } catch (error: any) {
    console.error("Send verification code error:", error);

    if (error.status) {
      const responseData: any = {
        message: error.message,
      };

      if (error.timeRemaining) {
        responseData.timeRemaining = error.timeRemaining;
      }

      response.status(error.status).json(responseData);
    } else {
      response.status(500).json({
        message: "Error in signup process",
        details: error instanceof Error ? error.message : error,
      });
    }
  }
};

export const createAndVerify = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { firstname, lastname, email, password, code } = request.body;

    const user = await authService.createUserWithVerification({
      firstname,
      lastname,
      email,
      password,
      code,
    });

    response.status(201).json({
      user: user,
      message: "Email verified and user created successfully.",
    });
  } catch (error: any) {
    console.error("Email verification error:", error);

    if (error.status) {
      response.status(error.status).json({
        message: error.message,
      });
    } else {
      response.status(500).json({
        message: "Error in email verification",
        details: error instanceof Error ? error.message : error,
      });
    }
  }
};

export const signin = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { email, password } = request.body;

    const result = await authService.authenticateUser({ email, password });

    response.status(200).json({
      message: "LOGIN_SUCCESS",
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error("Login error:", error);

    if (error.status) {
      response.status(error.status).json({
        message: error.message,
      });
    } else {
      response.status(500).json({
        message: "Error during login process",
        details: error instanceof Error ? error.message : error,
      });
    }
  }
};
