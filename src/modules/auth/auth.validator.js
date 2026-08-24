import { z } from 'zod';

export const sendOTPSchema = z.object({
  body: z.object({
    mobileNumber: z.string({ required_error: 'Phone number is required.' })
      .transform(val => val.trim().replace(/\D/g, '').slice(-10))
      .refine(val => val.length === 10, { message: 'Phone number must be a valid 10-digit number.' })
  }).passthrough()
});

export const verifyOTPSchema = z.object({
  body: z.object({
    mobileNumber: z.string({ required_error: 'Phone number is required.' })
      .transform(val => val.trim().replace(/\D/g, '').slice(-10))
      .refine(val => val.length === 10, { message: 'Phone number must be a valid 10-digit number.' }),
    otpCode: z.string({ required_error: '6-digit OTP code is required.' })
      .transform(val => val.trim())
      .refine(val => val.length === 6, { message: 'OTP code must be a valid 6-digit number.' })
  }).passthrough()
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string({ required_error: 'Email address is required.' }).email('Invalid email address format.'),
    password: z.string({ required_error: 'Password is required.' }).min(6, 'Password must be at least 6 characters.')
  }).passthrough()
});

export const registerEmployeeSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Employee name is required.' }).min(1, 'Employee name cannot be empty.'),
    mobileNumber: z.string({ required_error: 'Mobile number is required.' })
      .transform(val => val.trim().replace(/\D/g, '').slice(-10))
      .refine(val => val.length === 10, { message: 'Mobile number must be a valid 10-digit number.' }),
    password: z.string({ required_error: 'Password is required.' }).min(6, 'Password must be at least 6 characters.')
  }).passthrough()
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token is required.' }).min(1, 'Refresh token cannot be empty.')
  }).passthrough()
});
