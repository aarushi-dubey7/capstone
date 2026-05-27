import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const SCHOOL_EMAIL_SUFFIX = "@bhpsnj.org";
const MIN_TEACHER_PASSWORD_LENGTH = 6;
const TEMP_TEACHER_PASSWORD_LENGTH = 6;
const TEMP_TEACHER_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeTeacherEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateTeacherEmail(email: string) {
  if (!email.endsWith(SCHOOL_EMAIL_SUFFIX)) {
    throw new Error(`Teacher email must end with ${SCHOOL_EMAIL_SUFFIX}.`);
  }
}

function validateTeacherPassword(password: string) {
  if (password.trim().length < MIN_TEACHER_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_TEACHER_PASSWORD_LENGTH} characters.`);
  }
}

function generateTemporaryTeacherPassword() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(TEMP_TEACHER_PASSWORD_LENGTH));
  return Array.from(randomBytes, (byte) => TEMP_TEACHER_PASSWORD_ALPHABET[byte % TEMP_TEACHER_PASSWORD_ALPHABET.length]).join("");
}

export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeTeacherEmail(args.email);
    validateTeacherEmail(email);
    validateTeacherPassword(args.password);

    const existing = await ctx.db
      .query("teachers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      throw new Error("A teacher account with that email already exists.");
    }

    const teacherId = await ctx.db.insert("teachers", {
      name: args.name.trim(),
      email,
      passwordHash: await hashPassword(args.password),
      createdAt: Date.now(),
      mustChangePassword: false,
    });

    return {
      _id: teacherId,
      name: args.name.trim(),
      email,
      tutorialCompletedAt: undefined,
      mustChangePassword: false,
    };
  },
});

export const markTutorialComplete = mutation({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, { teacherId }) => {
    const teacher = await ctx.db.get(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found.");
    }
    if (teacher.tutorialCompletedAt !== undefined) {
      return { tutorialCompletedAt: teacher.tutorialCompletedAt };
    }
    const tutorialCompletedAt = Date.now();
    await ctx.db.patch(teacherId, { tutorialCompletedAt });
    return { tutorialCompletedAt };
  },
});

export const resetTutorial = mutation({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, { teacherId }) => {
    const teacher = await ctx.db.get(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found.");
    }
    await ctx.db.patch(teacherId, { tutorialCompletedAt: undefined });
    return { tutorialCompletedAt: undefined };
  },
});

export const login = query({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeTeacherEmail(args.email);
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!teacher) return null;

    const passwordHash = await hashPassword(args.password);
    if (teacher.passwordHash !== passwordHash) return null;

    return {
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      createdAt: teacher.createdAt,
      tutorialCompletedAt: teacher.tutorialCompletedAt,
      mustChangePassword: teacher.mustChangePassword,
    };
  },
});

export const applyPasswordResetByEmail = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!teacher) {
      return { found: false };
    }

    await ctx.db.patch(teacher._id, {
      passwordHash: args.passwordHash,
      mustChangePassword: true,
    });

    return { found: true };
  },
});

export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeTeacherEmail(args.email);
    validateTeacherEmail(email);

    const temporaryPassword = generateTemporaryTeacherPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const result: { found: boolean } = await ctx.runMutation(internal.teachers.applyPasswordResetByEmail, {
      email,
      passwordHash,
    });
    if (!result.found) {
      return { success: false, temporaryPassword: null };
    }
    return { success: true, temporaryPassword };
  },
});

export const changeOwnPassword = mutation({
  args: {
    teacherId: v.id("teachers"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher) {
      throw new Error("Teacher not found.");
    }

    const currentPasswordHash = await hashPassword(args.currentPassword);
    if (teacher.passwordHash !== currentPasswordHash) {
      throw new Error("Current password is incorrect.");
    }

    validateTeacherPassword(args.newPassword);

    await ctx.db.patch(args.teacherId, {
      passwordHash: await hashPassword(args.newPassword),
      mustChangePassword: false,
    });

    return {
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      createdAt: teacher.createdAt,
      tutorialCompletedAt: teacher.tutorialCompletedAt,
      mustChangePassword: false,
    };
  },
});

export const getById = query({
  args: { teacherId: v.union(v.id("teachers"), v.string()) },
  handler: async (ctx, { teacherId }) => {
    try {
      const teacher = await ctx.db.get("teachers", teacherId as Id<"teachers">);
      if (!teacher) return null;
      return {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        createdAt: teacher.createdAt,
        tutorialCompletedAt: teacher.tutorialCompletedAt,
        mustChangePassword: teacher.mustChangePassword,
      };
    } catch {
      return null;
    }
  },
});
