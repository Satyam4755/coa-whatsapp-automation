import bcrypt from "bcrypt";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Admin from "../models/Admin.js";

dotenv.config();

const [, , emailArg, passwordArg, nameArg] = process.argv;

const printUsageAndExit = (message) => {
  if (message) {
    console.error(message);
  }
  console.error(
    "Usage: node scripts/create-admin.js <email> <password> [name]"
  );
  process.exit(1);
};

if (!process.env.MONGO_URI) {
  printUsageAndExit("Missing MONGO_URI in environment.");
}

if (!emailArg || !passwordArg) {
  printUsageAndExit("Email and password are required.");
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg.trim();
const name =
  nameArg?.trim() ||
  email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

if (!email || !password) {
  printUsageAndExit("Email and password must not be empty.");
}

try {
  await mongoose.connect(process.env.MONGO_URI);

  const existingAdmin = await Admin.findOne({ email });
  if (existingAdmin) {
    console.error(`Admin already exists for email: ${email}`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await Admin.create({
    name,
    email,
    password: hashedPassword,
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("Failed to create admin:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
