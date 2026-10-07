import jwt from "jsonwebtoken";

const accessTokenSecret = () =>
  process.env.ADMIN_ACCESS_TOKEN_SECRET || process.env.ADMIN_SECRET_KEY;

const refreshTokenSecret = () =>
  process.env.ADMIN_REFRESH_TOKEN_SECRET ||
  `${process.env.ADMIN_SECRET_KEY}_refresh`;

export const ACCESS_TOKEN_EXPIRES_IN =
  process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN || "15m";
export const REFRESH_TOKEN_EXPIRES_IN =
  process.env.ADMIN_REFRESH_TOKEN_EXPIRES_IN || "7d";
export const REFRESH_COOKIE_NAME = "adminRefreshToken";

export const getRefreshCookieMaxAge = () =>
  Number(process.env.ADMIN_REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000);

export const buildAdminPayload = (admin) => ({
  userId: admin._id,
  name: admin.name,
  email: admin.email,
  role: "admin",
});

export const signAccessToken = (admin) =>
  jwt.sign(buildAdminPayload(admin), accessTokenSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

export const signRefreshToken = (admin) =>
  jwt.sign(
    {
      userId: admin._id,
      tokenVersion: admin.refreshTokenVersion || 0,
      type: "refresh",
    },
    refreshTokenSecret(),
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    }
  );

export const verifyAccessToken = (token) => jwt.verify(token, accessTokenSecret());

export const verifyRefreshToken = (token) =>
  jwt.verify(token, refreshTokenSecret());

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: getRefreshCookieMaxAge(),
});
