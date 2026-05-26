/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as bellSchedules from "../bellSchedules.js";
import type * as calendarData from "../calendarData.js";
import type * as classes from "../classes.js";
import type * as groq from "../groq.js";
import type * as locations from "../locations.js";
import type * as scheduleRotation from "../scheduleRotation.js";
import type * as scheduledActivities from "../scheduledActivities.js";
import type * as schedules from "../schedules.js";
import type * as students from "../students.js";
import type * as teacherClasses from "../teacherClasses.js";
import type * as teachers from "../teachers.js";
import type * as weekDayMapping from "../weekDayMapping.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  bellSchedules: typeof bellSchedules;
  calendarData: typeof calendarData;
  classes: typeof classes;
  groq: typeof groq;
  locations: typeof locations;
  scheduleRotation: typeof scheduleRotation;
  scheduledActivities: typeof scheduledActivities;
  schedules: typeof schedules;
  students: typeof students;
  teacherClasses: typeof teacherClasses;
  teachers: typeof teachers;
  weekDayMapping: typeof weekDayMapping;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
